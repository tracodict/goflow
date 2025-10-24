"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useBuilderStore } from "@/stores/pagebuilder/editor"
import { useWorkspace } from "@/stores/workspace-store"
import { PageWorkspace } from "./PageWorkspace"
import { FlowWorkspace } from "../petri/flow-workspace"
import DataWorkspace from "@/components/data/DataWorkspace"
import { SchemaViewer } from "./SchemaViewer"
import { VerticalToolbar } from "./VerticalToolbar"
import type { JSONSchema } from "@/jsonjoy-builder/src/types/jsonSchema"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  X, 
  SplitSquareVertical, 
  SplitSquareHorizontal, 
  FileText, 
  ExternalLink,
  Layout,
  Database,
  Palette,
  Workflow as WorkflowIcon,
  Search,
  Puzzle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

// Editor types
type EditorType = 'page' | 'schema' | 'query' | 'workflow' | 'datasource' | 'mcp'

interface EditorTab {
  id: string
  title: string
  type: EditorType
  filePath?: string
  data?: any
}

interface DragState {
  tab: EditorTab
  sourcePanelId: string
}

interface SplitPanelConfig {
  id: string
  type: 'horizontal' | 'vertical'
  children: (SplitPanelConfig | EditorPanelConfig)[]
  sizes: number[] // Percentage sizes for each child
}

interface EditorPanelConfig {
  id: string
  tabs: EditorTab[]
  activeTabId: string | null
}

type PanelConfig = SplitPanelConfig | EditorPanelConfig

function isSplitPanel(config: PanelConfig): config is SplitPanelConfig {
  return 'children' in config
}

// Get icon component for file type
function getFileTypeIcon(type: EditorType) {
  switch (type) {
    case 'page':
      return Layout
    case 'datasource':
      return Database
    case 'schema':
      return Palette
    case 'workflow':
      return WorkflowIcon
    case 'query':
      return Search
    case 'mcp':
      return Puzzle
    default:
      return FileText
  }
}

interface MainPanelProps {
  activeTab: string
  selectedSchema: { name: string; schema: JSONSchema } | null
  onSchemaChange: (schema: JSONSchema) => void
  onSchemaClose: () => void
  leftPanelWidth: number
  rightPanelWidth: number
  isLeftPanelOpen: boolean
  isRightPanelOpen: boolean
}

const STORAGE_KEY = 'goflow-main-panel-state'

export const MainPanel: React.FC<MainPanelProps> = ({
  activeTab,
  selectedSchema,
  onSchemaChange,
  onSchemaClose,
  leftPanelWidth,
  rightPanelWidth,
  isLeftPanelOpen,
  isRightPanelOpen,
}) => {
  const { isPreviewMode, canvasScale } = useBuilderStore()
  const { files, saveFile, markFileDirty } = useWorkspace()

  // Drag and drop state
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTargetPanelId, setDropTargetPanelId] = useState<string | null>(null)
  
  // Close confirmation dialog state
  const [closeConfirmation, setCloseConfirmation] = useState<{
    panelId: string
    tabId: string
    filePath: string
  } | null>(null)

  // Initialize root panel configuration
  const [rootPanel, setRootPanel] = useState<PanelConfig>(() => {
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse saved panel state:', e)
        }
      }
    }
    
    // Default configuration
    return {
      id: 'root',
      tabs: [{
        id: 'welcome',
        title: 'Welcome',
        type: 'page',
      }],
      activeTabId: 'welcome',
    } as EditorPanelConfig
  })

  // Persist to localStorage whenever rootPanel changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rootPanel))
    }
  }, [rootPanel])

  // Listen for file open events
  useEffect(() => {
    const handleFileOpened = (e: CustomEvent) => {
      const { path } = e.detail
      openFileInTab(path)
    }

    window.addEventListener('goflow-file-opened', handleFileOpened as EventListener)
    return () => {
      window.removeEventListener('goflow-file-opened', handleFileOpened as EventListener)
    }
  }, [])

  const openFileInTab = useCallback((filePath: string) => {
    const fileName = filePath.split('/').pop() || filePath
    const extension = fileName.split('.').pop()
    
    let type: EditorType = 'page'
    if (extension === 'page') type = 'page'
    else if (extension === 'color') type = 'schema'
    else if (extension === 'qry') type = 'query'
    else if (extension === 'cpn') type = 'workflow'
    else if (extension === 'ds') type = 'datasource'
    else if (extension === 'mcp') type = 'mcp'

    const tabId = `file:${filePath}`
    const title = fileName.replace(/\.(page|color|qry|cpn|ds|mcp)$/, '')

    // Find the first editor panel (for simplicity, open in root or first child)
    setRootPanel(prev => {
      const addTabToPanel = (panel: PanelConfig): PanelConfig => {
        if (isSplitPanel(panel)) {
          // Add to first child panel
          return {
            ...panel,
            children: panel.children.map((child, idx) => 
              idx === 0 ? addTabToPanel(child) : child
            )
          }
        } else {
          // Check if tab already exists
          const existingTab = panel.tabs.find(t => t.id === tabId)
          if (existingTab) {
            // Tab exists, just activate it
            return { ...panel, activeTabId: tabId }
          }
          // Add new tab
          return {
            ...panel,
            tabs: [...panel.tabs, { id: tabId, title, type, filePath }],
            activeTabId: tabId,
          }
        }
      }
      return addTabToPanel(prev)
    })
  }, [])

  const splitPanel = (panelId: string, direction: 'horizontal' | 'vertical') => {
    setRootPanel(prev => {
      const splitPanelRecursive = (panel: PanelConfig): PanelConfig => {
        if (isSplitPanel(panel)) {
          return {
            ...panel,
            children: panel.children.map(child => splitPanelRecursive(child))
          }
        } else if (panel.id === panelId) {
          // Split this panel
          return {
            id: `split-${Date.now()}`,
            type: direction,
            children: [
              panel,
              {
                id: `panel-${Date.now()}`,
                tabs: [{
                  id: `new-${Date.now()}`,
                  title: 'New Tab',
                  type: 'page',
                }],
                activeTabId: `new-${Date.now()}`,
              }
            ],
            sizes: [50, 50]
          } as SplitPanelConfig
        }
        return panel
      }
      return splitPanelRecursive(prev)
    })
  }

  const closeTab = (panelId: string, tabId: string, force: boolean = false) => {
    // Find the tab to check if it has unsaved changes
    const findTab = (panel: PanelConfig): EditorTab | null => {
      if (isSplitPanel(panel)) {
        for (const child of panel.children) {
          const found = findTab(child)
          if (found) return found
        }
        return null
      } else if (panel.id === panelId) {
        return panel.tabs.find(t => t.id === tabId) || null
      }
      return null
    }
    
    const tab = findTab(rootPanel)
    
    // Check if file has unsaved changes
    if (!force && tab?.filePath) {
      const file = files.get(tab.filePath)
      if (file?.dirty) {
        setCloseConfirmation({ panelId, tabId, filePath: tab.filePath })
        return
      }
    }
    
    // Proceed with closing
    setRootPanel(prev => {
      const closeTabRecursive = (panel: PanelConfig): PanelConfig | null => {
        if (isSplitPanel(panel)) {
          const newChildren = panel.children
            .map(child => closeTabRecursive(child))
            .filter(Boolean) as PanelConfig[]
          
          if (newChildren.length === 0) return null
          if (newChildren.length === 1) return newChildren[0]
          
          return { ...panel, children: newChildren }
        } else if (panel.id === panelId) {
          const newTabs = panel.tabs.filter(t => t.id !== tabId)
          if (newTabs.length === 0) return null
          
          return {
            ...panel,
            tabs: newTabs,
            activeTabId: panel.activeTabId === tabId 
              ? newTabs[0]?.id || null 
              : panel.activeTabId
          }
        }
        return panel
      }
      return closeTabRecursive(prev) || {
        id: 'root',
        tabs: [],
        activeTabId: null,
      } as EditorPanelConfig
    })
  }
  
  const handleCloseConfirmSave = async () => {
    if (!closeConfirmation) return
    
    const file = files.get(closeConfirmation.filePath)
    if (file) {
      try {
        await saveFile(file.path, file.content)
        closeTab(closeConfirmation.panelId, closeConfirmation.tabId, true)
        setCloseConfirmation(null)
      } catch (error) {
        // Error already shown by saveFile
      }
    }
  }
  
  const handleCloseConfirmDiscard = () => {
    if (!closeConfirmation) return
    closeTab(closeConfirmation.panelId, closeConfirmation.tabId, true)
    setCloseConfirmation(null)
  }

  const setActiveTab = (panelId: string, tabId: string) => {
    setRootPanel(prev => {
      const setActiveRecursive = (panel: PanelConfig): PanelConfig => {
        if (isSplitPanel(panel)) {
          return {
            ...panel,
            children: panel.children.map(child => setActiveRecursive(child))
          }
        } else if (panel.id === panelId) {
          return { ...panel, activeTabId: tabId }
        }
        return panel
      }
      return setActiveRecursive(prev)
    })
  }

  // Drag and drop handlers
  const handleTabDragStart = (e: React.DragEvent, panelId: string, tab: EditorTab) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tab.id) // For compatibility
    setDragState({ tab, sourcePanelId: panelId })
  }

  const handleTabDragEnd = () => {
    setDragState(null)
    setDropTargetPanelId(null)
  }

  const handlePanelDragOver = (e: React.DragEvent, panelId: string) => {
    if (!dragState) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetPanelId(panelId)
  }

  const handlePanelDragLeave = (e: React.DragEvent, panelId: string) => {
    // Only clear if we're actually leaving this panel (not entering a child)
    if (e.currentTarget === e.target) {
      setDropTargetPanelId(null)
    }
  }

  const handlePanelDrop = (e: React.DragEvent, targetPanelId: string) => {
    e.preventDefault()
    if (!dragState) return

    const { tab, sourcePanelId } = dragState

    // Don't do anything if dropping on same panel
    if (sourcePanelId === targetPanelId) {
      setDragState(null)
      setDropTargetPanelId(null)
      return
    }

    // Move tab from source to target panel
    setRootPanel(prev => {
      const moveTabRecursive = (panel: PanelConfig): PanelConfig => {
        if (isSplitPanel(panel)) {
          return {
            ...panel,
            children: panel.children.map(child => moveTabRecursive(child))
          }
        }

        // Remove from source panel
        if (panel.id === sourcePanelId) {
          const newTabs = panel.tabs.filter(t => t.id !== tab.id)
          return {
            ...panel,
            tabs: newTabs,
            activeTabId: panel.activeTabId === tab.id 
              ? newTabs[0]?.id || null 
              : panel.activeTabId
          }
        }

        // Add to target panel
        if (panel.id === targetPanelId) {
          return {
            ...panel,
            tabs: [...panel.tabs, tab],
            activeTabId: tab.id
          }
        }

        return panel
      }

      return moveTabRecursive(prev)
    })

    setDragState(null)
    setDropTargetPanelId(null)
  }

  // Pop out tab to new window
  const handlePopOutTab = (panelId: string, tab: EditorTab) => {
    // Create a new window with tab data
    const width = 1200
    const height = 800
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const newWindow = window.open(
      '',
      `goflow-${tab.id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    )

    if (newWindow) {
      // Store tab data in window name for retrieval
      const tabData = JSON.stringify(tab)
      newWindow.name = `goflow-tab:${tabData}`

      // Build the standalone page
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${tab.title} - GoFlow</title>
            <meta charset="utf-8">
            <style>
              body { 
                margin: 0; 
                padding: 0; 
                font-family: system-ui, -apple-system, sans-serif;
                background: #09090b;
                color: #fafafa;
              }
              .header {
                height: 40px;
                border-bottom: 1px solid #27272a;
                display: flex;
                align-items: center;
                padding: 0 16px;
                background: #18181b;
              }
              .content {
                height: calc(100vh - 40px);
                overflow: auto;
              }
              .loading {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                font-size: 14px;
                color: #a1a1aa;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <strong>${tab.title}</strong>
              <span style="margin-left: auto; font-size: 12px; color: #a1a1aa;">${tab.type}</span>
            </div>
            <div class="content">
              <div class="loading">Loading ${tab.title}...</div>
            </div>
            <script>
              // This is a placeholder. In a real implementation, you'd:
              // 1. Load the workspace content from the parent window
              // 2. Render the appropriate editor component
              // 3. Set up message passing with parent for live updates
              
              window.addEventListener('message', (e) => {
                if (e.data.type === 'editor-content') {
                  // Handle content updates from parent
                  console.log('Received content:', e.data.content);
                }
              });

              // Request initial content from parent
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                  type: 'request-content',
                  tabId: '${tab.id}'
                }, '*');
              }
            </script>
          </body>
        </html>
      `)
      newWindow.document.close()

      // Remove tab from current panel after pop-out
      closeTab(panelId, tab.id)
    }
  }


  const renderPanel = (config: PanelConfig): React.ReactNode => {
    if (isSplitPanel(config)) {
      return (
        <div 
          className={cn(
            "flex w-full h-full",
            config.type === 'horizontal' ? 'flex-row' : 'flex-col'
          )}
        >
          {config.children.map((child, idx) => (
            <div
              key={child.id}
              style={{ 
                [config.type === 'horizontal' ? 'width' : 'height']: `${config.sizes[idx]}%` 
              }}
              className="relative"
            >
              {renderPanel(child)}
              {/* TODO: Add resizable handle between panels */}
            </div>
          ))}
        </div>
      )
    }

    // Render editor panel with tabs
    const panel = config as EditorPanelConfig
    const activeTab = panel.tabs.find(t => t.id === panel.activeTabId)

    return (
      <div className="flex flex-col h-full w-full">
        {/* Tiny Header */}
        <div 
          className={cn(
            "flex items-center border-b bg-background h-10 px-2 gap-2 transition-colors",
            dropTargetPanelId === panel.id && "bg-primary/10 border-primary"
          )}
          onDragOver={(e) => handlePanelDragOver(e, panel.id)}
          onDragLeave={(e) => handlePanelDragLeave(e, panel.id)}
          onDrop={(e) => handlePanelDrop(e, panel.id)}
        >
          {/* Tabs */}
          <div className="flex-1 flex items-center gap-1 overflow-x-auto">
            {panel.tabs.map(tab => {
              const IconComponent = getFileTypeIcon(tab.type)
              return (
                <button
                  key={tab.id}
                  draggable
                  onDragStart={(e) => handleTabDragStart(e, panel.id, tab)}
                  onDragEnd={handleTabDragEnd}
                  onClick={() => setActiveTab(panel.id, tab.id)}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1 text-sm rounded-t border-b-2 transition-colors cursor-move",
                    panel.activeTabId === tab.id
                      ? "border-primary bg-muted"
                      : "border-transparent hover:bg-muted/50",
                    dragState?.tab.id === tab.id && "opacity-50"
                  )}
                >
                  <IconComponent className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate max-w-[120px]">{tab.title}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePopOutTab(panel.id, tab)
                      }}
                      className="hover:bg-background rounded p-0.5"
                      title="Pop out to new window"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(panel.id, tab.id)
                      }}
                      className="hover:bg-background rounded p-0.5"
                      title="Close tab"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Split buttons */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => splitPanel(panel.id, 'vertical')}
              title="Split Vertically"
            >
              <SplitSquareVertical className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => splitPanel(panel.id, 'horizontal')}
              title="Split Horizontally"
            >
              <SplitSquareHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div 
          className="flex-1 overflow-hidden relative"
          onDragOver={(e) => handlePanelDragOver(e, panel.id)}
          onDragLeave={(e) => handlePanelDragLeave(e, panel.id)}
          onDrop={(e) => handlePanelDrop(e, panel.id)}
        >
          {/* Drop zone indicator */}
          {dragState && dropTargetPanelId === panel.id && dragState.sourcePanelId !== panel.id && (
            <div className="absolute inset-0 border-2 border-dashed border-primary bg-primary/5 z-50 flex items-center justify-center pointer-events-none">
              <div className="text-primary font-medium">Drop tab here</div>
            </div>
          )}
          
          {activeTab ? (
            <EditorContent
              tab={activeTab}
              selectedSchema={selectedSchema}
              onSchemaChange={onSchemaChange}
              onSchemaClose={onSchemaClose}
              canvasScale={canvasScale}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No file open</p>
                <p className="text-xs mt-1">
                  {dragState 
                    ? "Drop tab here to open" 
                    : "Open a file from the explorer"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-muted/30 relative overflow-hidden">
      {renderPanel(rootPanel)}

      {/* Vertical Toolbar */}
      {!isPreviewMode && (
        <VerticalToolbar
          leftOffset={isLeftPanelOpen ? leftPanelWidth + 10 : 58}
          rightOffset={isRightPanelOpen ? rightPanelWidth + 10 : 10}
          bottomOffset={10}
        />
      )}
      
      {/* Close confirmation dialog */}
      <AlertDialog open={!!closeConfirmation} onOpenChange={() => setCloseConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              {closeConfirmation && `"${closeConfirmation.filePath}" has unsaved changes. Do you want to save them before closing?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCloseConfirmation(null)}>
              Cancel
            </AlertDialogCancel>
            <Button variant="destructive" onClick={handleCloseConfirmDiscard}>
              Don't Save
            </Button>
            <AlertDialogAction onClick={handleCloseConfirmSave}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Page workspace loader that loads page data from workspace file
interface PageWorkspaceLoaderProps {
  filePath?: string
}

const PageWorkspaceLoader: React.FC<PageWorkspaceLoaderProps> = ({ filePath }) => {
  const { files, markFileDirty } = useWorkspace()
  const { loadElements, markAsChanged, elements } = useBuilderStore()
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    if (!filePath) {
      setIsLoading(false)
      return
    }
    
    const file = files.get(filePath)
    if (file) {
      try {
        const pageData = JSON.parse(file.content)
        if (pageData.elements) {
          loadElements(pageData.elements)
        }
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to parse page data:', error)
        toast({
          title: 'Failed to load page',
          description: 'Invalid page data format',
          variant: 'destructive'
        })
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }
  }, [filePath, files, loadElements])
  
  // Watch for changes to mark file dirty
  useEffect(() => {
    if (!filePath || isLoading) return
    
    // Subscribe to builder store changes
    const unsubscribe = useBuilderStore.subscribe(
      (state) => {
        if (state.hasUnsavedChanges && filePath) {
          markFileDirty(filePath, true)
        }
      }
    )
    
    return unsubscribe
  }, [filePath, isLoading, markFileDirty])
  
  // Save current page data to workspace when needed
  useEffect(() => {
    if (!filePath) return
    
    const handleSave = (e: CustomEvent) => {
      if (e.detail.path === filePath) {
        const pageData = { elements }
        const { saveFile } = useWorkspace.getState()
        saveFile(filePath, JSON.stringify(pageData, null, 2))
      }
    }
    
    window.addEventListener('goflow-save-file', handleSave as EventListener)
    return () => window.removeEventListener('goflow-save-file', handleSave as EventListener)
  }, [filePath, elements])
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading page...</div>
      </div>
    )
  }
  
  return <PageWorkspace />
}

// Render different editor types
interface EditorContentProps {
  tab: EditorTab
  selectedSchema: { name: string; schema: JSONSchema } | null
  onSchemaChange: (schema: JSONSchema) => void
  onSchemaClose: () => void
  canvasScale: number
}

const EditorContent: React.FC<EditorContentProps> = ({
  tab,
  selectedSchema,
  onSchemaChange,
  onSchemaClose,
  canvasScale
}) => {
  switch (tab.type) {
    case 'page':
      return (
        <div
          style={{
            overflow: "auto",
            transform: `scale(${canvasScale})`,
            transformOrigin: "0 0",
            width: `${100 / canvasScale}%`,
            height: `${100 / canvasScale}%`,
          }}
        >
          <PageWorkspaceLoader filePath={tab.filePath} />
        </div>
      )
    
    case 'schema':
      if (selectedSchema) {
        return (
          <SchemaViewer
            schema={selectedSchema.schema}
            schemaName={selectedSchema.name}
            onSchemaChange={onSchemaChange}
            onClose={onSchemaClose}
          />
        )
      }
      return <div className="p-4">Schema editor (to be implemented)</div>
    
    case 'workflow':
      return (
        <div
          style={{
            overflow: "auto",
            transform: `scale(${canvasScale})`,
            transformOrigin: "0 0",
            width: `${100 / canvasScale}%`,
            height: `${100 / canvasScale}%`,
          }}
        >
          <FlowWorkspace />
        </div>
      )
    
    case 'query':
      return (
        <div
          style={{
            overflow: "auto",
            transform: `scale(${canvasScale})`,
            transformOrigin: "0 0",
            width: `${100 / canvasScale}%`,
            height: `${100 / canvasScale}%`,
          }}
        >
          <DataWorkspace />
        </div>
      )
    
    case 'datasource':
      return <div className="p-4">Data Source editor (to be implemented)</div>
    
    case 'mcp':
      return <div className="p-4">MCP Tool editor (to be implemented)</div>
    
    default:
      return <div className="p-4">Unknown editor type</div>
  }
}
