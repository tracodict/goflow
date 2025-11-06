import { create } from 'zustand'
import { toast } from '@/hooks/use-toast'
import { buildGitHubWorkspaceId, encodeWorkspaceId } from '@/lib/workspace/id'
import type { WorkspaceProvider } from '@/lib/workspace/provider'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  extension?: string
  sha?: string
  children?: FileTreeNode[]
}

export interface WorkspaceFile {
  path: string
  type: 'page' | 'datasource' | 'query' | 'workflow' | 'schema' | 'mcp'
  content: string
  sha: string
  dirty: boolean
  data?: unknown
}

const WORKSPACE_STORAGE_KEY = 'goflow-workspace'
const WORKSPACE_PROVIDER: WorkspaceProvider = (process.env.NEXT_PUBLIC_WORKSPACE_PROVIDER as WorkspaceProvider) || 'github'

interface WorkspaceState {
  provider: WorkspaceProvider
  workspaceId: string | null
  owner: string | null
  repo: string | null
  branch: string | null
  baseBranch: string
  files: Map<string, WorkspaceFile>
  tree: FileTreeNode[]
  isRestoring: boolean
  
  openWorkspace: (params: { owner: string; repo: string }) => Promise<void>
  reopenWorkspace: () => Promise<void>
  closeWorkspace: () => void
  restoreWorkspace: () => Promise<void>
  loadFileTree: () => Promise<void>
  openFile: (path: string) => Promise<void>
  saveFile: (path: string, content: string) => Promise<void>
  saveWorkspace: (commitMessage: string) => Promise<void>
  createFile: (folder: string, name: string, isFolder?: boolean) => Promise<void>
  deleteFile: (path: string) => Promise<void>
  renameFile: (oldPath: string, newPath: string) => Promise<void>
  markFileDirty: (path: string, dirty: boolean) => void
}

function getFileTypeFromPath(path: string): WorkspaceFile['type'] {
  if (path.endsWith('.page')) return 'page'
  if (path.endsWith('.ds')) return 'datasource'
  if (path.endsWith('.qry')) return 'query'
  if (path.endsWith('.cpn')) return 'workflow'
  if (path.endsWith('.color')) return 'schema'
  if (path.endsWith('.mcp')) return 'mcp'
  return 'page'
}

function getFolderExtension(folder: string): string {
  const map: Record<string, string> = {
    'Pages': 'page',
    'DataSources': 'ds',
    'Queries': 'qry',
    'Workflows': 'cpn',
    'Schemas': 'color',
    'MCPTools': 'mcp'
  }
  return map[folder] || 'page'
}

function getFileTemplate(extension: string): string {
  const templates: Record<string, string> = {
    'page': JSON.stringify({ components: [], layout: 'default' }, null, 2),
    'ds': JSON.stringify({ type: 'mongodb', config: {} }, null, 2),
    'qry': JSON.stringify({ query_type: 'sql', query: 'SELECT 1' }, null, 2),
    'cpn': JSON.stringify({ places: [], transitions: [], arcs: [] }, null, 2),
    'color': JSON.stringify({ name: '', fields: [] }, null, 2),
  'mcp': JSON.stringify({ id: '', name: '', baseUrl: '', timeoutMs: 8000, tools: [], resources: [] }, null, 2),
  }
  return templates[extension] || '{}'
}

function getWorkspaceBasePath(workspaceId: string | null) {
  if (!workspaceId) return null
  return `/api/ws/${encodeWorkspaceId(workspaceId)}`
}

interface StoredWorkspace {
  provider: WorkspaceProvider
  workspaceId: string
  owner: string
  repo: string
  branch: string
  baseBranch: string
}

function loadWorkspaceFromStorage(): StoredWorkspace | null {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as StoredWorkspace
  } catch (error) {
    console.warn('Failed to parse stored workspace payload:', error)
    localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    return null
  }
}

function saveWorkspaceToStorage(payload: StoredWorkspace) {
  if (typeof window === 'undefined') return
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload))
}

function clearWorkspaceStorage() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(WORKSPACE_STORAGE_KEY)
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  provider: WORKSPACE_PROVIDER,
  workspaceId: null,
  owner: null,
  repo: null,
  branch: null,
  baseBranch: 'main',
  files: new Map(),
  tree: [],
  isRestoring: typeof window !== 'undefined' && loadWorkspaceFromStorage() !== null,

  openWorkspace: async ({ owner, repo }) => {
    if (WORKSPACE_PROVIDER !== 'github') {
      const message = 'Only the GitHub workspace provider is currently supported.'
      toast({
        title: 'Unsupported workspace provider',
        description: message,
        variant: 'destructive'
      })
      throw new Error(message)
    }

    try {
      const tempBranch = `goflow-${Date.now()}`
      const baseBranch = 'main'
      const workspaceId = buildGitHubWorkspaceId({ owner, repo, branch: tempBranch })
      const basePath = getWorkspaceBasePath(workspaceId)

      if (!basePath) {
        throw new Error('Failed to resolve workspace path')
      }

      const headers = { 'Content-Type': 'application/json' }

      const openRes = await fetch(`${basePath}/open`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ baseBranch })
      })

      if (!openRes.ok) {
        const error = await openRes.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to open workspace')
      }

      const initRes = await fetch(`${basePath}/init-folders`, {
        method: 'POST',
        headers
      })

      if (!initRes.ok) {
        const error = await initRes.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to initialize workspace folders')
      }

      set({
        provider: WORKSPACE_PROVIDER,
        workspaceId,
        owner,
        repo,
        branch: tempBranch,
        baseBranch,
        files: new Map(),
        tree: [],
        isRestoring: false
      })

      saveWorkspaceToStorage({
        provider: WORKSPACE_PROVIDER,
        workspaceId,
        owner,
        repo,
        branch: tempBranch,
        baseBranch
      })

      await get().loadFileTree()

      toast({
        title: 'Workspace opened',
        description: `${owner}/${repo} (branch: ${tempBranch})`
      })
    } catch (error: any) {
      toast({
        title: 'Failed to open workspace',
        description: error?.message || 'Unknown error',
        variant: 'destructive'
      })
      throw error
    }
  },

  reopenWorkspace: async () => {
    const { owner, repo } = get()
    if (!owner || !repo) {
      console.warn('reopenWorkspace called without an active workspace')
      return
    }
    try {
      await get().openWorkspace({ owner, repo })
    } catch (error) {
      console.error('Workspace reopen failed:', error)
    }
  },

  closeWorkspace: () => {
    set({
      workspaceId: null,
      owner: null,
      repo: null,
      branch: null,
      baseBranch: 'main',
      files: new Map(),
      tree: [],
      isRestoring: false
    })

    clearWorkspaceStorage()

    toast({
      title: 'Workspace closed'
    })
  },

  restoreWorkspace: async () => {
    if (typeof window === 'undefined') return

    const saved = loadWorkspaceFromStorage()
    if (!saved) {
      set({ isRestoring: false })
      return
    }

    if (saved.provider !== WORKSPACE_PROVIDER) {
      clearWorkspaceStorage()
      set({ isRestoring: false })
      return
    }

    const basePath = getWorkspaceBasePath(saved.workspaceId)
    if (!basePath) {
      clearWorkspaceStorage()
      set({ isRestoring: false })
      return
    }

    set({
      provider: WORKSPACE_PROVIDER,
      workspaceId: saved.workspaceId,
      owner: saved.owner,
      repo: saved.repo,
      branch: saved.branch,
      baseBranch: saved.baseBranch,
      isRestoring: true
    })

    try {
      const res = await fetch(`${basePath}/tree`)
      if (!res.ok) {
        let errorMessage = 'Failed to load file tree'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If we can't parse the error response, use the status text
          errorMessage = res.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const tree = await res.json()
      set({ tree, isRestoring: false })

      toast({
        title: 'Workspace restored',
        description: `${saved.owner}/${saved.repo}`
      })
    } catch (error: any) {
      console.error('Workspace restore failed:', error)
      
      let errorMessage = 'Failed to load file tree'
      if (error?.message) {
        errorMessage = error.message
      }
      
      clearWorkspaceStorage()
      set({
        workspaceId: null,
        owner: null,
        repo: null,
        branch: null,
        baseBranch: 'main',
        files: new Map(),
        tree: [],
        isRestoring: false
      })

      toast({
        title: 'Failed to restore workspace',
        description: errorMessage,
        variant: 'destructive'
      })
    }
  },

  loadFileTree: async () => {
    const { workspaceId } = get()
    const basePath = getWorkspaceBasePath(workspaceId)
    if (!basePath) return

    try {
      const res = await fetch(`${basePath}/tree`)

      if (!res.ok) {
        throw new Error('Failed to load file tree')
      }

      const tree = await res.json()
      set({ tree })
      return tree
    } catch (error: any) {
      toast({
        title: 'Failed to load file tree',
        description: error?.message || 'Unknown error',
        variant: 'destructive'
      })
      throw error
    }
  },

  openFile: async (path: string) => {
    let { workspaceId, files, isRestoring } = get()

    if (isRestoring) {
      await new Promise<void>((resolve) => {
        const start = Date.now()
        const interval = setInterval(() => {
          const state = get()
          if (!state.isRestoring || Date.now() - start > 10000) {
            clearInterval(interval)
            resolve()
          }
        }, 100)
      })

      ;({ workspaceId, files, isRestoring } = get())
    }

    if (!workspaceId) return

    if (files.has(path)) {
      return
    }

    const basePath = getWorkspaceBasePath(workspaceId)
    if (!basePath) return

    try {
      const res = await fetch(`${basePath}/file?path=${encodeURIComponent(path)}`)

      if (!res.ok) {
        throw new Error('Failed to load file')
      }

      const payload = await res.json()
      const shaHeader = res.headers.get('x-github-file-sha')
      const sha = typeof shaHeader === 'string' && shaHeader.length > 0 ? shaHeader : payload?.sha
      if (!sha) {
        throw new Error('Missing file sha in response')
      }

      const rawData = payload?.data ?? null
      const type = getFileTypeFromPath(path)

      let content: string
      if (typeof rawData === 'string') {
        content = rawData
      } else if (rawData && typeof rawData === 'object') {
        try {
          content = JSON.stringify(rawData, null, 2)
        } catch {
          content = ''
        }
      } else {
        content = ''
      }

      files.set(path, { path, type, content, sha, dirty: false, data: rawData })
      set({ files: new Map(files) })
    } catch (error: any) {
      toast({
        title: 'Failed to open file',
        description: error?.message || 'Unknown error',
        variant: 'destructive'
      })
    }
  },

  saveFile: async (path: string, content: string) => {
    const { workspaceId, files } = get()
    const file = files.get(path)

    if (!workspaceId || !file) return

    const basePath = getWorkspaceBasePath(workspaceId)
    if (!basePath) return

    try {
      const res = await fetch(`${basePath}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content, sha: file.sha })
      })

      if (!res.ok) {
        throw new Error('Failed to save file')
      }

      const { sha: newSha } = await res.json()

      file.content = content
      file.sha = newSha
      file.dirty = false
      try {
        file.data = JSON.parse(content)
      } catch {
        file.data = content
      }

      set({ files: new Map(files) })

      toast({
        title: 'File saved',
        description: path
      })
    } catch (error: any) {
      toast({
        title: 'Failed to save file',
        description: error?.message || 'Unknown error',
        variant: 'destructive'
      })
    }
  },

  saveWorkspace: async (commitMessage: string) => {
    const { workspaceId, baseBranch } = get()
    if (!workspaceId) return

    const basePath = getWorkspaceBasePath(workspaceId)
    if (!basePath) return

    try {
      const res = await fetch(`${basePath}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitMessage, baseBranch })
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to save workspace')
      }

      toast({
        title: 'Workspace saved',
        description: 'Changes merged to main branch'
      })
    } catch (error: any) {
      toast({
        title: 'Failed to save workspace',
        description: error?.message || 'Unknown error',
        variant: 'destructive'
      })
      throw error
    }
  },

  createFile: async (folder: string, name: string, isFolder?: boolean) => {
    const { workspaceId } = get()
    if (!workspaceId) return

    const basePath = getWorkspaceBasePath(workspaceId)
    if (!basePath) return

    const headers = { 'Content-Type': 'application/json' }

    try {
      if (isFolder) {
        const path = `${folder}/${name}/.gitkeep`
        const res = await fetch(`${basePath}/file`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ path, content: '' })
        })

        if (!res.ok) {
          throw new Error('Failed to create folder')
        }

        await get().loadFileTree()

        toast({
          title: 'Folder created',
          description: `${folder}/${name}`
        })
      } else {
        const extension = getFolderExtension(folder)
        const path = `${folder}/${name}.${extension}`
        const template = getFileTemplate(extension)

        const res = await fetch(`${basePath}/file`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ path, content: template })
        })

        if (!res.ok) {
          throw new Error('Failed to create file')
        }

        await get().loadFileTree()
        await get().openFile(path)

        toast({
          title: 'File created',
          description: path
        })
      }
    } catch (error: any) {
      toast({
        title: isFolder ? 'Failed to create folder' : 'Failed to create file',
        description: error?.message || 'Unknown error',
        variant: 'destructive'
      })
    }
  },

  deleteFile: async (path: string) => {
    const { workspaceId, files } = get()
    if (!workspaceId) return

    const basePath = getWorkspaceBasePath(workspaceId)
    if (!basePath) return

    try {
      const fileRes = await fetch(`${basePath}/file?path=${encodeURIComponent(path)}`)

      if (!fileRes.ok) {
        throw new Error('Failed to fetch file for deletion')
      }

      const payload = await fileRes.json()
      const shaHeader = fileRes.headers.get('x-github-file-sha')
      const sha = typeof shaHeader === 'string' && shaHeader.length > 0 ? shaHeader : payload?.sha
      if (!sha) {
        throw new Error('Missing file sha in response')
      }

      const res = await fetch(`${basePath}/file`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, sha })
      })

      if (!res.ok) {
        throw new Error('Failed to delete file')
      }

      files.delete(path)
      set({ files: new Map(files) })

      await get().loadFileTree()

      toast({
        title: 'File deleted',
        description: path
      })
    } catch (error: any) {
      toast({
        title: 'Failed to delete file',
        description: error?.message || 'Unknown error',
        variant: 'destructive'
      })
    }
  },

  renameFile: async (oldPath: string, newPath: string) => {
    const { workspaceId, files } = get()
    if (!workspaceId) return

    const basePath = getWorkspaceBasePath(workspaceId)
    if (!basePath) return

    try {
      const fileRes = await fetch(`${basePath}/file?path=${encodeURIComponent(oldPath)}`)

      if (!fileRes.ok) {
        throw new Error('Failed to fetch file for rename')
      }

      const payload = await fileRes.json()
      const shaHeader = fileRes.headers.get('x-github-file-sha')
      const oldSha = typeof shaHeader === 'string' && shaHeader.length > 0 ? shaHeader : payload?.sha
      if (!oldSha) {
        throw new Error('Missing file sha in response')
      }

      const rawData = payload?.data ?? null
      let content: string
      if (typeof rawData === 'string') {
        content = rawData
      } else if (rawData && typeof rawData === 'object') {
        try {
          content = JSON.stringify(rawData, null, 2)
        } catch {
          content = ''
        }
      } else {
        content = ''
      }

      let updatedContent = content
      if (oldPath.endsWith('.ds') && newPath.endsWith('.ds')) {
        try {
          const dsData = JSON.parse(content)
          const oldFileName = oldPath.split('/').pop()?.replace('.ds', '')
          const newFileName = newPath.split('/').pop()?.replace('.ds', '')

          if (dsData.id === oldFileName && newFileName) {
            dsData.id = newFileName
            updatedContent = JSON.stringify(dsData, null, 2)
          }
        } catch (error) {
          console.warn('Failed to update datasource ID during rename:', error)
        }
      }

      const headers = { 'Content-Type': 'application/json' }

      const createRes = await fetch(`${basePath}/file`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ path: newPath, content: updatedContent })
      })

      if (!createRes.ok) {
        throw new Error('Failed to create renamed file')
      }

      const deleteRes = await fetch(`${basePath}/file`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ path: oldPath, sha: oldSha })
      })

      if (!deleteRes.ok) {
        throw new Error('Failed to delete old file')
      }

      const oldFile = files.get(oldPath)
      if (oldFile) {
        files.delete(oldPath)
        let nextData: unknown = rawData
        if (updatedContent !== content) {
          try {
            nextData = JSON.parse(updatedContent)
          } catch {
            nextData = updatedContent
          }
        }
        files.set(newPath, { ...oldFile, path: newPath, content: updatedContent, data: nextData })
        set({ files: new Map(files) })
      }

      await get().loadFileTree()

      toast({
        title: 'File renamed',
        description: `${oldPath} → ${newPath}`
      })
    } catch (error: any) {
      toast({
        title: 'Failed to rename file',
        description: error?.message || 'Unknown error',
        variant: 'destructive'
      })
    }
  },

  markFileDirty: (path: string, dirty: boolean) => {
    const { files } = get()
    const file = files.get(path)

    if (!file) return

    if (file.dirty === dirty) return

    file.dirty = dirty
    set({ files: new Map(files) })
  }
}))
