"use client"
import React, { useState, useEffect, useMemo } from 'react'
import { FileExplorer, type FileExplorerItem } from '../FileExplorer'
import { usePagesStore, type PageItem } from '@/stores/pages'
import { useBuilderStore } from '@/stores/pagebuilder/editor'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'

type PageTreeItem = PageItem & {
  children?: PageTreeItem[]
}

export const PagesTab: React.FC = () => {
  const {
    pages,
    activePageId,
    selectedItemId,
    addPage,
    addFolder,
    deletePage,
    deleteFolder,
    renamePage,
    renameFolder,
    movePage,
    setActivePage,
    setSelectedItem,
    toggleFolder,
    updatePageElements,
    getPageTree,
    findPageById,
  } = usePagesStore()

  const { elements, selectElement, addElement, removeElement, hasUnsavedChanges, markAsSaved, loadElements } = useBuilderStore()

  const [showAddDialog, setShowAddDialog] = useState<{ type: 'page' | 'folder'; parentId?: string } | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ item: FileExplorerItem } | null>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState<{ targetItem: FileExplorerItem } | null>(null)
  const [itemName, setItemName] = useState('')

  // Helper function to load page elements into the builder
  const loadPageElements = (pageElements: Record<string, any>) => {
    // Clear current elements (except page-root)
    const currentElementIds = Object.keys(elements).filter(id => id !== 'page-root')
    currentElementIds.forEach(id => removeElement(id))
    
    // Add page elements (skip page-root as it should already exist)
    Object.entries(pageElements).forEach(([id, element]) => {
      if (id !== 'page-root' && element) {
        addElement(element, element.parentId)
      }
    })
  }

    // Convert pages to FileExplorer format
  const buildTreeItems = (): FileExplorerItem[] => {
    const pageTree = getPageTree() // This returns a hierarchical tree structure

    const convertToFileExplorerItem = (page: PageTreeItem): FileExplorerItem => {
      const item: FileExplorerItem = {
        id: page.id,
        name: page.name,
        type: page.type === 'page' ? 'file' : 'folder',
        parentId: page.parentId,
        isExpanded: page.isExpanded,
        children: []
      }
      
      // Recursively convert children if they exist
      if (page.children && page.children.length > 0) {
        item.children = page.children.map(convertToFileExplorerItem)
      }
      
      return item
    }

    const rootItems = (pageTree as PageTreeItem[]).map(convertToFileExplorerItem)
    return rootItems
  }

  const treeItems = useMemo(() => buildTreeItems(), [pages])

  // Auto-select the active page's parent folder when component mounts or active page changes
  useEffect(() => {
    if (activePageId) {
      const activePage = findPageById(activePageId)
      if (activePage) {
        // If the active page has a parent folder, select it
        if (activePage.parentId) {
          setSelectedItem(activePage.parentId)
        } else {
          // If it's at root level, select the page itself
          setSelectedItem(activePageId)
        }
      }
    }
  }, [activePageId, findPageById, setSelectedItem])

  const handleItemSelect = (item: FileExplorerItem | undefined) => {
    if (!item) {
      // Clicked empty space - deselect all
      setSelectedItem(null)
      return
    }

    // Always update the selected item for both folders and pages
    setSelectedItem(item.id)

    // If it's a folder, just select it without loading anything
    if (item.type === 'folder') {
      return
    }

    // If it's a page and we have unsaved changes, show confirmation dialog
    if (item.type === 'file' && hasUnsavedChanges && activePageId && activePageId !== item.id) {
      setShowUnsavedDialog({ targetItem: item })
      return
    }

    // Proceed with page loading
    loadPageInBuilder(item)
  }

  const loadPageInBuilder = (item: FileExplorerItem) => {
    // If it's a page, load it in the builder
    if (item.type === 'file') {
      const page = findPageById(item.id)
      if (page) {
        // Save current page elements if there's an active page
        if (activePageId && activePageId !== item.id) {
          const currentPage = findPageById(activePageId)
          if (currentPage) {
            updatePageElements(activePageId, elements)
          }
        }

        // Load the selected page
        setActivePage(item.id)
        loadPageElements(page.elements)
        selectElement(null) // Clear selection in builder
        markAsSaved() // Mark the newly loaded page as saved
        
        toast({
          title: "Page Loaded",
          description: `Now editing: ${page.name}`,
        })
      }
    }
  }

  const proceedWithPageSelection = (item: FileExplorerItem) => {
    setSelectedItem(item.id)
    loadPageInBuilder(item)
  }

  const handleUnsavedDialogDiscard = () => {
    if (!showUnsavedDialog) return
    
    // Discard changes and proceed with selection
    markAsSaved() // Clear the unsaved changes flag
    loadPageInBuilder(showUnsavedDialog.targetItem)
    setShowUnsavedDialog(null)
  }

  const handleUnsavedDialogSave = () => {
    if (!showUnsavedDialog || !activePageId) return
    
    // Save current page elements
    const currentPage = findPageById(activePageId)
    if (currentPage) {
      updatePageElements(activePageId, elements)
      markAsSaved()
    }
    
    // Proceed with selection
    loadPageInBuilder(showUnsavedDialog.targetItem)
    setShowUnsavedDialog(null)
    
    toast({
      title: "Changes Saved",
      description: "Your changes have been saved.",
    })
  }

  const handleFolderToggle = (item: FileExplorerItem) => {
    toggleFolder(item.id)
  }

  const handleAddFolder = (parentId?: string) => {
    // If no parentId provided, determine based on selection:
    // 1. If selected item is a folder -> add as child of that folder
    // 2. If selected item is a page -> add as sibling (same parent as selected page)
    // 3. If nothing selected -> add to root
    let targetParentId = parentId
    if (!targetParentId && selectedItemId) {
      const selectedItem = pages.find(p => p.id === selectedItemId)
      if (selectedItem?.type === 'folder') {
        // Add as child of selected folder
        targetParentId = selectedItemId
      } else if (selectedItem?.type === 'page') {
        // Add as sibling of selected page (same parent)
        targetParentId = selectedItem.parentId
      }
    }
    
    setShowAddDialog({ type: 'folder', parentId: targetParentId })
    setItemName('')
  }

  const handleAddFile = (parentId?: string) => {
    // If no parentId provided, determine based on selection:
    // 1. If selected item is a folder -> add as child of that folder
    // 2. If selected item is a page -> add as sibling (same parent as selected page)
    // 3. If nothing selected -> add to root
    let targetParentId = parentId
    if (!targetParentId && selectedItemId) {
      const selectedItem = pages.find(p => p.id === selectedItemId)
      if (selectedItem?.type === 'folder') {
        // Add as child of selected folder
        targetParentId = selectedItemId
      } else if (selectedItem?.type === 'page') {
        // Add as sibling of selected page (same parent)
        targetParentId = selectedItem.parentId
      }
    }
    
    setShowAddDialog({ type: 'page', parentId: targetParentId })
    setItemName('')
  }

  const handleItemDelete = (item: FileExplorerItem) => {
    setShowDeleteDialog({ item })
  }

  const handleItemRename = (item: FileExplorerItem, newName: string) => {
    // Don't allow renaming the Home page
    if (item.type === 'file') {
      const page = findPageById(item.id)
      if (page?.name.toLowerCase() === 'home') {
        toast({
          title: "Cannot Rename",
          description: "The Home page cannot be renamed.",
          variant: "destructive",
        })
        return
      }
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

    // Check for duplicate names in the same parent
    const parentId = pages.find(p => p.id === item.id)?.parentId
    const siblings = pages.filter(p => p.parentId === parentId && p.id !== item.id)
    const isDuplicate = siblings.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())
    
    if (isDuplicate) {
      toast({
        title: "Duplicate Name",
        description: "An item with this name already exists in this location.",
        variant: "destructive",
      })
      return
    }

    // Perform the rename
    if (item.type === 'file') {
      renamePage(item.id, trimmedName)
      toast({
        title: "Page Renamed",
        description: `Renamed to: ${trimmedName}`,
      })
    } else {
      renameFolder(item.id, trimmedName)
      toast({
        title: "Folder Renamed", 
        description: `Renamed to: ${trimmedName}`,
      })
    }
  }

  const handleItemMove = (itemId: string, newParentId: string | undefined) => {
    // Don't allow moving the Home page
    const item = findPageById(itemId)
    if (item?.name.toLowerCase() === 'home') {
      toast({
        title: "Cannot Move",
        description: "The Home page cannot be moved.",
        variant: "destructive",
      })
      return
    }

    // Prevent moving into self or descendants
    if (newParentId === itemId) {
      return
    }

    // Check if newParentId is a descendant of itemId
    const isDescendant = (parentId: string, childId: string): boolean => {
      const parent = findPageById(parentId)
      if (!parent) return false
      
      const children = pages.filter(p => p.parentId === parentId)
      return children.some(child => 
        child.id === childId || isDescendant(child.id, childId)
      )
    }

    if (newParentId && isDescendant(itemId, newParentId)) {
      toast({
        title: "Invalid Move",
        description: "Cannot move a folder into its own subfolder.",
        variant: "destructive",
      })
      return
    }

    // Check for duplicate names in the target location
    const siblings = pages.filter(p => p.parentId === newParentId && p.id !== itemId)
    const isDuplicate = siblings.some(p => p.name.toLowerCase() === item?.name.toLowerCase())
    
    if (isDuplicate) {
      toast({
        title: "Duplicate Name",
        description: "An item with this name already exists in the target location.",
        variant: "destructive",
      })
      return
    }

    // Perform the move
    movePage(itemId, newParentId)
    
    const targetName = newParentId ? 
      findPageById(newParentId)?.name || 'Unknown' : 
      'Root'
    
    toast({
      title: "Item Moved",
      description: `Moved "${item?.name}" to ${targetName}`,
    })
  }

  const confirmAdd = () => {
    if (!itemName.trim()) return

    const name = itemName.trim()
    
    // Check for duplicate names in the same parent
    const siblings = pages.filter(p => p.parentId === showAddDialog?.parentId)
    const isDuplicate = siblings.some(p => p.name.toLowerCase() === name.toLowerCase())
    
    if (isDuplicate) {
      toast({
        title: "Error",
        description: "An item with this name already exists in this location.",
        variant: "destructive",
      })
      return
    }

    if (showAddDialog?.type === 'page') {
      const newPageId = addPage(name, showAddDialog.parentId)
      toast({
        title: "Page Created",
        description: `Created new page: ${name}`,
      })
    } else if (showAddDialog?.type === 'folder') {
      addFolder(name, showAddDialog.parentId)
      toast({
        title: "Folder Created",
        description: `Created new folder: ${name}`,
      })
    }

    setShowAddDialog(null)
    setItemName('')
  }

  const confirmDelete = () => {
    if (!showDeleteDialog?.item) return

    const item = showDeleteDialog.item

    if (item.type === 'file') {
      // Don't allow deleting the Home page
      const page = findPageById(item.id)
      if (page?.name.toLowerCase() === 'home') {
        toast({
          title: "Cannot Delete",
          description: "The Home page cannot be deleted.",
          variant: "destructive",
        })
        setShowDeleteDialog(null)
        return
      }

      deletePage(item.id)
      toast({
        title: "Page Deleted",
        description: `Deleted page: ${item.name}`,
      })
    } else {
      deleteFolder(item.id)
      toast({
        title: "Folder Deleted",
        description: `Deleted folder and all its contents: ${item.name}`,
      })
    }

    setShowDeleteDialog(null)
  }

  return (
    <div className="flex flex-col h-full">
      <FileExplorer
        items={treeItems}
        selectedItemId={selectedItemId || undefined}
        activeItemId={activePageId || undefined}
        onItemSelect={handleItemSelect}
        onItemDelete={handleItemDelete}
        onItemRename={handleItemRename}
        onItemMove={handleItemMove}
        onFolderToggle={handleFolderToggle}
        onAddFolder={handleAddFolder}
        onAddFile={handleAddFile}
        showActions={true}
        title="Pages"
        className="flex-1"
      />

      {/* Add Dialog */}
      <Dialog open={!!showAddDialog} onOpenChange={() => setShowAddDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create New {showAddDialog?.type === 'page' ? 'Page' : 'Folder'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={`Enter ${showAddDialog?.type} name...`}
                onKeyDown={(e) => e.key === 'Enter' && confirmAdd()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(null)}>
              Cancel
            </Button>
            <Button onClick={confirmAdd} disabled={!itemName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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