import { create } from 'zustand'
import { toast } from '@/hooks/use-toast'

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
}

interface WorkspaceState {
  owner: string | null
  repo: string | null
  branch: string | null
  baseBranch: string
  files: Map<string, WorkspaceFile>
  tree: FileTreeNode[]
  isRestoring: boolean
  
  openWorkspace: (params: { owner: string; repo: string }) => Promise<void>
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
    'mcp': JSON.stringify({ command: '', args: [] }, null, 2),
  }
  return templates[extension] || '{}'
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  owner: null,
  repo: null,
  branch: null,
  baseBranch: 'main',
  files: new Map(),
  tree: [],
  // Initialize isRestoring to true if there's saved workspace data
  isRestoring: typeof window !== 'undefined' && !!localStorage.getItem('goflow-workspace'),
  
  openWorkspace: async ({ owner, repo }) => {
    try {
      const tempBranch = `goflow-${Date.now()}`
      
      // 1. Create temp branch from main
      const openRes = await fetch('/api/github/workspace/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, baseBranch: 'main', tempBranch })
      })
      
      if (!openRes.ok) {
        const error = await openRes.json()
        throw new Error(error.error || 'Failed to open workspace')
      }
      
      // 2. Ensure folder structure exists
      await fetch('/api/github/workspace/init-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, branch: tempBranch })
      })
      
      set({ owner, repo, branch: tempBranch, baseBranch: 'main', tree: [] })
      
      // 3. Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('goflow-workspace', JSON.stringify({ owner, repo, branch: tempBranch }))
      }
      
      // 4. Load file tree
      await get().loadFileTree()
      
      toast({
        title: 'Workspace opened',
        description: `${owner}/${repo} (branch: ${tempBranch})`,
      })
    } catch (error: any) {
      toast({
        title: 'Failed to open workspace',
        description: error.message,
        variant: 'destructive'
      })
      throw error
    }
  },
  
  closeWorkspace: () => {
    set({
      owner: null,
      repo: null,
      branch: null,
      files: new Map(),
      tree: []
    })
    
    // Remove from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('goflow-workspace')
    }
    
    toast({
      title: 'Workspace closed',
    })
  },
  
  restoreWorkspace: async () => {
    // Try to restore workspace from localStorage
    if (typeof window === 'undefined') return
    
    const saved = localStorage.getItem('goflow-workspace')
    if (!saved) {
      set({ isRestoring: false })
      return
    }
    
    set({ isRestoring: true })
    
    try {
      const { owner, repo, branch } = JSON.parse(saved)
      
      // Validate the branch still exists
      const res = await fetch(
        `/api/github/workspace/tree?owner=${owner}&repo=${repo}&branch=${branch}`
      )
      
      if (res.ok) {
        // Branch exists, restore the workspace
        const tree = await res.json()
        set({ owner, repo, branch, baseBranch: 'main', tree, isRestoring: false })
        
        toast({
          title: 'Workspace restored',
          description: `${owner}/${repo}`,
        })
      } else {
        // Branch doesn't exist, clear localStorage
        localStorage.removeItem('goflow-workspace')
        set({ isRestoring: false })
      }
    } catch (error) {
      // Invalid data in localStorage, clear it
      localStorage.removeItem('goflow-workspace')
      set({ isRestoring: false })
    }
  },
  
  loadFileTree: async () => {
    const { owner, repo, branch } = get()
    
    if (!owner || !repo || !branch) return
    
    try {
      const res = await fetch(
        `/api/github/workspace/tree?owner=${owner}&repo=${repo}&branch=${branch}`
      )
      
      if (!res.ok) {
        throw new Error('Failed to load file tree')
      }
      
      const tree = await res.json()
      set({ tree })
    } catch (error: any) {
      toast({
        title: 'Failed to load file tree',
        description: error.message,
        variant: 'destructive'
      })
    }
  },
  
  openFile: async (path: string) => {
    // Wait for workspace restoration to complete
    let { owner, repo, branch, files, isRestoring } = get()
    
    // If workspace is still restoring, wait for it
    if (isRestoring) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const state = get()
          if (!state.isRestoring) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval)
          resolve()
        }, 10000)
      })
      
      // Refresh state after waiting
      ;({ owner, repo, branch, files } = get())
    }
    
    // Check if already loaded
    if (files.has(path)) {
      // File already loaded, nothing more to do
      return
    }
    
    if (!owner || !repo || !branch) return
    
    try {
      const res = await fetch(
        `/api/github/workspace/file?owner=${owner}&repo=${repo}&branch=${branch}&path=${encodeURIComponent(path)}`
      )
      
      if (!res.ok) {
        throw new Error('Failed to load file')
      }
      
      const { content, sha } = await res.json()
      const type = getFileTypeFromPath(path)
      
      files.set(path, { path, type, content, sha, dirty: false })
      set({ files: new Map(files) })
    } catch (error: any) {
      toast({
        title: 'Failed to open file',
        description: error.message,
        variant: 'destructive'
      })
    }
  },
  
  saveFile: async (path: string, content: string) => {
    const { owner, repo, branch, files } = get()
    const file = files.get(path)
    
    if (!file || !owner || !repo || !branch) return
    
    try {
      const res = await fetch('/api/github/workspace/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, branch, path, content, sha: file.sha })
      })
      
      if (!res.ok) {
        throw new Error('Failed to save file')
      }
      
      const { sha: newSha } = await res.json()
      
      file.content = content
      file.sha = newSha
      file.dirty = false
      
      set({ files: new Map(files) })
      
      toast({
        title: 'File saved',
        description: path,
      })
    } catch (error: any) {
      toast({
        title: 'Failed to save file',
        description: error.message,
        variant: 'destructive'
      })
    }
  },
  
  saveWorkspace: async (commitMessage: string) => {
    const { owner, repo, branch, baseBranch } = get()
    
    if (!owner || !repo || !branch) return
    
    try {
      const res = await fetch('/api/github/workspace/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, branch, baseBranch, commitMessage })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save workspace')
      }
      
      toast({
        title: 'Workspace saved',
        description: 'Changes merged to main branch',
      })
    } catch (error: any) {
      toast({
        title: 'Failed to save workspace',
        description: error.message,
        variant: 'destructive'
      })
      throw error
    }
  },
  
  createFile: async (folder: string, name: string, isFolder?: boolean) => {
    const { owner, repo, branch } = get()
    
    if (!owner || !repo || !branch) return
    
    if (isFolder) {
      // Create folder by creating a .gitkeep file inside it
      const path = `${folder}/${name}/.gitkeep`
      
      try {
        const res = await fetch('/api/github/workspace/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner, repo, branch, path, content: '' })
        })
        
        if (!res.ok) {
          throw new Error('Failed to create folder')
        }
        
        await get().loadFileTree()
        
        toast({
          title: 'Folder created',
          description: `${folder}/${name}`,
        })
      } catch (error: any) {
        toast({
          title: 'Failed to create folder',
          description: error.message,
          variant: 'destructive'
        })
      }
    } else {
      const extension = getFolderExtension(folder)
      const path = `${folder}/${name}.${extension}`
      const template = getFileTemplate(extension)
      
      try {
        const res = await fetch('/api/github/workspace/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner, repo, branch, path, content: template })
        })
        
        if (!res.ok) {
          throw new Error('Failed to create file')
        }
        
        await get().loadFileTree()
        await get().openFile(path)
        
        toast({
          title: 'File created',
          description: path,
        })
      } catch (error: any) {
        toast({
          title: 'Failed to create file',
          description: error.message,
          variant: 'destructive'
        })
      }
    }
  },
  
  deleteFile: async (path: string) => {
    const { owner, repo, branch, files } = get()
    
    if (!owner || !repo || !branch) return
    
    try {
      // Get file SHA first
      const fileRes = await fetch(
        `/api/github/workspace/file?owner=${owner}&repo=${repo}&branch=${branch}&path=${path}`
      )
      
      if (!fileRes.ok) {
        throw new Error('Failed to fetch file for deletion')
      }
      
      const { sha } = await fileRes.json()
      
      // Delete the file
      const res = await fetch('/api/github/workspace/file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, branch, path, sha })
      })
      
      if (!res.ok) {
        throw new Error('Failed to delete file')
      }
      
      // Remove from local state
      files.delete(path)
      set({ files: new Map(files) })
      
      // Reload file tree
      await get().loadFileTree()
      
      toast({
        title: 'File deleted',
        description: path,
      })
    } catch (error: any) {
      toast({
        title: 'Failed to delete file',
        description: error.message,
        variant: 'destructive'
      })
    }
  },
  
  renameFile: async (oldPath: string, newPath: string) => {
    const { owner, repo, branch, files } = get()
    
    if (!owner || !repo || !branch) return
    
    try {
      // Get the old file content and SHA
      const fileRes = await fetch(
        `/api/github/workspace/file?owner=${owner}&repo=${repo}&branch=${branch}&path=${oldPath}`
      )
      
      if (!fileRes.ok) {
        throw new Error('Failed to fetch file for rename')
      }
      
      const { content, sha: oldSha } = await fileRes.json()
      
      // Create new file with same content
      const createRes = await fetch('/api/github/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, branch, path: newPath, content })
      })
      
      if (!createRes.ok) {
        throw new Error('Failed to create renamed file')
      }
      
      // Delete old file
      const deleteRes = await fetch('/api/github/workspace/file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, branch, path: oldPath, sha: oldSha })
      })
      
      if (!deleteRes.ok) {
        throw new Error('Failed to delete old file')
      }
      
      // Update local state
      const oldFile = files.get(oldPath)
      if (oldFile) {
        files.delete(oldPath)
        files.set(newPath, { ...oldFile, path: newPath })
        set({ files: new Map(files) })
      }
      
      // Reload file tree
      await get().loadFileTree()
      
      toast({
        title: 'File renamed',
        description: `${oldPath} → ${newPath}`,
      })
    } catch (error: any) {
      toast({
        title: 'Failed to rename file',
        description: error.message,
        variant: 'destructive'
      })
    }
  },
  
  markFileDirty: (path: string, dirty: boolean) => {
    const { files } = get()
    const file = files.get(path)
    
    if (file) {
      file.dirty = dirty
      set({ files: new Map(files) })
    }
  },
}))
