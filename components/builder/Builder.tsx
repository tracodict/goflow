"use client"

import type React from "react"
import { useBuilderStore } from "../../stores/pagebuilder/editor"
import { FocusedTabProvider } from "../../stores/pagebuilder/editor-context"
import { LeftPanel } from "./LeftPanel"
import { MainPanel } from "./MainPanel"
import type { EditorType } from "./MainPanel"
import { RightPanel } from "./RightPanel"
import { ResizeHandle } from "./ResizeHandle"
import { SystemSettingsProvider, useSystemSettings } from "../petri/system-settings-context"
import { useState, useCallback } from "react"
import type { JSONSchema } from "@/jsonjoy-builder/src/types/jsonSchema"
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from "../ui/menubar"
import { useSession } from "../auth/session-context"
import { UserCircle2, LogOut } from "lucide-react"
import { Button } from "../ui/button"
import { FileMenu } from "./FileMenu"

export const Builder: React.FC = () => {
  const {
    isPreviewMode,
    canvasScale,
    leftPanelWidth,
    rightPanelWidth,
    setLeftPanelWidth,
    setRightPanelWidth,
    togglePreviewMode,
    toggleContainerBorders,
    showContainerBorders,
    setCanvasScale,
  } = useBuilderStore()
  const [isLeftPanelOpen, setLeftPanelOpen] = useState(true)
  const [isRightPanelOpen, setRightPanelOpen] = useState(true)
  const [isLeftPanelMaximized, setLeftPanelMaximized] = useState(false)
  const [isRightPanelMaximized, setRightPanelMaximized] = useState(false)
  const [focusedTabId, setFocusedTabId] = useState<string | null>(null)
  const [activeEditorType, setActiveEditorType] = useState<EditorType | null>(null)
  const [showSystemSettings, setShowSystemSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(() => {
    // Restore from localStorage or default to workspace
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('goflow-active-tab')
      if (saved) {
        return saved
      }
    }
    return "workspace" // Default to workspace tab to show file explorer
  })
  const [selectedSchema, setSelectedSchema] = useState<{ name: string; schema: JSONSchema } | null>(null)
  const { session: userSession, loading: sessionLoading } = useSession()
  const primaryRole = (userSession?.roles || [])[0]

  const handleFocusedTabChange = useCallback(({ tabId, type }: { tabId: string | null; type: EditorType | null }) => {
    setFocusedTabId(tabId)
    setActiveEditorType(type ?? null)
  }, [])

  const isPageEditorActive = activeEditorType === 'page'

  // Persist active tab to localStorage
  const handleSetActiveTab = (tab: string) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      localStorage.setItem('goflow-active-tab', tab)
    }
  }

  const handleSchemaSelect = (schemaName: string, schema: JSONSchema) => {
    setSelectedSchema({ name: schemaName, schema })
  }

  const handleSchemaClose = () => {
    setSelectedSchema(null)
  }

  const handleSchemaChange = (updatedSchema: JSONSchema) => {
    if (selectedSchema) {
      setSelectedSchema({ ...selectedSchema, schema: updatedSchema })
      // TODO: Implement schema persistence logic here
      console.log('Schema updated:', selectedSchema.name, updatedSchema)
    }
  }

  const handleTogglePreview = useCallback(() => {
    togglePreviewMode()
  }, [togglePreviewMode])

  const handleToggleContainerBorder = useCallback(() => {
    toggleContainerBorders()
  }, [toggleContainerBorders])

  const handleZoomIn = useCallback(() => {
    setCanvasScale(Math.min(2, +(canvasScale + 0.05).toFixed(2)))
  }, [canvasScale, setCanvasScale])

  const handleZoomOut = useCallback(() => {
    setCanvasScale(Math.max(0.5, +(canvasScale - 0.05).toFixed(2)))
  }, [canvasScale, setCanvasScale])

  return (
    <SystemSettingsProvider>
    <FocusedTabProvider focusedTabId={focusedTabId}>
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top menu bar - hide in preview mode */}
      {!isPreviewMode && (
        <Menubar className="border-b rounded-none shadow-none px-2">
          <FileMenu />
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setRightPanelOpen((v) => !v)}>
                Right Panel
              </MenubarItem>
              <MenubarItem onClick={() => setShowSystemSettings(true)}>
                System Settings
              </MenubarItem>
              {isPageEditorActive && (
                <>
                  <MenubarSeparator />
                  <MenubarItem
                    onClick={handleTogglePreview}
                    role="menuitemcheckbox"
                    aria-checked={isPreviewMode}
                  >
                    {isPreviewMode ? 'Exit Preview' : 'Preview'}
                  </MenubarItem>
                  <MenubarItem
                    onClick={handleToggleContainerBorder}
                    role="menuitemcheckbox"
                    aria-checked={showContainerBorders}
                  >
                    Show/Hide Container Border
                  </MenubarItem>
                  <MenubarItem onClick={handleZoomIn} disabled={canvasScale >= 2}>
                    Zoom In
                  </MenubarItem>
                  <MenubarItem onClick={handleZoomOut} disabled={canvasScale <= 0.5}>
                    Zoom Out
                  </MenubarItem>
                </>
              )}
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Help</MenubarTrigger>
            <MenubarContent>
              <MenubarItem asChild>
                <a href="https://github.com/tracodict/goflow" target="_blank" rel="noopener noreferrer">GitHub</a>
              </MenubarItem>
              <MenubarItem asChild>
                <a href="https://docs.goflow.dev" target="_blank" rel="noopener noreferrer">Docs</a>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <div className="ml-auto flex items-center gap-2 pl-2 pr-2 h-8 rounded-full border bg-white">
            {sessionLoading ? <UserCircle2 className="h-5 w-5 text-neutral-400 animate-pulse" /> : <UserCircle2 className="h-5 w-5 text-neutral-600" />}
            <span className="hidden sm:inline truncate max-w-[8rem]" title={userSession?.email}>{userSession?.name || 'Guest'}{primaryRole ? ` (${primaryRole})` : ''}</span>
            <a
              href="/api/logout?return=/"
              className="h-8 px-3 inline-flex items-center gap-1 rounded border bg-white hover:bg-neutral-50 text-xs"
              title="Logout"
              data-static-logout
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </a>
          </div>
        </Menubar>
      )}
      {/* System Settings Dialog (real) */}
      {showSystemSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg p-6 min-w-[320px] max-w-[90vw] relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
              onClick={() => setShowSystemSettings(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-lg font-semibold mb-4">System Settings</h2>
            <SystemSettingsEditor onClose={() => setShowSystemSettings(false)} />
          </div>
        </div>
      )}
      <div className="flex-1 flex overflow-hidden relative">
        {isLeftPanelMaximized ? (
          <div className="absolute inset-0 z-40 bg-background">
            <LeftPanel
              isOpen
              onClose={() => {
                setLeftPanelMaximized(false)
                setLeftPanelOpen(false)
              }}
              onOpen={() => setLeftPanelOpen(true)}
              activeTab={activeTab}
              setActiveTab={handleSetActiveTab}
              onSchemaSelect={handleSchemaSelect}
              isMaximized
              onToggleMaximize={() => {
                setLeftPanelMaximized(false)
                setLeftPanelOpen(true)
              }}
              activeEditorType={activeEditorType}
            />
          </div>
        ) : isRightPanelMaximized ? (
          <div className="absolute inset-0 z-40 bg-background">
            <RightPanel
              isOpen
              onClose={() => {
                setRightPanelMaximized(false)
                setRightPanelOpen(false)
              }}
              onOpen={() => setRightPanelOpen(true)}
              activeTab={activeTab}
              activeEditorType={activeEditorType}
              isMaximized
              onToggleMaximize={() => {
                setRightPanelMaximized(false)
                setRightPanelOpen(true)
              }}
            />
          </div>
        ) : (
          <>
            {!isPreviewMode && (
              <div style={{ width: isLeftPanelOpen ? leftPanelWidth : 48, minWidth: 48, maxWidth: 600, position: 'relative' }}>
                <LeftPanel
                  isOpen={isLeftPanelOpen}
                  onClose={() => {
                    setLeftPanelOpen(false)
                    setLeftPanelMaximized(false)
                  }}
                  onOpen={() => setLeftPanelOpen(true)}
                  activeTab={activeTab}
                  setActiveTab={handleSetActiveTab}
                  onSchemaSelect={handleSchemaSelect}
                  isMaximized={false}
                  onToggleMaximize={() => {
                    setLeftPanelOpen(true)
                    setLeftPanelMaximized(true)
                    setRightPanelMaximized(false)
                  }}
                  activeEditorType={activeEditorType}
                />
                {isLeftPanelOpen && (
                  <ResizeHandle direction="left" onResize={(delta) => setLeftPanelWidth(leftPanelWidth + delta)} />
                )}
              </div>
            )}

            <MainPanel
              activeTab={activeTab}
              selectedSchema={selectedSchema}
              onSchemaChange={handleSchemaChange}
              onSchemaClose={handleSchemaClose}
              leftPanelWidth={leftPanelWidth}
              rightPanelWidth={rightPanelWidth}
              isLeftPanelOpen={isLeftPanelOpen}
              isRightPanelOpen={isRightPanelOpen}
              onFocusedTabChange={handleFocusedTabChange}
            />

            {!isPreviewMode && isRightPanelOpen && (
              <div style={{ width: rightPanelWidth, minWidth: 200, maxWidth: 600, position: 'relative' }}>
                {isRightPanelOpen && (
                  <ResizeHandle direction="right" onResize={(delta) => setRightPanelWidth(rightPanelWidth + delta)} />
                )}
                <RightPanel
                  isOpen={isRightPanelOpen}
                  onClose={() => {
                    setRightPanelOpen(false)
                    setRightPanelMaximized(false)
                  }}
                  onOpen={() => setRightPanelOpen(true)}
                  activeTab={activeTab}
                  activeEditorType={activeEditorType}
                  isMaximized={false}
                  onToggleMaximize={() => {
                    setRightPanelOpen(true)
                    setRightPanelMaximized(true)
                    setLeftPanelMaximized(false)
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </FocusedTabProvider>
    </SystemSettingsProvider>
  )
}

// Minimal settings editor used in the System Settings dialog
const SystemSettingsEditor: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { settings, setSetting, deleteSetting, addSetting, resetDefaults } = useSystemSettings()
  const entries = Object.entries(settings)

  return (
    <div className="text-sm">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded" onClick={addSetting}>Add</button>
          <button className="px-2 py-1 border rounded" onClick={resetDefaults}>Reset Defaults</button>
          {onClose && <button className="ml-auto px-2 py-1 border rounded" onClick={onClose}>Close</button>}
        </div>
      </div>
      <div className="max-h-[50vh] overflow-auto">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 mb-2">
            <div className="w-40 text-xs text-muted-foreground">{k}</div>
            <input className="flex-1 border rounded px-2 py-1 text-sm" value={v} onChange={(e) => setSetting(k, e.target.value)} />
            <button className="px-2 py-1 border rounded text-sm" onClick={() => deleteSetting(k)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}

