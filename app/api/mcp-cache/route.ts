import { NextRequest, NextResponse } from 'next/server'
import { mcpCache } from '@/lib/mcp-cache'

export const runtime = 'nodejs'

/**
 * GET /api/mcp-cache - Get cache statistics and available prompts/tools
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'stats' | 'prompts' | 'tools' | 'all'

  try {
    if (type === 'stats') {
      const stats = mcpCache.getStats()
      return NextResponse.json({ success: true, data: stats })
    }

    if (type === 'prompts') {
      const prompts = mcpCache.getEnabledPrompts()
      return NextResponse.json({ success: true, data: prompts })
    }

    if (type === 'tools') {
      const tools = mcpCache.getEnabledTools()
      return NextResponse.json({ success: true, data: tools })
    }

    // Default: return all
    const stats = mcpCache.getStats()
    const prompts = mcpCache.getEnabledPrompts()
    const tools = mcpCache.getEnabledTools()
    
    return NextResponse.json({
      success: true,
      data: {
        stats,
        prompts,
        tools
      }
    })
  } catch (error: any) {
    console.error('[mcp-cache] GET error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to get cache data' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/mcp-cache - Load MCP configurations from workspace
 * Expected body: { workspaceId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { 
      workspaceId?: string
      baseUrl?: string
    }
    
    const workspaceId = body.workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { success: false, message: 'Missing workspaceId in request body' },
        { status: 400 }
      )
    }

    console.log('[mcp-cache] Loading MCP files for workspace:', workspaceId)
    
    // Use workspace API to fetch MCP files (already handles auth)
    // Priority: 1. baseUrl from body, 2. referer header, 3. req.url origin
    const baseUrl = body.baseUrl 
      || (req.headers.get('referer') ? new URL(req.headers.get('referer')!).origin : null)
      || new URL(req.url).origin
    
    console.log('[mcp-cache] Using baseUrl:', baseUrl)
    
    // Fetch tree to find all .mcp files in MCPTools folder
    const treeUrl = `${baseUrl}/api/ws/${encodeURIComponent(workspaceId)}/tree?path=MCPTools`
    console.log('[mcp-cache] Fetching tree from:', treeUrl)
    
    const treeRes = await fetch(treeUrl, {
      headers: {
        'Cookie': req.headers.get('Cookie') || ''
      }
    })
    
    if (!treeRes.ok) {
      console.error('[mcp-cache] Tree fetch failed:', treeRes.status, treeRes.statusText)
      return NextResponse.json(
        { success: false, message: `Failed to fetch workspace tree: ${treeRes.statusText}` },
        { status: treeRes.status }
      )
    }
    
    const treeData = await treeRes.json()
    console.log('[mcp-cache] Tree data:', JSON.stringify(treeData, null, 2))
    
    // Find MCPTools directory in the tree
    const mcpToolsDir = Array.isArray(treeData) 
      ? treeData.find((item: any) => item.name === 'MCPTools' && item.type === 'directory')
      : null
    
    if (!mcpToolsDir) {
      console.log('[mcp-cache] MCPTools directory not found in workspace')
      return NextResponse.json({
        success: true,
        message: 'No MCPTools directory found in workspace',
        data: { totalConfigs: 0, totalTools: 0, totalPrompts: 0, totalResources: 0 }
      })
    }
    
    // Get .mcp files from MCPTools children
    const mcpFiles = (mcpToolsDir.children || [])
      .filter((item: any) => item.type === 'file' && item.name?.endsWith('.mcp'))
    
    console.log('[mcp-cache] Found', mcpFiles.length, '.mcp files:', mcpFiles.map((f: any) => f.name))
    
    // Fetch each .mcp file content
    const mcpConfigs: Record<string, any> = {}
    
    for (const file of mcpFiles) {
      const filePath = file.path
      const fileName = filePath.split('/').pop() || filePath
      
      const fileUrl = `${baseUrl}/api/ws/${encodeURIComponent(workspaceId)}/file?path=${encodeURIComponent(filePath)}`
      console.log('[mcp-cache] Fetching file:', fileName, 'from', fileUrl)
      
      try {
        const fileRes = await fetch(fileUrl, {
          headers: {
            'Cookie': req.headers.get('Cookie') || ''
          }
        })
        
        if (!fileRes.ok) {
          console.error('[mcp-cache] File fetch failed:', fileName, fileRes.status)
          continue
        }
        
        const fileData = await fileRes.json()
        const content = fileData.data || ''
        
        mcpConfigs[fileName] = content
        console.log('[mcp-cache] Loaded config from', fileName, '- tools:', content.tools?.length || 0)
      } catch (fetchError) {
        console.error('[mcp-cache] Failed to fetch', fileName, fetchError)
      }
    }

    await mcpCache.loadFromStorage(mcpConfigs)
    
    const stats = mcpCache.getStats()
    
    console.log('[mcp-cache] Loaded MCP cache:', stats)
    
    return NextResponse.json({
      success: true,
      message: `Loaded ${stats.totalConfigs} MCP configurations from workspace`,
      data: stats
    })
  } catch (error: any) {
    console.error('[mcp-cache] POST error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load cache' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/mcp-cache - Clear cache
 */
export async function DELETE(req: NextRequest) {
  try {
    mcpCache.clear()
    
    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    })
  } catch (error: any) {
    console.error('[mcp-cache] DELETE error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to clear cache' },
      { status: 500 }
    )
  }
}
