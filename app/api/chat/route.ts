import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { streamText, type CoreMessage } from 'ai'
// Dify env variables
const DIFY_DATASET_ID = process.env.DIFY_DATASET_ID
const DIFY_DATASET_API_KEY = process.env.DIFY_DATASET_API_KEY
const DIFY_ENDPOINT = process.env.DIFY_ENDPOINT || 'https://api.dify.ai/v1'
import { resolveModel } from '@/components/chat/llm'
import { ensureIndexes, getDb } from '@/components/chat/mongo'
import type { ChatMessage } from '@/components/chat/types'

export const runtime = 'nodejs'

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
  const body = await req.json().catch(()=> ({})) as { sessionId?: string; messages?: ChatMessage[]; model?: string }
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
        { $set: { sessionId, updatedAt: now.toISOString(), isActive }, $setOnInsert: { createdAt: now.toISOString(), isActive } },
        { upsert: true }
      )
    }
  } catch (e) {
    console.error('[chat] persist error', e)
  }

  // resolve model from body or cookie
  let cookieModel: string | undefined
  try {
    const store: any = await (cookies() as any)
    cookieModel = store?.get?.('chat-model')?.value
  } catch {}
  const selectedModel = body.model || cookieModel
  const model = resolveModel(selectedModel)

  // Step 1: Add system prompt for fallback
  const systemPrompt: CoreMessage = {
  role: 'system',
  content: `
  You are a careful and honest assistant. 
  If you do not have enough information or knowledge to answer a question, you MUST reply exactly with 'NEED_EXTERNAL_KB' and do NOT attempt to guess or make assumptions.
  Do NOT fabricate or infer answers outside your training data or knowledge scope.
  If the question is about a specific financial product of DBS (e.g., DBS FCN) or GoFlow related question, always reply with 'NEED_EXTERNAL_KB'.
  Never answer with information you are not certain about.
  `
  }
  const llmMessages: CoreMessage[] = [systemPrompt, ...messages]
  const result1 = await streamText({ model, messages: llmMessages })
  let llmReply = ''
  let needExternalKB = false
  for await (const textPart of result1.textStream) {
    llmReply += textPart
    if (llmReply.includes('NEED_EXTERNAL_KB')) {
      needExternalKB = true
      break
    }
  }

  // If LLM can answer, respond directly
  if (!needExternalKB) {
    // persist assistant message
    try {
      const db = await getDb()
      await db.collection('chat_messages').insertOne({ sessionId, role: 'assistant', content: llmReply, createdAt: new Date().toISOString() })
    } catch (e) { console.error('[chat] persist assistant error', e) }
    return new Response(llmReply, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  // Step 2: Retrieve from Dify
  const userQuery = messages.slice(-1)[0]?.content || ''
  let difyContext = ''
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

  // Step 3: Add Dify context and re-query LLM
  const contextPrompt: CoreMessage = { role: 'system', content: `Relevant knowledge:\n${difyContext}` };
  const llmMessages2: CoreMessage[] = [contextPrompt, ...messages]
  const result2 = await streamText({ model, messages: llmMessages2 })
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
