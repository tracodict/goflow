'use client'

import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '@/stores/workspace-store'
import { useFocusedTabId } from '@/stores/pagebuilder/editor-context'
import { OpenWorkspaceDialog } from '@/components/workspace/OpenWorkspaceDialog'
import { SaveWorkspaceDialog } from '@/components/workspace/SaveWorkspaceDialog'
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from '@/components/ui/menubar'
import {
  FolderOpen,
  Save,
  FolderX,
  FileText,
  Database,
  Search,
  Workflow,
  BookText,
  Wrench,
  FolderPlus,
  FileUp,
  FileDown,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { encodeWorkspaceId } from '@/lib/workspace/id'
import type { FileTreeNode } from '@/stores/workspace-store'

export function FileMenu() {
  const { owner, repo, createFile } = useWorkspace()
  // Get the focused tab ID from context
  const focusedTabId = useFocusedTabId()
  const [showOpenDialog, setShowOpenDialog] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  const hasWorkspace = !!(owner && repo)
  const hasActiveFile = !!(focusedTabId && focusedTabId.startsWith('file:'))
  const activeFilePath = hasActiveFile ? focusedTabId.substring(5) : null

  const handleMenuAction = async (action: string) => {
    switch (action) {
      case 'open-workspace':
        setShowOpenDialog(true)
        break
      case 'save-workspace':
        setShowSaveDialog(true)
        break
      case 'close-workspace':
        if (confirm('Close workspace? Any unsaved changes will be lost.')) {
          useWorkspace.getState().closeWorkspace()
        }
        break
      case 'import-file':
        setShowImportDialog(true)
        break
      case 'save-file':
        // Get file path from focused tab (format: "file:Pages/Home.page")
        if (focusedTabId && focusedTabId.startsWith('file:')) {
          const filePath = focusedTabId.substring(5) // Remove "file:" prefix
          // Dispatch event for active editor to save
          window.dispatchEvent(new CustomEvent('goflow-save-file', {
            detail: { path: filePath }
          }))
        }
        break
      case 'export-file':
        setShowExportDialog(true)
        break
      default:
        if (action.startsWith('new-')) {
          const folderMap: Record<string, string> = {
            'new-page': 'Pages',
            'new-folder': 'Pages',
            'new-datasource': 'DataSources',
            'new-query': 'Queries',
            'new-workflow': 'Workflows',
            'new-schema': 'Schemas',
            'new-mcp-tool': 'MCPTools',
          }
          const folder = folderMap[action]
          if (folder) {
            // Prompt for file name
            const isFolder = action === 'new-folder'
            const itemType = isFolder ? 'folder' : folder.slice(0, -1).toLowerCase()
            const name = prompt(`Enter ${itemType} name:`)
            if (name) {
              if (isFolder) {
                // Create folder in Pages directory
                await createFile('Pages', name, true) // true = isFolder
              } else {
                await createFile(folder, name)
              }
            }
          }
        }
    }
  }
  
  return (
    <>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent align="start">
          <MenubarItem onClick={() => handleMenuAction('open-workspace')}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Open Workspace...
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+K Ctrl+O</span>
          </MenubarItem>
          <MenubarItem 
            onClick={() => handleMenuAction('save-workspace')}
            disabled={!hasWorkspace}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Workspace
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+S</span>
          </MenubarItem>
          <MenubarItem 
            onClick={() => handleMenuAction('close-workspace')}
            disabled={!hasWorkspace}
          >
            <FolderX className="mr-2 h-4 w-4" />
            Close Workspace
          </MenubarItem>
          
          <MenubarSeparator />
          
          <MenubarItem
            onClick={() => handleMenuAction('import-file')}
            disabled={!hasWorkspace}
          >
            <FileUp className="mr-2 h-4 w-4" />
            Import File...
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+O</span>
          </MenubarItem>
          <MenubarItem 
            onClick={() => handleMenuAction('save-file')}
            disabled={!hasActiveFile}
          >
            <Save className="mr-2 h-4 w-4" />
            Save File
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+S</span>
          </MenubarItem>
          <MenubarItem 
            onClick={() => handleMenuAction('export-file')}
            disabled={!hasActiveFile}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export File...
          </MenubarItem>
          
          <MenubarSeparator />
          
          <MenubarItem onClick={() => handleMenuAction('new-page')}>
            <FileText className="mr-2 h-4 w-4" />
            New Page
          </MenubarItem>
          <MenubarItem onClick={() => handleMenuAction('new-folder')}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </MenubarItem>
          <MenubarItem onClick={() => handleMenuAction('new-datasource')}>
            <Database className="mr-2 h-4 w-4" />
            New Data Source
          </MenubarItem>
          <MenubarItem onClick={() => handleMenuAction('new-query')}>
            <Search className="mr-2 h-4 w-4" />
            New Query
          </MenubarItem>
          <MenubarItem onClick={() => handleMenuAction('new-workflow')}>
            <Workflow className="mr-2 h-4 w-4" />
            New Workflow
          </MenubarItem>
          <MenubarItem onClick={() => handleMenuAction('new-schema')}>
            <BookText className="mr-2 h-4 w-4" />
            New Schema
          </MenubarItem>
          <MenubarItem onClick={() => handleMenuAction('new-mcp-tool')}>
            <Wrench className="mr-2 h-4 w-4" />
            New MCP Tool
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      
      <OpenWorkspaceDialog 
        open={showOpenDialog} 
        onOpenChange={setShowOpenDialog} 
      />
      <SaveWorkspaceDialog 
        open={showSaveDialog} 
        onOpenChange={setShowSaveDialog} 
      />
      <ImportFileDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
      <ExportFileDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        filePath={activeFilePath}
      />
    </>
  )
}

type ImportMapping = {
  folder: string
  canonicalExtension: string
  aliases: string[]
}

const IMPORT_MAPPINGS: ImportMapping[] = [
  { folder: 'Pages', canonicalExtension: '.page', aliases: ['.page', '.page.json'] },
  { folder: 'DataSources', canonicalExtension: '.ds', aliases: ['.ds', '.ds.json'] },
  { folder: 'Queries', canonicalExtension: '.qry', aliases: ['.qry', '.qry.json'] },
  { folder: 'Workflows', canonicalExtension: '.cpn', aliases: ['.cpn', '.cpn.json'] },
  { folder: 'Schemas', canonicalExtension: '.color', aliases: ['.color', '.color.json'] },
  { folder: 'MCPTools', canonicalExtension: '.mcp', aliases: ['.mcp', '.mcp.json'] },
]

function findImportTarget(fileName: string): ImportMapping | null {
  const lower = fileName.toLowerCase()
  for (const rule of IMPORT_MAPPINGS) {
    if (rule.aliases.some((alias) => lower.endsWith(alias))) {
      return rule
    }
  }
  return null
}

function stripJsonSuffix(name: string): string {
  return name.toLowerCase().endsWith('.json') ? name.slice(0, -5) : name
}

function ensureExtension(name: string, canonical: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith(canonical)) return name
  const lastDot = name.lastIndexOf('.')
  const base = lastDot > -1 ? name.slice(0, lastDot) : name
  return `${base}${canonical}`
}

function fileExistsInTree(tree: FileTreeNode[], targetPath: string): boolean {
  for (const node of tree) {
    if (node.type === 'file' && node.path === targetPath) {
      return true
    }
    if (node.type === 'directory' && node.children?.length) {
      if (fileExistsInTree(node.children, targetPath)) return true
    }
  }
  return false
}

type ImportFileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ImportFileDialog({ open, onOpenChange }: ImportFileDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const { workspaceId, tree, loadFileTree, openFile, saveWorkspace, reopenWorkspace } = useWorkspace((state) => ({
    workspaceId: state.workspaceId,
    tree: state.tree,
    loadFileTree: state.loadFileTree,
    openFile: state.openFile,
    saveWorkspace: state.saveWorkspace,
    reopenWorkspace: state.reopenWorkspace,
  }))

  useEffect(() => {
    if (!open) {
      setFile(null)
      setPreview('')
      setError('')
      setLoading(false)
      setDragging(false)
    }
  }, [open])

  const onPick = (f: File | null) => {
    setFile(f)
    setError('')
    setPreview('')
    if (!f) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = String(event.target?.result || '')
      setPreview(text)
    }
    reader.onerror = () => {
      setError('Failed to read file')
      setFile(null)
    }
    reader.readAsText(f)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onPick(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragging) setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const handleImport = async () => {
    if (!workspaceId) {
      setError('Open a workspace before importing files.')
      return
    }
    if (!file) {
      setError('Select a file to import.')
      return
    }
    const mapping = findImportTarget(file.name)
    if (!mapping) {
      setError('Unsupported file type. Please select a supported resource file.')
      return
    }

    const stripped = stripJsonSuffix(file.name)
    const finalName = ensureExtension(stripped, mapping.canonicalExtension)
    const targetPath = `${mapping.folder}/${finalName}`
    const basePath = `/api/ws/${encodeWorkspaceId(workspaceId)}`

    const targetExists = fileExistsInTree(tree, targetPath)
    if (targetExists && !confirm(`${finalName} already exists. Overwrite?`)) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const headers = { 'Content-Type': 'application/json' }
      if (targetExists) {
        const existingRes = await fetch(`${basePath}/file?path=${encodeURIComponent(targetPath)}`)
        if (!existingRes.ok) {
          throw new Error('Failed to load existing file metadata')
        }
        const existing = await existingRes.json()
        const updateRes = await fetch(`${basePath}/file`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ path: targetPath, content: preview, sha: existing.sha }),
        })
        if (!updateRes.ok) {
          throw new Error('Failed to overwrite existing file')
        }
      } else {
        const createRes = await fetch(`${basePath}/file`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ path: targetPath, content: preview }),
        })
        if (!createRes.ok) {
          throw new Error('Failed to create imported file')
        }
      }

      await loadFileTree()
      await openFile(targetPath)

      toast({
        title: 'File imported',
        description: targetPath,
      })

      let committed = false
      try {
        await saveWorkspace(`Import ${finalName}`)
        committed = true
      } catch (err: any) {
        console.error('Auto-commit failed after import:', err)
        toast({
          title: 'Import saved locally',
          description: 'Imported file, but automatic GitHub commit failed. Please save the workspace manually.',
          variant: 'destructive',
        })
      }

      if (committed) {
        try {
          await reopenWorkspace()
          await openFile(targetPath)
        } catch (err: any) {
          console.error('Workspace refresh failed after import:', err)
          toast({
            title: 'Workspace refresh failed',
            description: 'Imported file was committed, but the draft workspace could not be reopened automatically. Please open the workspace manually to continue.',
            variant: 'destructive',
          })
        }
      }

      onOpenChange(false)
    } catch (err: any) {
      console.error('Import failed:', err)
      setError(err?.message || 'Failed to import file')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!loading) onOpenChange(value) }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import File</DialogTitle>
          <DialogDescription>
            Upload a resource file (<code>.page</code>, <code>.ds</code>, <code>.qry</code>, <code>.cpn</code>, <code>.color</code>, <code>.mcp</code>) to add it to the workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="file"
            accept=".page,.page.json,.ds,.ds.json,.qry,.qry.json,.cpn,.cpn.json,.color,.color.json,.mcp,.mcp.json,.json"
            className="hidden"
            onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          />
          <div
            className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center text-sm transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'}`}
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <p className="font-medium">Drop file here or click to browse</p>
            <p className="mt-2 text-xs text-muted-foreground">Supported: .page, .ds, .qry, .cpn, .color, .mcp (with or without .json suffix)</p>
            {file && (
              <p className="mt-3 text-xs text-foreground">Selected: <span className="font-semibold">{file.name}</span></p>
            )}
          </div>
          {preview && (
            <textarea
              readOnly
              value={preview.slice(0, 2000)}
              className="h-48 w-full rounded-md border bg-muted/30 p-3 font-mono text-xs"
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <button
            type="button"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm"
            onClick={() => !loading && onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={handleImport}
            disabled={!file || loading}
          >
            {loading ? 'Importing…' : 'Import'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type ExportFileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string | null
}

function ExportFileDialog({ open, onOpenChange, filePath }: ExportFileDialogProps) {
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const activeFile = useWorkspace((state) => (filePath ? state.files.get(filePath) ?? null : null))

  useEffect(() => {
    if (open && filePath) {
      const defaultName = filePath.split('/').pop() || 'export.json'
      setFileName(defaultName)
      setError('')
    }
    if (!open) {
      setError('')
    }
  }, [open, filePath])

  const handleExport = async () => {
    if (!filePath || !activeFile) {
      setError('No active file to export.')
      return
    }
    const content = activeFile.content
    const name = fileName.trim() || (filePath.split('/').pop() ?? 'export.json')

    try {
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        // @ts-expect-error: showSaveFilePicker is not yet in TypeScript DOM libs for all targets
        const handle = await window.showSaveFilePicker({ suggestedName: name })
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
      } else {
        const blob = new Blob([content], { type: 'application/json' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.href = url
        link.download = name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setTimeout(() => URL.revokeObjectURL(url), 0)
      }

      toast({
        title: 'File exported',
        description: name,
      })

      onOpenChange(false)
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        onOpenChange(false)
        return
      }
      console.error('Export failed:', err)
      setError(err?.message || 'Failed to export file')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export File</DialogTitle>
          <DialogDescription>
            Select a location to save <span className="font-medium">{filePath || 'current file'}</span> to your computer.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="export-file-name">File name</label>
          <Input
            id="export-file-name"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            placeholder="example.page"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <button
            type="button"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={handleExport}
            disabled={!activeFile}
          >
            Export
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
