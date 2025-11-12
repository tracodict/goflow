import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { streamText, type CoreMessage, type CoreTool } from 'ai'
import { z } from 'zod'
import { mcpCache } from '@/lib/mcp-cache'
import { getPrompt, callTool, extractPromptText, extractToolText } from '@/lib/mcp-tools'
// Dify env variables
const DIFY_DATASET_ID = process.env.DIFY_DATASET_ID
const DIFY_DATASET_API_KEY = process.env.DIFY_DATASET_API_KEY
const DIFY_ENDPOINT = process.env.DIFY_ENDPOINT || 'https://api.dify.ai/v1'
const FLOW_SERVICE_URL = process.env.FLOW_SERVICE_URL || 'http://localhost:8080'
import { resolveModel } from '@/components/chat/llm'
import { ensureIndexes, getDb } from '@/components/chat/mongo'
import type { ChatMessage } from '@/components/chat/types'

export const runtime = 'nodejs'

/**
 * Convert JSON Schema to Zod schema (simplified version)
 * For now, we'll just use a permissive object schema
 */
function jsonSchemaToZod(jsonSchema: any): z.ZodTypeAny {
  // If already a Zod schema, return it
  if (jsonSchema?._def) return jsonSchema
  
  // For JSON Schema objects, create a permissive object schema
  if (jsonSchema?.type === 'object' && jsonSchema?.properties) {
    const shape: Record<string, z.ZodTypeAny> = {}
    const required = jsonSchema.required || []
    
    for (const [key, value] of Object.entries(jsonSchema.properties as Record<string, any>)) {
      const isRequired = required.includes(key)
      let fieldSchema: z.ZodTypeAny
      
      switch (value.type) {
        case 'string':
          fieldSchema = z.string()
          break
        case 'number':
          fieldSchema = z.number()
          break
        case 'boolean':
          fieldSchema = z.boolean()
          break
        case 'array':
          fieldSchema = z.array(z.any())
          break
        case 'object':
          fieldSchema = z.record(z.any())
          break
        default:
          fieldSchema = z.any()
      }
      
      if (value.description) {
        fieldSchema = fieldSchema.describe(value.description)
      }
      
      if (!isRequired) {
        fieldSchema = fieldSchema.optional()
      }
      
      shape[key] = fieldSchema
    }
    
    return z.object(shape)
  }
  
  // Fallback: permissive object
  return z.object({}).passthrough()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const db = await getDb()
  let targetSessionId = sessionId
  if (!targetSessionId) {
    const activeSession = await db.collection('chat_sessions').findOne({ isActive: true })
    targetSessionId = activeSession?.sessionId || 'default'
  }
  const docs = await db.collection('chat_messages').find({ sessionId: targetSessionId }).sort({ createdAt: 1 }).toArray()
  // map to ChatMessage shape
  const messages = docs.map((d:any)=> ({ _id: d._id?.toString?.(), sessionId: d.sessionId, role: d.role, content: d.content, attachments: d.attachments, createdAt: d.createdAt }))
  return Response.json({ messages, sessionId: targetSessionId })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=> ({})) as { 
    sessionId?: string
    messages?: ChatMessage[]
    model?: string
    mcpPromptName?: string
    mcpPromptArgs?: Record<string, any>
    workspaceId?: string
  }
  
  console.log('[chat] POST received:', {
    workspaceId: body.workspaceId,
    hasMessages: !!body.messages,
    messageCount: body.messages?.length
  })
  
  const db = await getDb()
  const activeSession = await db.collection('chat_sessions').findOne({ isActive: true })
  const sessionId = body.sessionId || activeSession?.sessionId || 'default'
  const messages = (body.messages || []).map(m=> ({ role: m.role, content: m.content })) as CoreMessage[]

  // persist user message (last one)
  try {
    await ensureIndexes()
    const db = await getDb()
    const now = new Date()
    const last = (body.messages || []).slice(-1)[0]
    if (last && last.role === 'user') {
      await db.collection('chat_messages').insertOne({ sessionId, role: last.role, content: last.content, attachments: last.attachments, createdAt: now.toISOString() })
      // If this is the first session, set isActive true, else false
      const sessionCount = await db.collection('chat_sessions').countDocuments()
      const isActive = sessionCount === 0
      await db.collection('chat_sessions').updateOne(
        { sessionId },
        { 
          $set: { sessionId, updatedAt: now.toISOString() },
          $setOnInsert: { createdAt: now.toISOString(), isActive }
        },
        { upsert: true }
      )
    }
  } catch (e) {
    console.error('[chat] persist error', e)
  }

  // Handle MCP prompt injection
  let mcpPromptContent = ''
  if (body.mcpPromptName) {
    try {
      const promptConfig = mcpCache.findPrompt(body.mcpPromptName)
      
      if (promptConfig) {
        const promptData = await getPrompt(
          {
            baseUrl: promptConfig.baseUrl,
            type: promptConfig.type,
            timeoutMs: promptConfig.timeoutMs
          },
          {
            endpoint: promptConfig.baseUrl,
            name: body.mcpPromptName,
            arguments: body.mcpPromptArgs || {}
          }
        )
        
        if (promptData.success) {
          mcpPromptContent = extractPromptText(promptData)
        }
      }
    } catch (e) {
      console.error('[chat] Failed to fetch MCP prompt:', e)
    }
  }

  // Auto-load MCP cache if needed (before building tools)
  if (body.workspaceId) {
    const enabledTools = mcpCache.getEnabledTools()
    if (enabledTools.length === 0) {
      try {
        console.log('[chat] Auto-loading MCP cache for workspace:', body.workspaceId)
        
        // Use Referer header if available (for proxied requests), otherwise fall back to req.url
        const referer = req.headers.get('referer')
        const baseUrl = referer ? new URL(referer).origin : new URL(req.url).origin
        const cacheUrl = `${baseUrl}/api/mcp-cache`
        console.log('[chat] Using base URL from:', referer ? 'referer' : 'req.url', '→', cacheUrl)
        
        const response = await fetch(cacheUrl, { 
          method: 'POST',
          headers: {
            'Cookie': req.headers.get('Cookie') || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            workspaceId: body.workspaceId,
            baseUrl: baseUrl  // Pass baseUrl to mcp-cache for server-to-server calls
          })
        })
        
        const result = await response.json()
        console.log('[chat] MCP cache load result:', result)
        
        // Debug: Check what's actually in the cache
        const allConfigs = mcpCache.getAllConfigs()
        console.log('[chat] Cache has', allConfigs.length, 'configs')
        for (const config of allConfigs) {
          console.log('[chat] Config:', config.fileName, '- tools:', config.config.tools?.length || 0)
        }
        
        // Verify tools loaded
        const reloadedTools = mcpCache.getEnabledTools()
        if (reloadedTools.length > 0) {
          console.log('[chat] Auto-loaded MCP cache:', reloadedTools.length, 'tools')
        } else {
          console.log('[chat] No tools found after cache load')
        }
      } catch (e) {
        console.error('[chat] Failed to auto-load MCP cache:', e)
      }
    }
  }

  // resolve model from body or cookie
  let cookieModel: string | undefined
  try {
    const store: any = await (cookies() as any)
    cookieModel = store?.get?.('chat-model')?.value
  } catch {}
  const selectedModel = body.model || cookieModel
  const model = resolveModel(selectedModel)

  // Get available tools to inform Step 1 decision
  const allEnabledTools = mcpCache.getEnabledTools()
  console.log('[chat] Found', allEnabledTools.length, 'enabled tools for decision')
  
  // Build tools list for prompt awareness
  const toolsList = allEnabledTools.length > 0 
    ? allEnabledTools.map(t => `- ${t.name}: ${t.description || 'no description'}`).join('\n')
    : ''
  
  // Build system prompt for Step 1 that's aware of available tools
  const systemPromptContent = `You are a careful and honest assistant.${mcpPromptContent ? `\n\n## Agent Instructions\n${mcpPromptContent}` : ''}

${toolsList ? `## Available Tools\nYou have access to these tools:\n${toolsList}\n\n` : ''}## Decision Guidelines
- If the user asks you to perform an ACTION (get data, place order, execute command, check status, etc.), you MUST reply with 'NEED_TOOLS' to use the available tools
- If the user asks about specific financial products (DBS FCN, etc.) or GoFlow-related questions, reply with 'NEED_EXTERNAL_KB' for knowledge retrieval
- If you need to call any of the available tools to answer the question, reply with 'NEED_TOOLS'
- Only answer directly if the question is general knowledge that doesn't require tools or external knowledge
- Do NOT attempt to guess or fabricate information
- Do NOT pretend to execute actions - always use 'NEED_TOOLS' if action is needed`

  // Step 1: Quick check if we need tools or external knowledge
  const systemPrompt: CoreMessage = {
    role: 'system',
    content: systemPromptContent
  }
  const llmMessages: CoreMessage[] = [systemPrompt, ...messages]
  
  // Decide if we need tools or RAG
  const result1 = await streamText({ 
    model, 
    messages: llmMessages
  })
  let llmReply = ''
  let needExternalKB = false
  let needTools = false
  for await (const textPart of result1.textStream) {
    llmReply += textPart
    if (llmReply.includes('NEED_EXTERNAL_KB')) {
      needExternalKB = true
      break
    }
    if (llmReply.includes('NEED_TOOLS')) {
      needTools = true
      break
    }
  }

  // If LLM can answer directly without tools or KB, respond
  if (!needExternalKB && !needTools) {
    // persist assistant message
    try {
      const db = await getDb()
      await db.collection('chat_messages').insertOne({ sessionId, role: 'assistant', content: llmReply, createdAt: new Date().toISOString() })
    } catch (e) { console.error('[chat] persist assistant error', e) }
    return new Response(llmReply, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  // Step 2: Retrieve from Dify (only if need external KB)
  let difyContext = ''
  if (needExternalKB) {
    const userQuery = messages.slice(-1)[0]?.content || ''
    try {
      const difyRes = await fetch(`${DIFY_ENDPOINT}/datasets/${DIFY_DATASET_ID}/retrieve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_DATASET_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: userQuery,
          retrieval_model: {
            search_method: 'hybrid_search',
            reranking_enable: false,
            reranking_mode: null,
            reranking_model: {
              reranking_provider_name: '',
              reranking_model_name: ''
            },
            weights: null,
            top_k: 3,
            score_threshold_enabled: true,
            score_threshold: 0.5
          }
        })
      })
      const difyData = await difyRes.json()
      if (Array.isArray(difyData.records)) {
        difyContext = difyData.records.map((item: any) => {
          const seg = item.segment;
          const docName = seg?.document?.name || '';
          const content = seg?.content || '';
          return `【${docName}】\n${content}`;
        }).join('\n\n');
      }
    } catch (e) {
      console.error('[chat] Dify retrieval error', e)
    }
  }

  // Step 3: Build tools and add context for final answer
  // Build tools dictionary from cache
  const tools: Record<string, CoreTool> = {}
  
  console.log('[chat] Building tools for Step 3, found', allEnabledTools.length, 'enabled tools')
  
  for (const tool of allEnabledTools) {
    // Convert JSON Schema to Zod schema
    const parameters = tool.inputSchema 
      ? jsonSchemaToZod(tool.inputSchema)
      : z.object({}).passthrough()
    
    tools[tool.name] = {
      description: tool.description || `Tool: ${tool.name}`,
      parameters,
      execute: async (args: any) => {
        try {
          const result = await callTool(
            {
              baseUrl: tool.baseUrl,
              type: tool.type,
              timeoutMs: tool.timeoutMs
            },
            {
              endpoint: tool.baseUrl,
              name: tool.name,
              arguments: args
            }
          )
          
          if (result.success) {
            return extractToolText(result)
          }
          return `Error: ${result.message || 'Tool execution failed'}`
        } catch (e: any) {
          console.error(`[chat] Tool execution error for ${tool.name}:`, e)
          return `Error: ${e.message}`
        }
      }
    }
  }
  
  // Build system prompt with tool descriptions for Step 3
  const toolsListForStep3 = allEnabledTools.length > 0 
    ? `\n\nYou have access to the following tools: ${allEnabledTools.map(t => `${t.name} (${t.description || 'no description'})`).join(', ')}. Use them when appropriate to help the user.`
    : ''
  
  const systemPromptWithTools = `You are a careful and honest assistant.${mcpPromptContent ? `\n\n## Agent Instructions\n${mcpPromptContent}` : ''}${toolsListForStep3}

Use the provided tools when appropriate to help answer the user's question.
When you use a tool, explain what you're doing and show the results clearly.
If a tool call fails, try to understand why and explain the issue to the user.`

  const contextPrompt: CoreMessage = { 
    role: 'system', 
    content: `${systemPromptWithTools}\n\nRelevant knowledge:\n${difyContext}` 
  }
  const llmMessages2: CoreMessage[] = [contextPrompt, ...messages]
  
  // Configure streaming with tools
  const streamOptions: any = { 
    model, 
    messages: llmMessages2
  }
  
  if (Object.keys(tools).length > 0) {
    console.log('[chat] Enabling', Object.keys(tools).length, 'tools for Step 3')
    streamOptions.tools = tools
    streamOptions.maxSteps = 5  // Allow multi-step tool usage
  } else {
    console.log('[chat] No tools available for Step 3')
  }
  
  const result2 = await streamText(streamOptions)
    let finalText = ''
    const stream = new ReadableStream({
      async start(controller) {
        for await (const textPart of result2.textStream) {
          const chunk = typeof textPart === 'string' ? textPart : String(textPart)
          finalText += chunk
          controller.enqueue(new TextEncoder().encode(chunk))
        }
        controller.close()
        try {
          const db = await getDb()
          await db.collection('chat_messages').insertOne({ sessionId, role: 'assistant', content: finalText, createdAt: new Date().toISOString() })
        } catch (e) { console.error('[chat] persist assistant error', e) }
      }
    })

    const res = new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    try {
      if (body.model) {
        res.headers.append('Set-Cookie', `chat-model=${encodeURIComponent(body.model)}; Path=/; Max-Age=${60*60*24*30}`)
      }
    } catch {}
    return res
}
