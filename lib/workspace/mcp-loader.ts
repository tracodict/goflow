import { Octokit } from '@octokit/rest'
import { promises as fs } from 'fs'
import path from 'path'
import type { McpEditorState } from '@/components/builder/mcp-utils'

export interface McpLoaderOptions {
  provider: 'github' | 'fs'
  // GitHub options
  token?: string
  owner?: string
  repo?: string
  branch?: string
  // Filesystem options
  workspacePath?: string
}

/**
 * Load all .mcp files from workspace (GitHub or filesystem)
 */
export async function loadMcpFiles(options: McpLoaderOptions): Promise<Record<string, McpEditorState>> {
  if (options.provider === 'github') {
    return loadMcpFilesFromGitHub(options)
  }
  return loadMcpFilesFromFilesystem(options)
}

async function loadMcpFilesFromGitHub(options: McpLoaderOptions): Promise<Record<string, McpEditorState>> {
  const { token, owner, repo, branch = 'main' } = options
  
  if (!token || !owner || !repo) {
    throw new Error('GitHub token, owner, and repo are required')
  }

  const octokit = new Octokit({ auth: token })
  const mcpConfigs: Record<string, McpEditorState> = {}

  try {
    // Get repository tree
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })

    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: refData.object.sha,
      recursive: 'true'
    })

    // Find all .mcp files in MCPTools folder
    const mcpFiles = tree.tree.filter(item =>
      item.path?.startsWith('MCPTools/') &&
      item.path?.endsWith('.mcp') &&
      item.type === 'blob'
    )

    // Load each .mcp file
    for (const file of mcpFiles) {
      if (!file.path) continue

      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file.path,
          ref: branch
        })

        if (Array.isArray(data) || !('content' in data)) continue

        const content = Buffer.from(data.content, 'base64').toString('utf-8')
        const config = JSON.parse(content)

        const fileName = file.path.split('/').pop() || file.path
        mcpConfigs[fileName] = config
      } catch (e) {
        console.error(`[mcp-loader] Failed to load ${file.path}:`, e)
      }
    }

    return mcpConfigs
  } catch (error) {
    console.error('[mcp-loader] GitHub error:', error)
    throw error
  }
}

async function loadMcpFilesFromFilesystem(options: McpLoaderOptions): Promise<Record<string, McpEditorState>> {
  const { workspacePath } = options

  if (!workspacePath) {
    throw new Error('workspacePath is required for filesystem provider')
  }

  const mcpConfigs: Record<string, McpEditorState> = {}
  const mcpToolsPath = path.join(workspacePath, 'MCPTools')

  try {
    // Check if MCPTools folder exists
    const stat = await fs.stat(mcpToolsPath)
    if (!stat.isDirectory()) {
      return mcpConfigs
    }

    // Read all files in MCPTools folder
    const files = await fs.readdir(mcpToolsPath)
    const mcpFiles = files.filter(f => f.endsWith('.mcp'))

    // Load each .mcp file
    for (const fileName of mcpFiles) {
      try {
        const filePath = path.join(mcpToolsPath, fileName)
        const content = await fs.readFile(filePath, 'utf-8')
        const config = JSON.parse(content)
        mcpConfigs[fileName] = config
      } catch (e) {
        console.error(`[mcp-loader] Failed to load ${fileName}:`, e)
      }
    }

    return mcpConfigs
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // MCPTools folder doesn't exist, return empty
      return mcpConfigs
    }
    console.error('[mcp-loader] Filesystem error:', error)
    throw error
  }
}
