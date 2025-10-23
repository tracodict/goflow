import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getTokenFromSession } from '@/lib/github-session'
import type { FileTreeNode } from '@/stores/workspace-store'

export async function GET(request: NextRequest) {
  const token = await getTokenFromSession()
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const octokit = new Octokit({ auth: token })
  const { searchParams } = request.nextUrl
  const owner = searchParams.get('owner')!
  const repo = searchParams.get('repo')!
  const branch = searchParams.get('branch')!
  
  try {
    // Get branch reference first
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })
    
    // Get tree recursively
    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: ref.object.sha,
      recursive: 'true'
    })
    
    // Filter to only GoFlow folders and build tree structure
    const goflowFolders = ['Pages', 'DataSources', 'Queries', 'Workflows', 'Schemas', 'MCPTools']
    const filteredTree = tree.tree
      .filter(item => 
        goflowFolders.some(folder => item.path?.startsWith(folder)) &&
        !item.path?.endsWith('.gitkeep')
      )
      .map(item => ({
        path: item.path || '',
        type: item.type,
        sha: item.sha,
        size: item.size
      }))
    
    // Build hierarchical tree
    const hierarchical = buildFileTree(filteredTree)
    
    return NextResponse.json(hierarchical)
  } catch (error: any) {
    console.error('GitHub tree error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load file tree' }, 
      { status: 500 }
    )
  }
}

function buildFileTree(files: any[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  const folders = ['Pages', 'DataSources', 'Queries', 'Workflows', 'Schemas', 'MCPTools']
  
  folders.forEach(folder => {
    const folderFiles = files.filter(f => f.path.startsWith(folder + '/'))
    
    root.push({
      name: folder,
      path: folder,
      type: 'directory',
      children: buildTreeRecursive(folderFiles, folder)
    })
  })
  
  return root
}

function buildTreeRecursive(files: any[], basePath: string): FileTreeNode[] {
  const children: FileTreeNode[] = []
  const prefix = basePath + '/'
  
  // Get only files that are direct children or descendants of this path
  const relevantFiles = files.filter(f => f.path.startsWith(prefix))
  
  // Group by immediate child
  const groups = new Map<string, any[]>()
  
  relevantFiles.forEach(file => {
    const relativePath = file.path.slice(prefix.length)
    if (!relativePath) return // Skip if path equals basePath
    
    const parts = relativePath.split('/')
    const immediate = parts[0]
    
    if (!groups.has(immediate)) {
      groups.set(immediate, [])
    }
    groups.get(immediate)!.push(file)
  })
  
  groups.forEach((groupFiles, name) => {
    const firstFile = groupFiles[0]
    const relativePath = firstFile.path.slice(prefix.length)
    const isLeafFile = !relativePath.includes('/') && firstFile.type === 'blob'
    
    if (isLeafFile) {
      // Leaf file
      const extension = name.split('.').pop()!
      children.push({
        name,
        path: firstFile.path,
        type: 'file',
        extension,
        sha: firstFile.sha
      })
    } else {
      // Directory - recurse with the same files list (they will be filtered in the recursive call)
      const dirPath = basePath + '/' + name
      children.push({
        name,
        path: dirPath,
        type: 'directory',
        children: buildTreeRecursive(files, dirPath)
      })
    }
  })
  
  return children.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'directory' ? -1 : 1
  })
}
