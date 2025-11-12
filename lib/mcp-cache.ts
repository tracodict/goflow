import type { McpEditorState } from '@/components/builder/mcp-utils'

export interface McpCacheEntry {
  fileName: string
  config: McpEditorState
  loadedAt: Date
}

export interface McpTool {
  name: string
  description?: string
  inputSchema?: any
  baseUrl: string
  type?: 'STDIO' | 'SSE' | 'HTTP'
  timeoutMs?: number
  serverName?: string
}

export interface McpPrompt {
  name: string
  description?: string
  baseUrl: string
  type?: 'STDIO' | 'SSE' | 'HTTP'
  timeoutMs?: number
  serverName?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

class McpCache {
  private cache = new Map<string, McpCacheEntry>()
  private loading = false

  /**
   * Load MCP configurations from workspace storage
   * This is called during app initialization
   */
  async loadFromStorage(mcpConfigs: Record<string, McpEditorState>): Promise<void> {
    if (this.loading) return
    this.loading = true

    try {
      for (const [fileName, config] of Object.entries(mcpConfigs)) {
        this.cache.set(fileName, {
          fileName,
          config,
          loadedAt: new Date()
        })
      }

      console.log(`[mcp-cache] Loaded ${this.cache.size} MCP configurations`)
    } catch (err) {
      console.error('[mcp-cache] Failed to load MCP configs:', err)
    } finally {
      this.loading = false
    }
  }

  /**
   * Update cache when MCP config is saved
   */
  updateCache(fileName: string, config: McpEditorState): void {
    this.cache.set(fileName, {
      fileName,
      config,
      loadedAt: new Date()
    })
    console.log(`[mcp-cache] Updated cache for ${fileName}`)
  }

  /**
   * Remove a config from cache
   */
  removeCache(fileName: string): void {
    this.cache.delete(fileName)
    console.log(`[mcp-cache] Removed ${fileName} from cache`)
  }

  /**
   * Get all cached MCP configurations
   */
  getAllConfigs(): McpCacheEntry[] {
    return Array.from(this.cache.values())
  }

  /**
   * Get all enabled tools from all MCP servers
   */
  getEnabledTools(): McpTool[] {
    const tools: McpTool[] = []
    
    for (const entry of this.cache.values()) {
      const enabledTools = entry.config.tools?.filter(t => t.enabled !== false) || []
      for (const tool of enabledTools) {
        tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: (tool as any).inputSchema,
          baseUrl: entry.config.baseUrl,
          type: entry.config.type,
          timeoutMs: entry.config.timeoutMs,
          serverName: entry.config.name || entry.fileName
        })
      }
    }
    
    return tools
  }

  /**
   * Get all enabled prompts from all MCP servers
   */
  getEnabledPrompts(): McpPrompt[] {
    const prompts: McpPrompt[] = []
    
    for (const entry of this.cache.values()) {
      const enabledPrompts = entry.config.prompts?.filter(p => p.enabled !== false) || []
      for (const prompt of enabledPrompts) {
        prompts.push({
          name: prompt.name,
          description: prompt.description,
          baseUrl: entry.config.baseUrl,
          type: entry.config.type,
          timeoutMs: entry.config.timeoutMs,
          serverName: entry.config.name || entry.fileName,
          arguments: (prompt as any).arguments || []
        })
      }
    }
    
    return prompts
  }

  /**
   * Get all enabled resources from all MCP servers
   */
  getEnabledResources(): Array<{ name: string; uri?: string; baseUrl: string }> {
    const resources: Array<{ name: string; uri?: string; baseUrl: string }> = []
    
    for (const entry of this.cache.values()) {
      const enabledResources = entry.config.resources?.filter((r: any) => r.enabled !== false) || []
      for (const resource of enabledResources) {
        resources.push({
          name: resource.name,
          uri: resource.uri,
          baseUrl: entry.config.baseUrl
        })
      }
    }
    
    return resources
  }

  /**
   * Find a prompt by name
   */
  findPrompt(name: string): McpPrompt | undefined {
    const prompts = this.getEnabledPrompts()
    return prompts.find(p => p.name === name)
  }

  /**
   * Find a tool by name
   */
  findTool(name: string): McpTool | undefined {
    const tools = this.getEnabledTools()
    return tools.find(t => t.name === name)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    console.log('[mcp-cache] Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      totalConfigs: this.cache.size,
      totalTools: this.getEnabledTools().length,
      totalPrompts: this.getEnabledPrompts().length,
      totalResources: this.getEnabledResources().length
    }
  }
}

// Singleton instance - ensure it's globally shared in development
const globalForMcpCache = globalThis as unknown as {
  mcpCache: McpCache | undefined
}

export const mcpCache = globalForMcpCache.mcpCache ?? new McpCache()

if (process.env.NODE_ENV !== 'production') {
  globalForMcpCache.mcpCache = mcpCache
}
