'use client'

import { useState } from 'react'
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
  File,
  FilePlus,
  FileText,
  Database,
  Search,
  Workflow,
  BookText,
  Wrench,
  FolderPlus,
} from 'lucide-react'

export function FileMenu() {
  const { owner, repo, createFile } = useWorkspace()
  // Get the focused tab ID from context
  const focusedTabId = useFocusedTabId()
  const [showOpenDialog, setShowOpenDialog] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const hasWorkspace = !!(owner && repo)
  const hasActiveFile = !!(focusedTabId && focusedTabId.startsWith('file:'))

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
      case 'open-file':
        // TODO: Implement file browser dialog
        alert('File browser dialog not yet implemented')
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
      case 'save-file-as':
        // TODO: Implement save-as dialog
        alert('Save As dialog not yet implemented')
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
          
          <MenubarItem onClick={() => handleMenuAction('open-file')}>
            <File className="mr-2 h-4 w-4" />
            Open File...
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
            onClick={() => handleMenuAction('save-file-as')}
            disabled={!hasActiveFile}
          >
            <FilePlus className="mr-2 h-4 w-4" />
            Save File As...
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
    </>
  )
}
