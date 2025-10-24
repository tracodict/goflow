"use client"
import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { FileExplorer, type FileExplorerItem } from '../FileExplorer'
import { useWorkspace, type FileTreeNode } from '@/stores/workspace-store'
import { useBuilderStore } from '@/stores/pagebuilder/editor'
import { useFocusedTabId } from '@/stores/pagebuilder/editor-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

export const PagesTab: React.FC = () => {
  const {
    owner,
    repo,
    branch,
    tree,
    loadFileTree,
  } = useWorkspace()
  
  const focusedTabId = useFocusedTabId()
  const activeFile = focusedTabId && focusedTabId.startsWith('file:') 
    ? focusedTabId.substring(5) 
    : null

  const router = useRouter()
  const { elements, hasUnsavedChanges, markAsSaved } = useBuilderStore()

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ item: FileExplorerItem } | null>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState<{ targetItem: FileExplorerItem } | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Restore from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('goflow-expanded-folders')
      if (saved) {
        try {
          return new Set(JSON.parse(saved))
        } catch (e) {
          console.error('Failed to parse saved expanded folders:', e)
        }
      }
    }
    // Default: expand "Pages" folder
    return new Set(['Pages'])
  })

  const hasWorkspace = !!(owner && repo && branch)

  // Persist expanded folders to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('goflow-expanded-folders', JSON.stringify(Array.from(expandedFolders)))
    }
  }, [expandedFolders])

  // Build tree items from workspace file tree, showing all folders
  const buildTreeItems = (): FileExplorerItem[] => {
    if (!tree || tree.length === 0) return []

    // Convert file tree nodes to FileExplorer items
    const convertNode = (node: FileTreeNode, parentPath: string = ''): FileExplorerItem => {
      const isFolder = node.type === 'directory'
      
      // Use node.path as id (the actual file path)
      // For display name, strip extensions from files only
      const displayName = isFolder 
        ? node.name 
        : node.name.replace(/\.(page|ds|qry|cpn|color|mcp)$/, '')
      
      const item: FileExplorerItem = {
        id: node.path,
        name: displayName,
        type: isFolder ? 'folder' : 'file',
        parentId: parentPath || undefined,
        isExpanded: expandedFolders.has(node.path),
        children: isFolder && node.children && node.children.length > 0 
          ? node.children.map(child => convertNode(child, node.path)) 
          : []
      }
      
      return item
    }

    // Convert all top-level folders
    return tree.map(node => convertNode(node))
  }

  const treeItems = useMemo(() => buildTreeItems(), [tree, expandedFolders])

  // Auto-select the active file when it changes
  useEffect(() => {
    if (activeFile && activeFile.startsWith('Pages/')) {
      setSelectedItemId(activeFile)
    }
  }, [activeFile])

  const handleItemSelect = (item: FileExplorerItem | undefined) => {
    if (!item) {
      setSelectedItemId(null)
      return
    }

    setSelectedItemId(item.id)

    // If it's a folder, just select it without loading anything
    if (item.type === 'folder') {
      return
    }

    // If it's a page and we have unsaved changes, show confirmation dialog
    if (item.type === 'file' && hasUnsavedChanges && activeFile && activeFile !== item.id) {
      setShowUnsavedDialog({ targetItem: item })
      return
    }

    // Proceed with page loading
    navigateToPage(item)
  }

  const navigateToPage = async (item: FileExplorerItem) => {
    if (item.type === 'file') {
      const filePath = item.id
      
      // Open the file in the workspace (will trigger file handler)
      try {
        await useWorkspace.getState().openFile(filePath)
        
        // Dispatch file open event for handlers to process
        window.dispatchEvent(new CustomEvent('goflow-file-opened', {
          detail: { path: filePath }
        }))
        
        toast({
          title: "File Opened",
          description: `${item.name}`,
        })
      } catch (error: any) {
        toast({
          title: "Failed to Open File",
          description: error.message,
          variant: "destructive",
        })
      }
    }
  }

  const handleUnsavedDialogDiscard = () => {
    if (!showUnsavedDialog) return
    
    markAsSaved()
    navigateToPage(showUnsavedDialog.targetItem)
    setShowUnsavedDialog(null)
  }

  const handleUnsavedDialogSave = async () => {
    if (!showUnsavedDialog || !activeFile) return
    
    // Trigger save event for active editor
    window.dispatchEvent(new CustomEvent('goflow-save-file', {
      detail: { path: activeFile }
    }))
    
    markAsSaved()
    navigateToPage(showUnsavedDialog.targetItem)
    setShowUnsavedDialog(null)
    
    toast({
      title: "Changes Saved",
      description: "Your changes have been saved.",
    })
  }

  const handleFolderToggle = (item: FileExplorerItem) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        next.add(item.id)
      }
      return next
    })
  }

  const handleItemDelete = async (item: FileExplorerItem) => {
    if (!hasWorkspace) {
      toast({
        title: "No Workspace",
        description: "Please open a workspace first.",
        variant: "destructive",
      })
      return
    }

    setShowDeleteDialog({ item })
  }

  const confirmDelete = async () => {
    if (!showDeleteDialog?.item || !owner || !repo || !branch) return

    const item = showDeleteDialog.item
    const path = item.id

    try {
      await useWorkspace.getState().deleteFile(path)
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      })
    }

    setShowDeleteDialog(null)
  }

  const handleItemRename = async (item: FileExplorerItem, newName: string) => {
    if (!hasWorkspace) {
      toast({
        title: "No Workspace",
        description: "Please open a workspace first.",
        variant: "destructive",
      })
      return
    }

    const trimmedName = newName.trim()
    if (!trimmedName) {
      toast({
        title: "Invalid Name",
        description: "Name cannot be empty.",
        variant: "destructive",
      })
      return
    }

    const oldPath = item.id
    const pathParts = oldPath.split('/')
    const isPage = oldPath.endsWith('.page')
    
    // Build new path
    pathParts[pathParts.length - 1] = isPage ? `${trimmedName}.page` : trimmedName
    const newPath = pathParts.join('/')

    try {
      await useWorkspace.getState().renameFile(oldPath, newPath)
    } catch (error: any) {
      toast({
        title: "Rename Failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleItemMove = async (itemId: string, newParentId: string | undefined) => {
    if (!hasWorkspace) {
      toast({
        title: "No Workspace",
        description: "Please open a workspace first.",
        variant: "destructive",
      })
      return
    }

    const oldPath = itemId
    const fileName = oldPath.split('/').pop()!
    const newParentPath = newParentId || 'Pages'
    const newPath = `${newParentPath}/${fileName}`

    if (oldPath === newPath) return // No change

    try {
      await useWorkspace.getState().renameFile(oldPath, newPath)
    } catch (error: any) {
      toast({
        title: "Move Failed",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleItemAdd = async (parentItem: FileExplorerItem | null, itemType: 'file' | 'folder') => {
    if (!hasWorkspace) {
      toast({
        title: "No Workspace",
        description: "Please open a workspace first.",
        variant: "destructive",
      })
      return
    }

    // Determine the folder to add to
    let targetFolder: string
    
    if (parentItem) {
      // Adding to a folder
      if (parentItem.type === 'folder') {
        targetFolder = parentItem.id
      } else {
        toast({
          title: "Invalid Action",
          description: "Can only add files to folders.",
          variant: "destructive",
        })
        return
      }
    } else {
      // Adding as sibling - default to Pages folder for now
      targetFolder = 'Pages'
    }

    // Prompt for name
    const defaultName = itemType === 'folder' ? 'New Folder' : 'new-page'
    const name = prompt(`Enter ${itemType} name:`, defaultName)
    
    if (!name || !name.trim()) {
      return // Cancelled or empty
    }

    try {
      await useWorkspace.getState().createFile(targetFolder, name.trim(), itemType === 'folder')
      
      // Expand the parent folder if it's not already expanded
      if (parentItem && parentItem.type === 'folder' && !expandedFolders.has(parentItem.id)) {
        setExpandedFolders(prev => {
          const next = new Set(prev)
          next.add(parentItem.id)
          return next
        })
      }
    } catch (error: any) {
      toast({
        title: `Failed to create ${itemType}`,
        description: error.message,
        variant: "destructive",
      })
    }
  }

  if (!hasWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-muted-foreground mb-4">
          No workspace open. Please open a workspace from the File menu.
        </p>
        <Button onClick={() => {
          // Trigger open workspace dialog via File menu
          const fileMenuTrigger = document.querySelector('[data-radix-collection-item]') as HTMLElement
          fileMenuTrigger?.click()
        }}>
          Open Workspace
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <FileExplorer
        items={treeItems}
        selectedItemId={selectedItemId || undefined}
        activeItemId={activeFile || undefined}
        onItemSelect={handleItemSelect}
        onItemDelete={handleItemDelete}
        onItemRename={handleItemRename}
        onItemAdd={handleItemAdd}
        onItemMove={handleItemMove}
        onFolderToggle={handleFolderToggle}
        showActions={true} // Enable trash button and rename
        className="flex-1"
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete "{showDeleteDialog?.item.name}"?
              {showDeleteDialog?.item.type === 'folder' && (
                <span className="text-destructive">
                  <br />
                  This will also delete all pages and folders inside it.
                </span>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog open={!!showUnsavedDialog} onOpenChange={() => setShowUnsavedDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              You have unsaved changes in the current page. What would you like to do?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnsavedDialog(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleUnsavedDialogDiscard}>
              Discard Changes
            </Button>
            <Button onClick={handleUnsavedDialogSave}>
              Save & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
