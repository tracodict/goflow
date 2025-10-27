"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { BuilderStoreProvider, getTabStore } from "@/stores/pagebuilder/editor-context"
import { useWorkspace } from "@/stores/workspace-store"
import { toast } from "@/hooks/use-toast"
import { getTabState, setTabState } from "@/stores/pagebuilder/tab-state-cache"
import { QueryEditor, createDefaultQueryState, type QueryEditorState, type QueryType } from "./QueryEditor"

interface QueryEditorLoaderProps {
  tabId: string
  filePath?: string
  isFocused: boolean
}

interface QueryFile {
  id?: string
  name?: string
  description?: string
  data_source_id?: string
  query_type?: string
  query?: string
  parameters?: Record<string, any>
  filters?: Record<string, any>
  enabled?: boolean
  [key: string]: any
}

const isRecord = (value: unknown): value is Record<string, any> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const toArray = (value: unknown): any[] | undefined => {
  if (Array.isArray(value)) return value
  return undefined
}

const deriveQueryType = (file: QueryFile): QueryType => {
  const rawType = (file.query_type || "").toLowerCase()
  if (rawType === "mongo" || rawType === "sql" || rawType === "folder" || rawType === "select") {
    return rawType
  }

  const parameters = isRecord(file.parameters) ? file.parameters : {}
  if (Array.isArray(parameters.pipeline)) {
    return "mongo"
  }

  if (typeof file.query === "string" && file.query.trim().length > 0) {
    return "sql"
  }

  return "folder"
}

const normalizeQueryFromFile = (input: QueryFile | undefined, filePath?: string): QueryEditorState => {
  const fallback = createDefaultQueryState()
  const fileId = filePath ? filePath.split("/").pop()?.replace(/\.qry$/, "") || "" : ""

  if (!input) {
    return {
      ...fallback,
      id: fileId,
      name: fileId,
    }
  }

  const passthrough: Record<string, any> = {}
  const knownTopLevelKeys = new Set([
    "id",
    "name",
    "description",
    "data_source_id",
    "query_type",
    "query",
    "parameters",
    "filters",
    "enabled",
  ])

  for (const [key, value] of Object.entries(input)) {
    if (!knownTopLevelKeys.has(key)) {
      passthrough[key] = value
    }
  }

  const parameters = isRecord(input.parameters) ? { ...input.parameters } : {}
  const filters = isRecord(input.filters) ? { ...input.filters } : {}
  const queryType = deriveQueryType(input)

  let sqlText = typeof input.query === "string" ? input.query : fallback.sqlText
  let mongoPipelineText = fallback.mongoPipelineText
  let folderPath = "/"
  let recursive = true
  let includeMetadata = true
  let maxFileSize: number | undefined
  let allowedExtensionsText = ""

  if (queryType === "mongo") {
    if (Array.isArray(parameters.pipeline)) {
      mongoPipelineText = JSON.stringify(parameters.pipeline, null, 2)
      delete parameters.pipeline
    } else if (typeof input.query === "string") {
      try {
        const parsed = JSON.parse(input.query)
        if (Array.isArray(parsed)) {
          mongoPipelineText = JSON.stringify(parsed, null, 2)
        }
      } catch {
        mongoPipelineText = input.query
      }
    }
  }

  if (queryType === "sql") {
    sqlText = typeof input.query === "string" && input.query.trim() ? input.query : fallback.sqlText
  }

  const folderKey = parameters.folderPath ?? parameters.folder_path
  if (typeof folderKey === "string" && folderKey.trim()) {
    folderPath = folderKey
    delete parameters.folderPath
    delete parameters.folder_path
  }

  const recursiveKey = parameters.recursive ?? parameters.recursive_flag
  if (typeof recursiveKey === "boolean") {
    recursive = recursiveKey
  }
  delete parameters.recursive
  delete parameters.recursive_flag

  const includeMetadataKey = parameters.includeMetadata ?? parameters.include_metadata
  if (typeof includeMetadataKey === "boolean") {
    includeMetadata = includeMetadataKey
  }
  delete parameters.includeMetadata
  delete parameters.include_metadata

  const maxFileSizeKey = parameters.maxFileSize ?? parameters.max_file_size
  if (typeof maxFileSizeKey === "number" && Number.isFinite(maxFileSizeKey)) {
    maxFileSize = maxFileSizeKey
  }
  delete parameters.maxFileSize
  delete parameters.max_file_size

  const allowedExtensionsKey = parameters.allowedExtensions ?? parameters.allowed_extensions
  if (Array.isArray(allowedExtensionsKey)) {
    allowedExtensionsText = allowedExtensionsKey.join(", ")
  }
  delete parameters.allowedExtensions
  delete parameters.allowed_extensions

  const extraParametersJson = JSON.stringify(parameters, null, 2)
  const filtersJson = JSON.stringify(filters, null, 2)

  return {
    ...fallback,
    passthrough,
    id: input.id ?? fileId,
    name: input.name ?? fileId,
    description: input.description ?? "",
    dataSourceId: input.data_source_id ?? "",
    queryType,
    sqlText,
    mongoPipelineText,
    folderPath: folderPath || fallback.folderPath,
    recursive,
    includeMetadata,
    maxFileSize,
    allowedExtensionsText,
    extraParametersJson,
    filtersJson,
    enabled: input.enabled !== false,
  }
}

const parseJsonOrThrow = (source: string, label: string): Record<string, any> => {
  const trimmed = source.trim()
  if (!trimmed) {
    return {}
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (!isRecord(parsed)) {
      throw new Error(`${label} must be a JSON object`)
    }
    return parsed
  } catch (error: any) {
    throw new Error(`${label} JSON is invalid: ${error?.message || "Unknown error"}`)
  }
}

const parseMongoPipeline = (source: string): any[] => {
  const trimmed = source.trim()
  if (!trimmed) {
    return []
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) {
      throw new Error("Pipeline must be a JSON array of stages")
    }
    return parsed
  } catch (error: any) {
    throw new Error(`Mongo pipeline JSON is invalid: ${error?.message || "Unknown error"}`)
  }
}

const sanitizeForSave = (state: QueryEditorState, filePath: string): QueryFile => {
  const fileId = filePath.split("/").pop()?.replace(/\.qry$/, "") || state.id
  const parametersExtras = parseJsonOrThrow(state.extraParametersJson, "Additional parameters")
  const filters = parseJsonOrThrow(state.filtersJson, "Filters")

  const parameters: Record<string, any> = { ...parametersExtras }

  if (state.queryType === "mongo") {
    const pipeline = parseMongoPipeline(state.mongoPipelineText)
    parameters.pipeline = pipeline
  }

  if (state.queryType === "folder") {
    const normalizedPath = state.folderPath?.trim() ? state.folderPath.trim() : "/"
    parameters.folderPath = normalizedPath
    parameters.recursive = Boolean(state.recursive)
    parameters.includeMetadata = Boolean(state.includeMetadata)

    if (typeof state.maxFileSize === "number" && Number.isFinite(state.maxFileSize)) {
      parameters.maxFileSize = state.maxFileSize
    }

    const allowedExtensions = state.allowedExtensionsText
      .split(",")
      .map((ext: string) => ext.trim())
      .filter(Boolean)
      .map((ext: string) => (ext.startsWith(".") ? ext : `.${ext}`))

    if (allowedExtensions.length > 0) {
      parameters.allowedExtensions = Array.from(new Set(allowedExtensions))
    }
  }

  const result: QueryFile = {
    ...state.passthrough,
    id: fileId,
    name: state.name?.trim() || fileId,
    description: state.description?.trim() ? state.description : undefined,
    data_source_id: state.dataSourceId?.trim() || "",
    query_type: state.queryType,
    enabled: state.enabled,
  }

  if (state.queryType === "sql") {
    result.query = state.sqlText
  }

  if (Object.keys(parameters).length > 0) {
    result.parameters = parameters
  }

  if (Object.keys(filters).length > 0) {
    result.filters = filters
  } else if ("filters" in result) {
    delete result.filters
  }

  return result
}

export const QueryEditorLoader: React.FC<QueryEditorLoaderProps> = ({ tabId, filePath }) => {
  const { files, openFile, saveFile, markFileDirty } = useWorkspace()
  const [localData, setLocalData] = useState<QueryEditorState | null>(null)
  const [loading, setLoading] = useState<boolean>(!!filePath)
  const [error, setError] = useState<string | null>(null)
  const loadAttemptedRef = useRef<Set<string>>(new Set())
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
      if (!loadAttemptedRef.current.has(filePath)) {
        loadAttemptedRef.current.add(filePath)
        setLoading(true)
        openFile(filePath).catch((err: any) => {
          console.error("Failed to open query file", err)
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
    if (cachedState && cachedState["queryDefinition"] && lastLoadedHashRef.current === fileHash) {
      setLocalData(cachedState["queryDefinition"] as QueryEditorState)
      setLoading(false)
      setError(null)
      return
    }

    try {
      const parsed = JSON.parse(file.content) as QueryFile
      const normalized = normalizeQueryFromFile(parsed, filePath)
      setLocalData(normalized)
      setTabState(filePath, { queryDefinition: normalized })
      lastLoadedHashRef.current = fileHash
      setError(null)
    } catch (err) {
      console.error("Failed to parse query file", err)
      setError("Invalid query file contents")
    }
    setLoading(false)
  }, [filePath, files, openFile])

  useEffect(() => {
    if (!filePath) return
    const store = getTabStore(tabId)
    if (!store) return

    const unsubscribe = store.subscribe((state) => {
      const value = state.elements["queryDefinition"] as QueryEditorState | undefined
      if (value) {
        setTabState(filePath, { queryDefinition: value })
      }
    })

    return unsubscribe
  }, [filePath, tabId])

  useEffect(() => {
    if (!filePath) return
    const store = getTabStore(tabId)
    if (!store) return

    const unsubscribe = store.subscribe((state) => {
      markFileDirty(filePath, state.hasUnsavedChanges)
    })

    return unsubscribe
  }, [filePath, markFileDirty, tabId])

  useEffect(() => {
    if (!filePath) return

    const handleSave = async (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (!detail || detail.path !== filePath) {
        return
      }

      const store = getTabStore(tabId)
      if (!store) {
        console.warn("No tab store available for query save", tabId)
        return
      }

      const currentElements = store.getState().elements
      const rawData = currentElements["queryDefinition"] as QueryEditorState | undefined
      if (!rawData) {
        console.warn("No query data found in store")
        return
      }

      try {
        const prepared = sanitizeForSave(rawData, filePath)
        await saveFile(filePath, JSON.stringify(prepared, null, 2))
        setTabState(filePath, { queryDefinition: rawData })
        store.getState().markAsSaved()
        markFileDirty(filePath, false)
        setLocalData({ ...rawData })
        toast({ title: "Query saved", description: filePath })
      } catch (err: any) {
        console.error("Failed to save query", err)
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
    return localData ? { queryDefinition: localData } : undefined
  }, [localData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading query…</div>
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
        <div className="text-muted-foreground">No query loaded</div>
      </div>
    )
  }

  return (
    <BuilderStoreProvider tabId={tabId} initialElements={initialElements}>
      <QueryEditor />
    </BuilderStoreProvider>
  )
}
