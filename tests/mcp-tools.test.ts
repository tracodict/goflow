import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPrompt, callTool, extractPromptText, extractToolText } from '@/lib/mcp-tools'
import type { GetPromptResponse, CallToolResponse } from '@/lib/mcp-tools'

// Mock fetch
global.fetch = vi.fn()

describe('MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPrompt', () => {
    it('should fetch prompt successfully', async () => {
      const mockResponse: GetPromptResponse = {
        success: true,
        data: {
          description: 'Test prompt',
          prompt: {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: 'This is a test prompt'
                }
              }
            ]
          }
        }
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await getPrompt('http://localhost:8080', {
        endpoint: 'http://localhost:8000/mcp',
        name: 'test-prompt'
      })

      expect(result.success).toBe(true)
      expect(result.data?.prompt?.messages).toHaveLength(1)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/tools/get_prompt',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'http://localhost:8000/mcp',
            name: 'test-prompt'
          })
        })
      )
    })

    it('should include arguments when provided', async () => {
      const mockResponse: GetPromptResponse = {
        success: true,
        data: {}
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await getPrompt('http://localhost:8080', {
        endpoint: 'http://localhost:8000/mcp',
        name: 'test-prompt',
        arguments: { key: 'value' }
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/tools/get_prompt',
        expect.objectContaining({
          body: JSON.stringify({
            endpoint: 'http://localhost:8000/mcp',
            name: 'test-prompt',
            arguments: { key: 'value' }
          })
        })
      )
    })

    it('should throw error on failed request', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(
        getPrompt('http://localhost:8080', {
          endpoint: 'http://localhost:8000/mcp',
          name: 'test-prompt'
        })
      ).rejects.toThrow('Failed to get prompt: 500 Internal Server Error')
    })
  })

  describe('callTool', () => {
    it('should call tool successfully', async () => {
      const mockResponse: CallToolResponse = {
        success: true,
        data: {
          content: [
            {
              type: 'text',
              text: 'Tool execution result'
            }
          ]
        }
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await callTool('http://localhost:8080', {
        endpoint: 'http://localhost:8000/mcp',
        name: 'test-tool',
        arguments: { input: 'test' }
      })

      expect(result.success).toBe(true)
      expect(result.data?.content).toHaveLength(1)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/tools/call_mcp_tool',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'http://localhost:8000/mcp',
            name: 'test-tool',
            arguments: { input: 'test' }
          })
        })
      )
    })

    it('should throw error on failed request', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      await expect(
        callTool('http://localhost:8080', {
          endpoint: 'http://localhost:8000/mcp',
          name: 'test-tool'
        })
      ).rejects.toThrow('Failed to call tool: 404 Not Found')
    })
  })

  describe('extractPromptText', () => {
    it('should extract text from prompt messages', () => {
      const response: GetPromptResponse = {
        success: true,
        data: {
          prompt: {
            messages: [
              {
                role: 'user',
                content: { type: 'text', text: 'First message' }
              },
              {
                role: 'assistant',
                content: { type: 'text', text: 'Second message' }
              }
            ]
          }
        }
      }

      const text = extractPromptText(response)
      expect(text).toBe('First message\n\nSecond message')
    })

    it('should handle non-text content', () => {
      const response: GetPromptResponse = {
        success: true,
        data: {
          prompt: {
            messages: [
              {
                role: 'user',
                content: { type: 'text', text: 'Text message' }
              },
              {
                role: 'user',
                content: { type: 'image', data: 'base64data', mimeType: 'image/png' }
              }
            ]
          }
        }
      }

      const text = extractPromptText(response)
      expect(text).toBe('Text message')
    })

    it('should return empty string for missing data', () => {
      const response: GetPromptResponse = {
        success: true
      }

      const text = extractPromptText(response)
      expect(text).toBe('')
    })
  })

  describe('extractToolText', () => {
    it('should extract text from tool content', () => {
      const response: CallToolResponse = {
        success: true,
        data: {
          content: [
            { type: 'text', text: 'Result 1' },
            { type: 'text', text: 'Result 2' }
          ]
        }
      }

      const text = extractToolText(response)
      expect(text).toBe('Result 1\n\nResult 2')
    })

    it('should handle non-text content', () => {
      const response: CallToolResponse = {
        success: true,
        data: {
          content: [
            { type: 'text', text: 'Text content' },
            { type: 'image', data: 'base64', mimeType: 'image/png' }
          ]
        }
      }

      const text = extractToolText(response)
      expect(text).toBe('Text content')
    })

    it('should return empty string for missing content', () => {
      const response: CallToolResponse = {
        success: true
      }

      const text = extractToolText(response)
      expect(text).toBe('')
    })
  })
})
