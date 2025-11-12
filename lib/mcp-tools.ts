/**
 * Helper functions for calling MCP tools and prompts using Vercel AI SDK
 */

import { experimental_createMCPClient } from '@ai-sdk/mcp'

export interface McpClientConfig {
  baseUrl: string
  type?: 'STDIO' | 'SSE' | 'HTTP'
  timeoutMs?: number
  command?: string
  args?: string[]
}

/**
 * MCP Client Cache
 * Maintains persistent MCP clients per server to preserve state across tool calls
 */
class McpClientCache {
  private clients = new Map<string, any>()
  
  /**
   * Get a cache key for the MCP server configuration
   */
  private getCacheKey(config: McpClientConfig): string {
    const { baseUrl, type = 'HTTP', command, args } = config
    if (type === 'STDIO') {
      return `${type}:${command}:${args?.join(',') || ''}`
    }
    return `${type}:${baseUrl}`
  }
  
  /**
   * Get or create an MCP client for the given configuration
   */
  async getClient(config: McpClientConfig): Promise<any> {
    const key = this.getCacheKey(config)
    
    // Return existing client if available
    if (this.clients.has(key)) {
      console.log('[mcp-client-cache] Reusing existing client for:', key)
      return this.clients.get(key)
    }
    
    console.log('[mcp-client-cache] Creating new client for:', key)
    
    const { baseUrl, type = 'HTTP', command, args } = config
    let client: any
    
    try {
      // Create MCP client based on transport type
      if (type === 'HTTP') {
        // Use official StreamableHTTPClientTransport for better compatibility
        const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js')
        
        const transport = new StreamableHTTPClientTransport(new URL(baseUrl))
        
        client = await experimental_createMCPClient({
          transport,
        })
      } else if (type === 'SSE') {
        // Use official SSEClientTransport for better compatibility
        const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js')
        
        const transport = new SSEClientTransport(new URL(baseUrl))
        
        client = await experimental_createMCPClient({
          transport,
        })
      } else if (type === 'STDIO') {
        if (!command) {
          throw new Error('STDIO transport requires command configuration')
        }
        
        // Import STDIO transport dynamically
        const { Experimental_StdioMCPTransport } = await import('@ai-sdk/mcp/mcp-stdio')
        
        const transport = new Experimental_StdioMCPTransport({
          command,
          args: args || [],
        })
        
        client = await experimental_createMCPClient({
          transport,
        })
      } else {
        throw new Error(`Unsupported MCP transport type: ${type}`)
      }
      
      // Cache the client - it's already initialized by experimental_createMCPClient
      this.clients.set(key, client)
      
      console.log('[mcp-client-cache] Client created and cached for:', key)
      
      return client
    } catch (error: any) {
      console.error('[mcp-client-cache] Failed to create client for:', key, error)
      throw new Error(`Failed to create MCP client: ${error.message}`)
    }
  }
  
  /**
   * Close a specific client
   */
  async closeClient(config: McpClientConfig): Promise<void> {
    const key = this.getCacheKey(config)
    const client = this.clients.get(key)
    
    if (client) {
      console.log('[mcp-client-cache] Closing client for:', key)
      try {
        await client.close()
      } catch (error) {
        console.error('[mcp-client-cache] Error closing client:', error)
      }
      this.clients.delete(key)
    }
  }
  
  /**
   * Close all cached clients
   */
  async closeAll(): Promise<void> {
    console.log('[mcp-client-cache] Closing all clients')
    const closePromises = Array.from(this.clients.values()).map(client => 
      client.close().catch((error: any) => 
        console.error('[mcp-client-cache] Error closing client:', error)
      )
    )
    await Promise.all(closePromises)
    this.clients.clear()
  }
  
  /**
   * Get stats about cached clients
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      keys: Array.from(this.clients.keys())
    }
  }
}

// Global client cache instance
const mcpClientCache = new McpClientCache()

// Export for cleanup in shutdown handlers
export { mcpClientCache }

export interface GetPromptParams {
  endpoint: string
  name: string
  arguments?: Record<string, any>
}

export interface GetPromptResponse {
  success: boolean
  data?: {
    description?: string
    prompt?: {
      messages: Array<{
        role: string
        content: {
          type: string
          text?: string
          data?: string
          mimeType?: string
        }
      }>
    }
  }
  message?: string
}

export interface CallToolParams {
  endpoint: string
  name: string
  arguments?: Record<string, any>
}

export interface CallToolResponse {
  success: boolean
  data?: {
    content?: Array<{
      type: string
      text?: string
      data?: string
      mimeType?: string
    }>
  }
  message?: string
}

/**
 * Call an MCP tool using the appropriate transport
 * Uses cached MCP clients to maintain state across calls
 */
export async function callTool(
  config: McpClientConfig,
  params: CallToolParams
): Promise<CallToolResponse> {
  try {
    console.log('[mcp-tools] callTool config:', { 
      baseUrl: config.baseUrl, 
      type: config.type, 
      toolName: params.name 
    })
    
    // Get or create cached client
    const client = await mcpClientCache.getClient(config)
    
    console.log('[mcp-tools] Calling tool:', params.name)
    
    // Call the tool via the MCP client
    const result = await client.callTool({
      name: params.name,
      arguments: params.arguments || {},
    })
    
    console.log('[mcp-tools] Tool call successful:', params.name)
    
    return {
      success: true,
      data: {
        content: result.content || [],
      },
    }
  } catch (error: any) {
    console.error('[mcp-tools] callTool error:', error)
    
    // Provide more helpful error messages
    let message = error.message || 'Failed to call MCP tool'
    
    if (error.message?.includes('fetch failed') || error.cause?.message?.includes('ECONNREFUSED')) {
      message = `Cannot connect to MCP server at ${config.baseUrl}. Please check:
1. Is the MCP server running?
2. Is the baseUrl correct?
3. Is the server accepting ${config.type || 'HTTP'} connections?`
    } else if (error.message?.includes('other side closed')) {
      message = `MCP server closed the connection at ${config.baseUrl}. The server might not support ${config.type || 'HTTP'} transport.`
    }
    
    return {
      success: false,
      message,
    }
  }
  // Note: We do NOT close the client here - it's cached for reuse
}

/**
 * Get a prompt from an MCP server
 * Uses cached MCP clients to maintain state across calls
 */
export async function getPrompt(
  config: McpClientConfig,
  params: GetPromptParams
): Promise<GetPromptResponse> {
  try {
    console.log('[mcp-tools] getPrompt config:', { 
      baseUrl: config.baseUrl, 
      type: config.type, 
      promptName: params.name 
    })
    
    // Get or create cached client
    const client = await mcpClientCache.getClient(config)
    
    console.log('[mcp-tools] Getting prompt:', params.name)
    
    // Get the prompt via the MCP client
    const result = await client.getPrompt({
      name: params.name,
      arguments: params.arguments || {},
    })
    
    console.log('[mcp-tools] Get prompt successful:', params.name)
    
    return {
      success: true,
      data: result,
    }
  } catch (error: any) {
    console.error('[mcp-tools] getPrompt error:', error)
    
    // Provide more helpful error messages
    let message = error.message || 'Failed to get MCP prompt'
    
    if (error.message?.includes('fetch failed') || error.cause?.message?.includes('ECONNREFUSED')) {
      message = `Cannot connect to MCP server at ${config.baseUrl}. Please check:
1. Is the MCP server running?
2. Is the baseUrl correct?
3. Is the server accepting ${config.type || 'HTTP'} connections?`
    } else if (error.message?.includes('other side closed')) {
      message = `MCP server closed the connection at ${config.baseUrl}. The server might not support ${config.type || 'HTTP'} transport.`
    }
    
    return {
      success: false,
      message,
    }
  }
  // Note: We do NOT close the client here - it's cached for reuse
}

/**
 * Extract text content from prompt messages
 */
export function extractPromptText(response: GetPromptResponse): string {
  if (!response.data?.prompt?.messages) {
    return ''
  }

  return response.data.prompt.messages
    .map(msg => {
      if (msg.content.type === 'text' && msg.content.text) {
        return msg.content.text
      }
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Extract text content from tool response
 */
export function extractToolText(response: CallToolResponse): string {
  if (!response.data?.content) {
    return ''
  }

  return response.data.content
    .map(item => {
      if (item.type === 'text' && item.text) {
        return item.text
      }
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}
