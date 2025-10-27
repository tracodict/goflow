"use client"

import React from "react"
import type { FC } from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useBuilderStore } from "@/stores/pagebuilder/editor"
import { BuilderStoreProvider, useBuilderStoreContext, clearTabStore, getTabStore } from "@/stores/pagebuilder/editor-context"
import { clearTabState, getTabState, setTabState } from "@/stores/pagebuilder/tab-state-cache"
import { useWorkspace } from "@/stores/workspace-store"
import "@/components/workspace/file-handler"
import { PageWorkspace } from "./PageWorkspace"
import { FlowWorkspaceLoader } from "./FlowWorkspaceLoader"
import { SchemaViewer } from "./SchemaViewer"
import { DataSourceEditorLoader } from "./DataSourceEditorLoader"
import { QueryEditorLoader } from "./QueryEditorLoader"
import { McpEditorLoader } from "./McpEditorLoader"
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
export type EditorType = 'page' | 'schema' | 'query' | 'workflow' | 'datasource' | 'mcp'

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
  onFocusedTabChange?: (info: { tabId: string | null; type: EditorType | null }) => void
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
  onFocusedTabChange,
}) => {
  const { isPreviewMode, canvasScale } = useBuilderStore()
  const { files, saveFile, markFileDirty } = useWorkspace()

  // Drag and drop state
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTargetPanelId, setDropTargetPanelId] = useState<string | null>(null)
  
  // Track which tab is focused (controls builder store)
  const [focusedTabId, setFocusedTabId] = useState<string | null>('welcome')
  
  // Close confirmation dialog state
  const [closeConfirmation, setCloseConfirmation] = useState<{
    panelId: string
    tabId: string
    filePath: string
  } | null>(null)

  // Default panel configuration
  const getDefaultPanelConfig = (): PanelConfig => ({
    id: 'root',
    tabs: [{
      id: 'welcome',
      title: 'Welcome',
      type: 'page',
    }],
    activeTabId: 'welcome',
  } as EditorPanelConfig)

  // Initialize root panel configuration with default state
  const [rootPanel, setRootPanel] = useState<PanelConfig>(getDefaultPanelConfig)
  const [isHydrated, setIsHydrated] = useState(false)

  // Helper to find the first active tab in a panel tree
  const findFirstActiveTab = (panel: PanelConfig): string | null => {
    if (isSplitPanel(panel)) {
      for (const child of panel.children) {
        const result = findFirstActiveTab(child)
        if (result) return result
      }
      return null
    } else {
      return panel.activeTabId
    }
  }

  const findTabById = (panel: PanelConfig, tabId: string | null): EditorTab | null => {
    if (!tabId) return null
    if (isSplitPanel(panel)) {
      for (const child of panel.children) {
        const result = findTabById(child, tabId)
        if (result) return result
      }
      return null
    }
    return panel.tabs.find((tab) => tab.id === tabId) || null
  }

  // Notify parent when focused tab changes
  useEffect(() => {
    const tab = findTabById(rootPanel, focusedTabId)
    onFocusedTabChange?.({ tabId: focusedTabId, type: tab?.type ?? null })
  }, [focusedTabId, rootPanel, onFocusedTabChange])

  // Restore from localStorage after mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const savedPanel = JSON.parse(saved)
        setRootPanel(savedPanel)
        // Also restore focused tab
        const firstActiveTab = findFirstActiveTab(savedPanel)
        if (firstActiveTab) {
          setFocusedTabId(firstActiveTab)
        }
      } catch (e) {
        console.error('Failed to parse saved panel state:', e)
      }
    }
    setIsHydrated(true)
  }, [])

  // Persist to localStorage whenever rootPanel changes (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rootPanel))
    }
  }, [rootPanel, isHydrated])

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

    // Set this tab as focused immediately
    console.log('Opening file in tab, setting focus:', tabId)
    setFocusedTabId(tabId)

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
      console.log('Checking dirty state for tab:', tab.filePath, 'file:', file, 'dirty:', file?.dirty)
      if (file?.dirty) {
        console.log('Setting close confirmation for dirty file:', tab.filePath)
        setCloseConfirmation({ panelId, tabId, filePath: tab.filePath })
        return
      }
    }
    
    // Clear cache entry for this tab if it's a file tab
    const closingTab = findTab(rootPanel)
    if (closingTab && closingTab.id.startsWith('file:')) {
      const filePath = closingTab.id.substring(5)
  clearTabState(filePath)
      // Clear the builder store for this tab
      clearTabStore(closingTab.id)
      console.log('Cleared cache and store for closed tab:', filePath)
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

    const { filePath, panelId, tabId } = closeConfirmation
    const file = files.get(filePath)
    if (!file) return

    const extension = filePath.split('.').pop()?.toLowerCase()

    try {
      if (extension === 'cpn') {
        if (typeof window === 'undefined') {
          throw new Error('Workflow files can only be saved in the browser environment')
        }

        await new Promise<void>((resolve, reject) => {
          let settled = false
          let timeoutId: number | undefined

          const cleanup = () => {
            if (settled) return
            settled = true
            if (timeoutId !== undefined) {
              window.clearTimeout(timeoutId)
            }
            window.removeEventListener('goflow-file-saved', handleSaved as EventListener)
          }

          const handleSaved = (event: Event) => {
            const ce = event as CustomEvent<{ path?: string }>
            if (ce?.detail?.path === filePath) {
              cleanup()
              resolve()
            }
          }

          timeoutId = window.setTimeout(() => {
            cleanup()
            reject(new Error('Timed out waiting for workflow save'))
          }, 8000)

          window.addEventListener('goflow-file-saved', handleSaved as EventListener)

          window.dispatchEvent(new CustomEvent('goflow-save-file', {
            detail: { path: filePath }
          }))
        })
      } else {
        await saveFile(file.path, file.content)
      }

      closeTab(panelId, tabId, true)
      setCloseConfirmation(null)
    } catch (error: any) {
      toast({
        title: 'Failed to save file',
        description: error?.message || 'Unknown error',
        variant: 'destructive'
      })
    }
  }
  
  const handleCloseConfirmDiscard = () => {
    if (!closeConfirmation) return
    closeTab(closeConfirmation.panelId, closeConfirmation.tabId, true)
    setCloseConfirmation(null)
  }

  const setActiveTab = (panelId: string, tabId: string) => {
    // Before switching tabs, save current tab's state to cache
    const saveCurrentTabState = (panel: PanelConfig): void => {
      if (isSplitPanel(panel)) {
        panel.children.forEach(child => saveCurrentTabState(child))
      } else if (panel.activeTabId) {
        const activeTab = panel.tabs.find(t => t.id === panel.activeTabId)
        if (activeTab && activeTab.id.startsWith('file:')) {
          const filePath = activeTab.id.substring(5) // Remove 'file:' prefix
          const tabStore = getTabStore(activeTab.id)
          if (tabStore) {
            const currentElements = tabStore.getState().elements
            console.log('Saving tab state to cache:', filePath, Object.keys(currentElements).length, 'elements')
            setTabState(filePath, currentElements)
          } else {
            console.warn('No store found while saving tab state. Skipping cache update for', filePath)
          }
        }
      }
    }
    
    saveCurrentTabState(rootPanel)
    
    // Set this tab as focused
    setFocusedTabId(tabId)
    
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
    // Get the current elements from the tab's store
    const tabStore = getTabStore(tab.id)
    if (tabStore) {
      const elements = tabStore.getState().elements
      // Store elements in localStorage for the popout window to retrieve
      localStorage.setItem(`popout-${tab.id}`, JSON.stringify(elements))
    }

    // Create a new window with tab data
    const width = 1200
    const height = 800
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popoutUrl = `/popout?tabId=${encodeURIComponent(tab.id)}&title=${encodeURIComponent(tab.title)}`
    
    const newWindow = window.open(
      popoutUrl,
      `goflow-${tab.id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    )

    if (newWindow) {
      // Remove tab from current panel after pop-out
      closeTab(panelId, tab.id)
    }
  }


  const handleResizeStart = useCallback((e: React.MouseEvent, panelId: string, childIndex: number) => {
    e.preventDefault()
    
    const panel = findPanelById(rootPanel, panelId) as SplitPanelConfig | null
    if (!panel || !isSplitPanel(panel)) return
    
    const isHorizontal = panel.type === 'horizontal'
    const startPos = isHorizontal ? e.clientX : e.clientY
    const startSizes = [...panel.sizes]
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = isHorizontal ? moveEvent.clientX : moveEvent.clientY
      const delta = currentPos - startPos
      
      // Get the container size
      const container = document.getElementById(`panel-${panelId}`)
      if (!container) return
      
      const containerSize = isHorizontal ? container.offsetWidth : container.offsetHeight
      const deltaPercent = (delta / containerSize) * 100
      
      // Calculate new sizes
      const newSizes = [...startSizes]
      newSizes[childIndex] = Math.max(10, Math.min(90, startSizes[childIndex] + deltaPercent))
      newSizes[childIndex + 1] = Math.max(10, Math.min(90, startSizes[childIndex + 1] - deltaPercent))
      
      // Update the panel config
      setRootPanel(prev => updatePanelSizes(prev, panelId, newSizes))
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [rootPanel])

  const updatePanelSizes = (config: PanelConfig, panelId: string, newSizes: number[]): PanelConfig => {
    if (config.id === panelId && isSplitPanel(config)) {
      return { ...config, sizes: newSizes }
    }
    
    if (isSplitPanel(config)) {
      return {
        ...config,
        children: config.children.map(child => updatePanelSizes(child, panelId, newSizes))
      }
    }
    
    return config
  }

  const findPanelById = (config: PanelConfig, panelId: string): PanelConfig | null => {
    if (config.id === panelId) return config
    
    if (isSplitPanel(config)) {
      for (const child of config.children) {
        const found = findPanelById(child, panelId)
        if (found) return found
      }
    }
    
    return null
  }

  const renderPanel = (config: PanelConfig): React.ReactNode => {
    if (isSplitPanel(config)) {
      return (
        <div 
          id={`panel-${config.id}`}
          className={cn(
            "flex w-full h-full",
            config.type === 'horizontal' ? 'flex-row' : 'flex-col'
          )}
        >
          {config.children.map((child, idx) => (
            <React.Fragment key={child.id}>
              <div
                style={{ 
                  [config.type === 'horizontal' ? 'width' : 'height']: `${config.sizes[idx]}%` 
                }}
                className="relative"
              >
                {renderPanel(child)}
              </div>
              
              {/* Resizable handle between panels */}
              {idx < config.children.length - 1 && (
                <div
                  onMouseDown={(e) => handleResizeStart(e, config.id, idx)}
                  className={cn(
                    "flex-shrink-0 bg-border hover:bg-primary/20 transition-colors cursor-col-resize group relative",
                    config.type === 'horizontal' 
                      ? "w-1 cursor-col-resize hover:w-1.5" 
                      : "h-1 cursor-row-resize hover:h-1.5"
                  )}
                  style={{
                    [config.type === 'horizontal' ? 'cursor' : 'cursor']: 
                      config.type === 'horizontal' ? 'col-resize' : 'row-resize'
                  }}
                >
                  {/* Visual indicator on hover */}
                  <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/30",
                    config.type === 'horizontal' ? "w-full" : "h-full"
                  )} />
                </div>
              )}
            </React.Fragment>
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
                  <div className="flex items-center gap-0.5 ml-auto">
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePopOutTab(panel.id, tab)
                      }}
                      className="hover:bg-accent/50 rounded p-0.5 transition-all opacity-30 group-hover:opacity-100 cursor-pointer"
                      title="Pop out to new window"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          handlePopOutTab(panel.id, tab)
                        }
                      }}
                    >
                      <ExternalLink className="h-3 w-3 stroke-current" />
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(panel.id, tab.id)
                      }}
                      className="hover:bg-destructive/10 hover:text-destructive rounded p-0.5 transition-all opacity-30 group-hover:opacity-100 cursor-pointer"
                      title="Close tab"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          closeTab(panel.id, tab.id)
                        }
                      }}
                    >
                      <X className="h-3 w-3 stroke-current" />
                    </div>
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
          onClick={() => activeTab && setFocusedTabId(activeTab.id)}
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
              isFocused={focusedTabId === activeTab.id}
              panelId={panel.id}
              onActivate={setActiveTab}
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

// Cache for tab-specific page states
// Page workspace loader that loads page data from workspace file
interface PageWorkspaceLoaderProps {
  tabId: string
  filePath?: string
  isFocused: boolean
  panelId: string
  onActivate: (panelId: string, tabId: string) => void
}

const PageWorkspaceLoader: React.FC<PageWorkspaceLoaderProps> = ({ tabId, filePath, isFocused, panelId, onActivate }) => {
  const { files, markFileDirty, openFile, saveFile } = useWorkspace()
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const lastLoadedFileRef = useRef<string | null>(null)
  const loadAttemptedRef = useRef<Set<string>>(new Set())
  
  // Store local elements state for this tab
  const [localElements, setLocalElements] = useState<Record<string, any> | null>(null)
  
  // Load page data when filePath changes
  useEffect(() => {
    if (!filePath) {
      setIsLoading(false)
      setIsInitialized(false)
      return
    }
    
    console.log('Loading page:', filePath)
    
    const file = files.get(filePath)
    if (!file) {
      // File not loaded yet - trigger load from workspace
      if (!loadAttemptedRef.current.has(filePath)) {
        console.log('File not in cache, loading from workspace:', filePath)
        loadAttemptedRef.current.add(filePath)
        setIsLoading(true)
        openFile(filePath)
          .then(() => {
            // File loaded, the effect will re-run and process it
            console.log('File loaded successfully:', filePath)
          })
          .catch(error => {
            console.error('Failed to load file from workspace:', error)
            toast({
              title: 'Failed to load file',
              description: error.message,
              variant: 'destructive'
            })
            setIsLoading(false)
            setIsInitialized(false)
            loadAttemptedRef.current.delete(filePath)
          })
      }
      return
    }
    
    // We have the file now, remove from attempted set
    loadAttemptedRef.current.delete(filePath)
    
    // Check if we've already loaded this exact file content
    const fileContentHash = `${filePath}-${file.sha || file.content.length}`
    const alreadyLoaded = lastLoadedFileRef.current === fileContentHash
    
    // Check if we have cached state for this tab (only use cache if already loaded)
  const cachedState = getTabState(filePath)
    if (cachedState && alreadyLoaded) {
      console.log('Restoring cached state for:', filePath)
      setLocalElements(cachedState)
      setIsLoading(false)
      setIsInitialized(true)
      return
    }
    
    // Load from workspace file (fresh load or cache miss)
    console.log('Loading fresh content from workspace file:', filePath)
    try {
      const pageData = JSON.parse(file.content)
      console.log('Parsed page data from file:', filePath, 'elements count:', Object.keys(pageData.elements || {}).length)
      
      if (pageData.elements && Object.keys(pageData.elements).length > 0) {
        console.log('Loading elements:', pageData.elements)
        setLocalElements(pageData.elements)
        // Cache the loaded state
  setTabState(filePath, pageData.elements)
        // Mark as loaded
        lastLoadedFileRef.current = fileContentHash
      } else {
        // If no elements, create default page structure
        console.warn('No elements in page data, using default')
        const defaultElements = {
          "page-root": {
            id: "page-root",
            tagName: "div",
            attributes: { className: "page-container" },
            styles: {
              minHeight: "40vh",
              padding: "20px",
              backgroundColor: "#ffffff",
              fontFamily: "system-ui, sans-serif",
            },
            childIds: [],
          }
        }
        setLocalElements(defaultElements)
  setTabState(filePath, defaultElements)
        lastLoadedFileRef.current = fileContentHash
      }
      setIsLoading(false)
      setIsInitialized(true)
    } catch (error) {
      console.error('Failed to parse page data:', error)
      toast({
        title: 'Failed to load page',
        description: 'Invalid page data format',
        variant: 'destructive'
      })
      setIsLoading(false)
      setIsInitialized(false)
    }
  }, [filePath, files, openFile])
  
  // Watch this tab's store for changes and mark file dirty
  useEffect(() => {
    if (!filePath || !isInitialized) return
    
    const tabStore = getTabStore(tabId)
    if (!tabStore) return
    
    console.log('Setting up dirty tracking for:', filePath)
    
    // Subscribe to this tab's store changes
    const unsubscribe = tabStore.subscribe(
      (state) => {
        if (state.hasUnsavedChanges) {
          console.log('Marking file dirty:', filePath)
          markFileDirty(filePath, true)
        }
      }
    )
    
    return unsubscribe
  }, [filePath, isInitialized, markFileDirty, tabId])
  
  // Save handler - gets the store for this tab and saves its elements
  useEffect(() => {
    if (!filePath || !isInitialized) return
    
    const handleSave = (e: CustomEvent) => {
      if (e.detail.path === filePath) {
        console.log('Save event received for:', filePath)
        
        // Get store for this specific tab using tabId
        const tabStore = getTabStore(tabId)
        if (!tabStore) {
          console.error('No store found for tab:', tabId)
          return
        }
        
        // Get current elements from this tab's store
        const currentElements = tabStore.getState().elements
        console.log('Elements from store:', Object.keys(currentElements).length, 'elements')
        const pageData = { elements: currentElements }
        console.log('Saving page data:', filePath, 'with', Object.keys(currentElements).length, 'elements')
        
        // Update cache with saved state
  setTabState(filePath, currentElements)
        saveFile(filePath, JSON.stringify(pageData, null, 2))
        
        // Mark as saved in the tab's store
        tabStore.getState().markAsSaved()
        markFileDirty(filePath, false)
      }
    }
    
    window.addEventListener('goflow-save-file', handleSave as EventListener)
    return () => window.removeEventListener('goflow-save-file', handleSave as EventListener)
  }, [filePath, isInitialized, saveFile, markFileDirty, tabId])
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading page...</div>
      </div>
    )
  }
  
  // Wrap PageWorkspace in BuilderStoreProvider to give each tab its own store
  // Pass tabId and initialElements to create isolated store instance
  return (
    <BuilderStoreProvider 
      tabId={tabId}
      initialElements={localElements || undefined}
    >
      <PageWorkspace 
        panelId={panelId}
        tabId={tabId}
        onActivate={onActivate}
      />
    </BuilderStoreProvider>
  )
}

// Render different editor types
interface EditorContentProps {
  tab: EditorTab
  selectedSchema: { name: string; schema: JSONSchema } | null
  onSchemaChange: (schema: JSONSchema) => void
  onSchemaClose: () => void
  canvasScale: number
  isFocused: boolean
  panelId: string
  onActivate: (panelId: string, tabId: string) => void
}

const EditorContent: React.FC<EditorContentProps> = ({
  tab,
  selectedSchema,
  onSchemaChange,
  onSchemaClose,
  canvasScale,
  isFocused,
  panelId,
  onActivate
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
          <PageWorkspaceLoader 
            tabId={tab.id} 
            filePath={tab.filePath} 
            isFocused={isFocused}
            panelId={panelId}
            onActivate={onActivate}
          />

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
          <FlowWorkspaceLoader
            tabId={tab.id}
            filePath={tab.filePath}
            isFocused={isFocused}
          />
        </div>
      )
    
    case 'query':
      return (
        <QueryEditorLoader
          tabId={tab.id}
          filePath={tab.filePath}
          isFocused={isFocused}
        />
      )
    
    case 'datasource':
      return (
        <DataSourceEditorLoader
          tabId={tab.id}
          filePath={tab.filePath}
          isFocused={isFocused}
        />
      )
    
    case 'mcp':
      return (
        <McpEditorLoader
          tabId={tab.id}
          filePath={tab.filePath}
          isFocused={isFocused}
        />
      )
    
    default:
      return <div className="p-4">Unknown editor type</div>
  }
}
