"use client"

import type React from "react"
import { useBuilderStore } from "../../stores/pagebuilder/editor"
import { LeftPanel } from "./LeftPanel"
import { PageWorkspace } from "./PageWorkspace"
import { VerticalToolbar } from "./VerticalToolbar"
import { FlowWorkspace } from "../petri/flow-workspace"
import DataWorkspace from '@/components/data/DataWorkspace'
import { RightPanel } from "./RightPanel"
import { ResizeHandle } from "./ResizeHandle"
import { SystemSettingsProvider, useSystemSettings } from "../petri/system-settings-context"
import { useState } from "react"
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

export const Builder: React.FC = () => {
  const { isPreviewMode, canvasScale, leftPanelWidth, rightPanelWidth, setLeftPanelWidth, setRightPanelWidth } = useBuilderStore()
  const [isLeftPanelOpen, setLeftPanelOpen] = useState(true)
  const [isRightPanelOpen, setRightPanelOpen] = useState(true)
  const [showSystemSettings, setShowSystemSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("components")
  const { session: userSession, loading: sessionLoading } = useSession()
  const primaryRole = (userSession?.roles || [])[0]

  return (
    <SystemSettingsProvider>
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top menu bar */}
      <Menubar className="border-b rounded-none shadow-none px-2">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem disabled>New</MenubarItem>
            <MenubarItem disabled>Open…</MenubarItem>
            <MenubarSeparator />
            <MenubarItem disabled>Save</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setRightPanelOpen((v) => !v)}>
              Right Panel
            </MenubarItem>
            <MenubarItem onClick={() => setShowSystemSettings(true)}>
              System Settings
            </MenubarItem>
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
        {/* Left Panel and vertical tab bar */}

        {!isPreviewMode && (
          <>
            <div style={{ width: isLeftPanelOpen ? leftPanelWidth : 48, minWidth: 48, maxWidth: 600, position: 'relative' }}>
              <LeftPanel
                isOpen={isLeftPanelOpen}
                onClose={() => setLeftPanelOpen(false)}
                onOpen={() => setLeftPanelOpen(true)}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
              {isLeftPanelOpen && (
                <ResizeHandle direction="left" onResize={(delta) => setLeftPanelWidth(leftPanelWidth + delta)} />
              )}
            </div>
          </>
        )}

        {/* Main workspace */}
        <div className="flex-1 flex bg-muted/30 relative overflow-hide">
          <div
            style={{
              overflow: "hidden",
              transform: `scale(${canvasScale})`,
              transformOrigin: "0 0",
              width: `${100 / canvasScale}%`,
              height: `${100 / canvasScale}%`,
            }}
          >
            {activeTab === "workflow" ? <FlowWorkspace /> : (activeTab === 'data' ? <DataWorkspace /> : <PageWorkspace />)}
          </div>
        </div>

        {/* Vertical toolbar: show when PageWorkspace is visible (not workflow). Also show in preview mode at right-bottom. */}
        {(activeTab !== 'workflow' || isPreviewMode) && (
          <VerticalToolbar
            leftOffset={!isPreviewMode ? (isLeftPanelOpen ? (leftPanelWidth + 10) : 58) : undefined}
            rightOffset={isPreviewMode ? 10 : (isRightPanelOpen ? (rightPanelWidth + 10) : 10)}
            bottomOffset={10}
          />
        )}

        {/* Right Panel (no vertical open bar) */}
        {!isPreviewMode && isRightPanelOpen && (
          <>
            <div style={{ width: rightPanelWidth, minWidth: 200, maxWidth: 600, position: 'relative' }}>
              {isRightPanelOpen && (
                <ResizeHandle direction="right" onResize={(delta) => setRightPanelWidth(rightPanelWidth + delta)} />
              )}
              <RightPanel
                isOpen={isRightPanelOpen}
                onClose={() => setRightPanelOpen(false)}
                onOpen={() => setRightPanelOpen(true)}
                activeTab={activeTab}
              />
            </div>
          </>
        )}


      </div>
      </div>
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
