import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getTokenFromSession } from '@/lib/github-session'
import { parseGitHubWorkspaceId } from '@/lib/workspace/id'
import type { FileTreeNode } from '@/stores/workspace-store'

type RouteParams = {
  params: {
    workspaceId: string
  }
}

const GOFLOW_FOLDERS = ['Pages', 'DataSources', 'Queries', 'Workflows', 'Schemas', 'MCPTools']

export async function GET(_: NextRequest, context: RouteParams) {
  const token = await getTokenFromSession()

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const octokit = new Octokit({ auth: token })
  const { workspaceId } = await context.params
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)

  try {
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })

    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: ref.object.sha,
      recursive: 'true'
    })

    const filteredTree = tree.tree
      .filter(item =>
        GOFLOW_FOLDERS.some(folder => item.path?.startsWith(folder)) &&
        !item.path?.endsWith('.gitkeep')
      )
      .map(item => ({
        path: item.path || '',
        type: item.type,
        sha: item.sha,
        size: item.size
      }))

    const hierarchical = buildFileTree(filteredTree)

    return NextResponse.json(hierarchical)
  } catch (error: any) {
    console.error('GitHub tree error:', error)
    
    let errorMessage = 'Failed to load file tree'
    if (error?.status === 404) {
      errorMessage = `Repository or branch not found: ${owner}/${repo}@${branch}`
    } else if (error?.status === 403) {
      errorMessage = `Access denied to repository: ${owner}/${repo}. Check your permissions.`
    } else if (error?.status === 401) {
      errorMessage = 'GitHub authentication failed. Please re-authenticate.'
    } else if (error?.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

function buildFileTree(files: any[]): FileTreeNode[] {
  const root: FileTreeNode[] = []

  GOFLOW_FOLDERS.forEach(folder => {
    const folderFiles = files.filter((f: any) => f.path.startsWith(folder + '/'))

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

  const relevantFiles = files.filter((f: any) => f.path.startsWith(prefix))

  const groups = new Map<string, any[]>()

  relevantFiles.forEach(file => {
    const relativePath = file.path.slice(prefix.length)
    if (!relativePath) return

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
      const extension = name.split('.').pop()!
      children.push({
        name,
        path: firstFile.path,
        type: 'file',
        extension,
        sha: firstFile.sha
      })
    } else {
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
