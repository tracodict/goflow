import { describe, it, expect, beforeEach } from 'vitest'
import { mcpCache } from '@/lib/mcp-cache'
import type { McpEditorState } from '@/components/builder/mcp-utils'

describe('McpCache', () => {
  beforeEach(() => {
    mcpCache.clear()
  })

  describe('loadFromStorage', () => {
    it('should load MCP configurations from storage', async () => {
      const mockConfig1: McpEditorState = {
        id: 'test-server-1',
        name: 'Test Server 1',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [
          { name: 'tool1', description: 'Tool 1', enabled: true, passthrough: {} },
          { name: 'tool2', description: 'Tool 2', enabled: false, passthrough: {} }
        ],
        prompts: [
          { name: 'prompt1', description: 'Prompt 1', enabled: true, passthrough: {} }
        ],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      const mockConfig2: McpEditorState = {
        id: 'test-server-2',
        name: 'Test Server 2',
        baseUrl: 'http://localhost:9000/mcp',
        timeoutMs: 3000,
        tools: [
          { name: 'tool3', description: 'Tool 3', enabled: true, passthrough: {} }
        ],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({
        'server1.mcp': mockConfig1,
        'server2.mcp': mockConfig2
      })

      const configs = mcpCache.getAllConfigs()
      expect(configs).toHaveLength(2)
      expect(configs[0].fileName).toBe('server1.mcp')
      expect(configs[1].fileName).toBe('server2.mcp')
    })

    it('should handle empty storage', async () => {
      await mcpCache.loadFromStorage({})
      const configs = mcpCache.getAllConfigs()
      expect(configs).toHaveLength(0)
    })
  })

  describe('updateCache', () => {
    it('should update existing config', async () => {
      const mockConfig: McpEditorState = {
        id: 'test',
        name: 'Test',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [{ name: 'tool1', enabled: true, passthrough: {} }],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({ 'test.mcp': mockConfig })

      const updatedConfig = { ...mockConfig, name: 'Updated Test' }
      mcpCache.updateCache('test.mcp', updatedConfig)

      const configs = mcpCache.getAllConfigs()
      expect(configs[0].config.name).toBe('Updated Test')
    })

    it('should add new config if not exists', () => {
      const mockConfig: McpEditorState = {
        id: 'new',
        name: 'New Server',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      mcpCache.updateCache('new.mcp', mockConfig)

      const configs = mcpCache.getAllConfigs()
      expect(configs).toHaveLength(1)
      expect(configs[0].config.name).toBe('New Server')
    })
  })

  describe('getEnabledTools', () => {
    it('should return only enabled tools', async () => {
      const mockConfig: McpEditorState = {
        id: 'test',
        name: 'Test',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [
          { name: 'tool1', description: 'Enabled tool', enabled: true, passthrough: {} },
          { name: 'tool2', description: 'Disabled tool', enabled: false, passthrough: {} },
          { name: 'tool3', description: 'Default enabled', enabled: true, passthrough: {} }
        ],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({ 'test.mcp': mockConfig })

      const tools = mcpCache.getEnabledTools()
      expect(tools).toHaveLength(2)
      expect(tools.map(t => t.name)).toEqual(['tool1', 'tool3'])
    })

    it('should include base URL in tool info', async () => {
      const mockConfig: McpEditorState = {
        id: 'test',
        name: 'Test',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [{ name: 'tool1', enabled: true, passthrough: {} }],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({ 'test.mcp': mockConfig })

      const tools = mcpCache.getEnabledTools()
      expect(tools[0].baseUrl).toBe('http://localhost:8000/mcp')
    })

    it('should aggregate tools from multiple servers', async () => {
      const config1: McpEditorState = {
        id: 'server1',
        name: 'Server 1',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [{ name: 'tool1', enabled: true, passthrough: {} }],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      const config2: McpEditorState = {
        id: 'server2',
        name: 'Server 2',
        baseUrl: 'http://localhost:9000/mcp',
        timeoutMs: 5000,
        tools: [{ name: 'tool2', enabled: true, passthrough: {} }],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({
        'server1.mcp': config1,
        'server2.mcp': config2
      })

      const tools = mcpCache.getEnabledTools()
      expect(tools).toHaveLength(2)
      expect(tools.map(t => t.name).sort()).toEqual(['tool1', 'tool2'])
    })
  })

  describe('getEnabledPrompts', () => {
    it('should return only enabled prompts', async () => {
      const mockConfig: McpEditorState = {
        id: 'test',
        name: 'Test',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [],
        prompts: [
          { name: 'prompt1', description: 'Enabled', enabled: true, passthrough: {} },
          { name: 'prompt2', description: 'Disabled', enabled: false, passthrough: {} }
        ],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({ 'test.mcp': mockConfig })

      const prompts = mcpCache.getEnabledPrompts()
      expect(prompts).toHaveLength(1)
      expect(prompts[0].name).toBe('prompt1')
    })
  })

  describe('findPrompt', () => {
    it('should find prompt by name', async () => {
      const mockConfig: McpEditorState = {
        id: 'test',
        name: 'Test',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [],
        prompts: [
          { name: 'my-prompt', description: 'Test prompt', enabled: true, passthrough: {} }
        ],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({ 'test.mcp': mockConfig })

      const prompt = mcpCache.findPrompt('my-prompt')
      expect(prompt).toBeDefined()
      expect(prompt?.name).toBe('my-prompt')
      expect(prompt?.baseUrl).toBe('http://localhost:8000/mcp')
    })

    it('should return undefined for non-existent prompt', async () => {
      const mockConfig: McpEditorState = {
        id: 'test',
        name: 'Test',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({ 'test.mcp': mockConfig })

      const prompt = mcpCache.findPrompt('non-existent')
      expect(prompt).toBeUndefined()
    })
  })

  describe('findTool', () => {
    it('should find tool by name', async () => {
      const mockConfig: McpEditorState = {
        id: 'test',
        name: 'Test',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [
          { name: 'my-tool', description: 'Test tool', enabled: true, passthrough: {} }
        ],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({ 'test.mcp': mockConfig })

      const tool = mcpCache.findTool('my-tool')
      expect(tool).toBeDefined()
      expect(tool?.name).toBe('my-tool')
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const mockConfig: McpEditorState = {
        id: 'test',
        name: 'Test',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [
          { name: 'tool1', enabled: true, passthrough: {} },
          { name: 'tool2', enabled: false, passthrough: {} }
        ],
        prompts: [
          { name: 'prompt1', enabled: true, passthrough: {} }
        ],
        resources: [
          { name: 'res1', type: 'file', uri: 'file://test', configText: '', passthrough: {} }
        ],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({ 'test.mcp': mockConfig })

      const stats = mcpCache.getStats()
      expect(stats.totalConfigs).toBe(1)
      expect(stats.totalTools).toBe(1) // Only enabled
      expect(stats.totalPrompts).toBe(1)
      expect(stats.totalResources).toBe(1)
    })
  })

  describe('clear', () => {
    it('should clear all cache', async () => {
      const mockConfig: McpEditorState = {
        id: 'test',
        name: 'Test',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [{ name: 'tool1', enabled: true, passthrough: {} }],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({ 'test.mcp': mockConfig })
      expect(mcpCache.getAllConfigs()).toHaveLength(1)

      mcpCache.clear()
      expect(mcpCache.getAllConfigs()).toHaveLength(0)
    })
  })

  describe('removeCache', () => {
    it('should remove specific config', async () => {
      const config1: McpEditorState = {
        id: 'server1',
        name: 'Server 1',
        baseUrl: 'http://localhost:8000/mcp',
        timeoutMs: 5000,
        tools: [],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      const config2: McpEditorState = {
        id: 'server2',
        name: 'Server 2',
        baseUrl: 'http://localhost:9000/mcp',
        timeoutMs: 5000,
        tools: [],
        prompts: [],
        resources: [],
        resourceTemplates: [],
        passthrough: {}
      }

      await mcpCache.loadFromStorage({
        'server1.mcp': config1,
        'server2.mcp': config2
      })

      mcpCache.removeCache('server1.mcp')
      
      const configs = mcpCache.getAllConfigs()
      expect(configs).toHaveLength(1)
      expect(configs[0].fileName).toBe('server2.mcp')
    })
  })
})
