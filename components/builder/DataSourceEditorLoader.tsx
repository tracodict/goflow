"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { BuilderStoreProvider, getTabStore } from "@/stores/pagebuilder/editor-context"
import { useWorkspace } from "@/stores/workspace-store"
import { toast } from "@/hooks/use-toast"
import { DataSourceEditor, type DataSourceConfig, type DataSourceType } from "./DataSourceEditor"
import { getTabState, setTabState } from "@/stores/pagebuilder/tab-state-cache"

interface DataSourceEditorLoaderProps {
  tabId: string
  filePath?: string
  isFocused: boolean
}

interface DataSourceFile {
  id: string
  name: string
  type: DataSourceType
  description?: string
  config?: Record<string, any>
  credentials?: Record<string, any>
  enabled?: boolean
}

const normalizeDataSource = (
  input: DataSourceFile | undefined,
  filePath: string | undefined
): DataSourceConfig => {
  const fileId = filePath ? filePath.split("/").pop()?.replace(/\.ds$/, "") || "" : ""
  return {
    id: input?.id ?? fileId,
    name: input?.name ?? fileId,
    type: (input?.type as DataSourceType) || "mongodb",
    description: input?.description,
    config: { ...(input?.config || {}) },
    credentials: { ...(input?.credentials || {}) },
    enabled: input?.enabled !== false,
  }
}

const sanitizeForSave = (input: DataSourceConfig, filePath: string): DataSourceFile => {
  const fileId = filePath.split("/").pop()?.replace(/\.ds$/, "") || input.id
  return {
    ...input,
    id: fileId,
  }
}

export const DataSourceEditorLoader: React.FC<DataSourceEditorLoaderProps> = ({
  tabId,
  filePath,
}) => {
  const { files, openFile, saveFile, markFileDirty } = useWorkspace()
  const [localData, setLocalData] = useState<DataSourceConfig | null>(null)
  const [loading, setLoading] = useState<boolean>(!!filePath)
  const [error, setError] = useState<string | null>(null)
  const loadAttemptedRef = useRef<Set<string>>(new Set())
  const lastLoadedHashRef = useRef<string | null>(null)

  // Load file content when path or workspace cache changes
  useEffect(() => {
    if (!filePath) {
      setLocalData(null)
      setLoading(false)
      setError("No file selected")
      return
    }

    const file = files.get(filePath)
    if (!file) {
      if (!loadAttemptedRef.current.has(filePath)) {
        loadAttemptedRef.current.add(filePath)
        setLoading(true)
        openFile(filePath).catch((err: any) => {
          console.error("Failed to open datasource file", err)
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

    loadAttemptedRef.current.delete(filePath)

    const fileHash = `${filePath}-${file.sha || file.content.length}`
    const cachedState = getTabState(filePath)
    if (cachedState && cachedState["datasource"] && lastLoadedHashRef.current === fileHash) {
      setLocalData(normalizeDataSource(cachedState["datasource"] as DataSourceFile, filePath))
      setLoading(false)
      setError(null)
      return
    }

    try {
      const parsed = JSON.parse(file.content) as DataSourceFile
      const normalized = normalizeDataSource(parsed, filePath)
  setLocalData(normalized)
  setTabState(filePath, { datasource: normalized })
      setTabState(filePath, { datasource: normalized })
      lastLoadedHashRef.current = fileHash
      setError(null)
    } catch (err) {
      console.error("Failed to parse datasource file", err)
      setError("Invalid datasource file contents")
    }
    setLoading(false)
  }, [filePath, files, openFile])

  // Track unsaved changes per tab
  useEffect(() => {
    if (!filePath) return
    const store = getTabStore(tabId)
    if (!store) return

    const unsubscribe = store.subscribe((state) => {
      if (state.hasUnsavedChanges) {
        markFileDirty(filePath, true)
      }
    })

    return unsubscribe
  }, [filePath, markFileDirty, tabId])

  // Handle save events
  useEffect(() => {
    if (!filePath) return

    const handleSave = async (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (!detail || detail.path !== filePath) {
        return
      }

      const store = getTabStore(tabId)
      if (!store) {
        console.warn("No tab store available for datasource save", tabId)
        return
      }

      const currentElements = store.getState().elements
  const rawData = currentElements["datasource"] as unknown as DataSourceConfig | undefined
      if (!rawData) {
        console.warn("No datasource data found in store")
        return
      }

      const prepared = sanitizeForSave(rawData, filePath)

      try {
  const encrypted = await maybeEncryptCredentials(prepared)
  await saveFile(filePath, JSON.stringify(encrypted, null, 2))
        setTabState(filePath, { datasource: prepared })
        store.getState().markAsSaved()
        markFileDirty(filePath, false)
  setLocalData(normalizeDataSource(prepared, filePath))
        toast({ title: "Datasource saved", description: filePath })
      } catch (err: any) {
        console.error("Failed to save datasource", err)
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
    return localData ? { datasource: localData } : undefined
  }, [localData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading data source…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-destructive">{error}</div>
      </div>
    )
  }

  if (!localData || !initialElements) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">No data source loaded</div>
      </div>
    )
  }

  return (
    <BuilderStoreProvider tabId={tabId} initialElements={initialElements}>
      <DataSourceEditor />
    </BuilderStoreProvider>
  )
}

const maybeEncryptCredentials = async (data: DataSourceFile): Promise<DataSourceFile> => {
  const credentials = data.credentials || {}
  const sensitiveEntries = Object.entries(credentials).filter(([, value]) => typeof value === "string" && value.length > 0)
  const hasUri = typeof data.config?.uri === "string" && data.config.uri.length > 0

  if (sensitiveEntries.length === 0 && !hasUri) {
    return data
  }

  try {
    const response = await fetch("/api/datasource-crypto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "encryptCredentials",
        data: {
          credentials: Object.fromEntries(sensitiveEntries),
          uri: hasUri ? data.config?.uri : undefined,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to encrypt credentials (${response.status})`)
    }

    const { encrypted } = await response.json()
    const next: DataSourceFile = {
      ...data,
      config: { ...(data.config || {}) },
      credentials: { ...(data.credentials || {}) },
    }

    if (encrypted) {
      if (encrypted.uri) {
        if (!next.config) next.config = {}
        next.config.uri = encrypted.uri
      }

      for (const key of Object.keys(encrypted)) {
        if (key !== "uri") {
          if (!next.credentials) next.credentials = {}
          next.credentials[key] = encrypted[key]
        }
      }
    }

    return next
  } catch (error) {
    console.warn("Failed to encrypt datasource credentials", error)
    return data
  }
}
