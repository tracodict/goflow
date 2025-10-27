"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { BuilderStoreProvider, getTabStore } from "@/stores/pagebuilder/editor-context"
import { useWorkspace } from "@/stores/workspace-store"
import { toast } from "@/hooks/use-toast"
import { getTabState, setTabState } from "@/stores/pagebuilder/tab-state-cache"
import { McpEditor } from "./McpEditor"
import {
  McpEditorState,
  createDefaultMcpEditorState,
  normalizeMcpFile,
  serializeMcpState,
} from "./mcp-utils"

interface McpEditorLoaderProps {
  tabId: string
  filePath?: string
  isFocused: boolean
}

const cloneState = (state: McpEditorState): McpEditorState => ({
  ...state,
  tools: state.tools.map((tool) => ({
    ...tool,
    passthrough: { ...tool.passthrough },
  })),
  resources: state.resources.map((resource) => ({
    ...resource,
    passthrough: { ...resource.passthrough },
  })),
  passthrough: { ...state.passthrough },
})

export const McpEditorLoader: React.FC<McpEditorLoaderProps> = ({ tabId, filePath }) => {
  const { files, openFile, saveFile, markFileDirty } = useWorkspace()
  const [localData, setLocalData] = useState<McpEditorState | null>(null)
  const [loading, setLoading] = useState<boolean>(!!filePath)
  const [error, setError] = useState<string | null>(null)
  const loadAttemptsRef = useRef<Set<string>>(new Set())
  const lastLoadedHashRef = useRef<string | null>(null)

  useEffect(() => {
    if (!filePath) {
      setLocalData(null)
      setLoading(false)
      setError("No file selected")
      return
    }

    const file = files.get(filePath)
    if (!file) {
      if (!loadAttemptsRef.current.has(filePath)) {
        loadAttemptsRef.current.add(filePath)
        setLoading(true)
        openFile(filePath).catch((err: any) => {
          console.error("Failed to open MCP file", err)
          toast({
            title: "Unable to open file",
            description: err?.message ?? "Unexpected error",
            variant: "destructive",
          })
          setError("Failed to load file")
          setLoading(false)
        })
      }
      return
    }

    loadAttemptsRef.current.delete(filePath)

    const fileHash = `${filePath}-${file.sha || file.content.length}`
    const cached = getTabState(filePath)
    if (cached && cached["mcp"] && lastLoadedHashRef.current === fileHash) {
      setLocalData(cloneState(cached["mcp"] as McpEditorState))
      setLoading(false)
      setError(null)
      return
    }

    try {
      const trimmed = file.content?.trim() || ""
      const parsed = trimmed ? JSON.parse(trimmed) : {}
      const normalized = normalizeMcpFile(parsed, filePath)
      const cloned = cloneState(normalized)
      setLocalData(cloned)
      setTabState(filePath, { mcp: cloneState(normalized) })
      lastLoadedHashRef.current = fileHash
      setError(null)
    } catch (err) {
      console.error("Failed to parse MCP file", err)
  const fallback = createDefaultMcpEditorState(filePath.split("/").pop()?.replace(/\.mcp$/, "") || "")
  setLocalData(cloneState(fallback))
      setError("Invalid MCP file contents")
    }

    setLoading(false)
  }, [filePath, files, openFile])

  useEffect(() => {
    if (!filePath) {
      return
    }
    const store = getTabStore(tabId)
    if (!store) {
      return
    }

    const unsubscribe = store.subscribe((state) => {
      const value = state.elements["mcp"] as unknown
      if (value && typeof value === "object") {
        setTabState(filePath, { mcp: cloneState(value as McpEditorState) })
      }
    })

    return unsubscribe
  }, [filePath, tabId])

  useEffect(() => {
    if (!filePath) {
      return
    }
    const store = getTabStore(tabId)
    if (!store) {
      return
    }

    const unsubscribe = store.subscribe((state) => {
      markFileDirty(filePath, state.hasUnsavedChanges)
    })

    return unsubscribe
  }, [filePath, markFileDirty, tabId])

  useEffect(() => {
    if (!filePath) {
      return
    }

    const handleSave = async (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (!detail || detail.path !== filePath) {
        return
      }

      const store = getTabStore(tabId)
      if (!store) {
        console.warn("No tab store available for MCP save", tabId)
        return
      }

      const raw = store.getState().elements["mcp"] as unknown
      if (!raw || typeof raw !== "object") {
        console.warn("No MCP data found in store")
        return
      }
      const current = raw as McpEditorState

      try {
  const prepared = serializeMcpState(current, filePath)
  await saveFile(filePath, JSON.stringify(prepared, null, 2))
  setTabState(filePath, { mcp: cloneState(current) })
        store.getState().markAsSaved()
        markFileDirty(filePath, false)
  setLocalData(cloneState(current))
        toast({ title: "MCP configuration saved", description: filePath })
      } catch (err: any) {
        console.error("Failed to save MCP configuration", err)
        toast({
          title: "Failed to save",
          description: err?.message ?? "Unexpected error",
          variant: "destructive",
        })
      }
    }

    window.addEventListener("goflow-save-file", handleSave as EventListener)
    return () => window.removeEventListener("goflow-save-file", handleSave as EventListener)
  }, [filePath, saveFile, tabId, markFileDirty])

  const initialElements = useMemo(() => {
    return localData ? { mcp: localData } : undefined
  }, [localData])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading MCP configuration…</div>
      </div>
    )
  }

  if (error && !localData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-destructive">{error}</div>
      </div>
    )
  }

  if (!localData || !initialElements) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">No MCP configuration loaded</div>
      </div>
    )
  }

  return (
    <BuilderStoreProvider tabId={tabId} initialElements={initialElements}>
      <McpEditor />
    </BuilderStoreProvider>
  )
}
