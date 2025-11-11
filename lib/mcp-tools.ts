/**
 * Helper functions for calling MCP tools and prompts via flow service
 */

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
 * Get a prompt from an MCP server
 */
export async function getPrompt(
  flowServiceUrl: string,
  params: GetPromptParams
): Promise<GetPromptResponse> {
  const response = await fetch(`${flowServiceUrl}/api/tools/get_prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })

  if (!response.ok) {
    throw new Error(`Failed to get prompt: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  return result
}

/**
 * Call an MCP tool
 */
export async function callTool(
  flowServiceUrl: string,
  params: CallToolParams
): Promise<CallToolResponse> {
  const response = await fetch(`${flowServiceUrl}/api/tools/call_mcp_tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })

  if (!response.ok) {
    throw new Error(`Failed to call tool: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  return result
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
