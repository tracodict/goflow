"use client"

import React, { useEffect, useMemo, useRef, useState, useId } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { json } from "@codemirror/lang-json"
import { sql } from "@codemirror/lang-sql"
import { useBuilderStoreContext } from "@/stores/pagebuilder/editor-context"
import { useDataSourceStore } from "@/stores/filestore-datasource"
import { useFlowServiceUrl } from "@/hooks/use-flow-service-url"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ResizableCodeMirror } from "@/components/ui/resizable-codemirror"

export type QueryType = "sql" | "mongo" | "folder" | "select"

export interface QueryEditorState {
  id: string
  name: string
  description?: string
  dataSourceId: string
  queryType: QueryType
  sqlText: string
  mongoPipelineText: string
  folderPath: string
  recursive: boolean
  includeMetadata: boolean
  maxFileSize?: number
  allowedExtensionsText: string
  extraParametersJson: string
  filtersJson: string
  enabled: boolean
  passthrough: Record<string, any>
}

const DEFAULT_MONGO_PIPELINE = `[
  { "$limit": 50 }
]`

export const createDefaultQueryState = (): QueryEditorState => ({
  id: "",
  name: "",
  description: "",
  dataSourceId: "",
  queryType: "sql",
  sqlText: "SELECT 1",
  mongoPipelineText: DEFAULT_MONGO_PIPELINE,
  folderPath: "/",
  recursive: true,
  includeMetadata: true,
  maxFileSize: undefined,
  allowedExtensionsText: ".json, .txt",
  extraParametersJson: "{}",
  filtersJson: "{}",
  enabled: true,
  passthrough: {},
})

const buildValidationErrors = (
  state: QueryEditorState,
  pipelineError: string | null,
  paramsError: string | null,
  filtersError: string | null
): string[] => {
  const issues: string[] = []

  if (!state.name.trim()) {
    issues.push("Name is required")
  }

  if (!state.dataSourceId.trim()) {
    issues.push("Datasource ID is required")
  }

  if (state.queryType === "sql" && !state.sqlText.trim()) {
    issues.push("SQL query cannot be empty")
  }

  if (state.queryType === "mongo" && pipelineError) {
    issues.push(pipelineError)
  }

  if (state.queryType === "folder" && !state.folderPath.trim()) {
    issues.push("Folder path is required for folder queries")
  }

  if (paramsError) {
    issues.push(paramsError)
  }

  if (filtersError) {
    issues.push(filtersError)
  }

  return issues
}

export const QueryEditor: React.FC = () => {
  const store = useBuilderStoreContext()
  const elements = store((state) => state.elements)
  const updateElement = store((state) => state.updateElement)
  const markAsChanged = store((state) => state.markAsChanged)
  const markAsSaved = store((state) => state.markAsSaved)

  const { dataSources, fetchDataSources, loading: dsLoading } = useDataSourceStore()
  const flowServiceUrl = useFlowServiceUrl({ includeDefault: false })

  const storedSnapshot = useMemo(() => {
    const current = elements["queryDefinition"] as unknown as QueryEditorState | undefined
    return current ? { ...current } : createDefaultQueryState()
  }, [elements])

  const [queryState, setQueryState] = useState<QueryEditorState>(storedSnapshot)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [paramsError, setParamsError] = useState<string | null>(null)
  const [filtersError, setFiltersError] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const lastAppliedRef = useRef<string>(JSON.stringify(storedSnapshot))
  const suppressChangeRef = useRef<boolean>(true)

  const datasourceDatalistId = useId()

  useEffect(() => {
    const snapshot = JSON.stringify(storedSnapshot)
    if (snapshot !== lastAppliedRef.current) {
      lastAppliedRef.current = snapshot
      suppressChangeRef.current = true
      setQueryState(storedSnapshot)
    }
  }, [storedSnapshot])

  useEffect(() => {
    try {
      if (queryState.queryType !== "mongo" || !queryState.mongoPipelineText.trim()) {
        setPipelineError(null)
        return
      }
      const parsed = JSON.parse(queryState.mongoPipelineText)
      if (!Array.isArray(parsed)) {
        setPipelineError("Mongo pipeline must be a JSON array of stages")
        return
      }
      setPipelineError(null)
    } catch (error: any) {
      setPipelineError(error?.message || "Invalid Mongo pipeline JSON")
    }
  }, [queryState.queryType, queryState.mongoPipelineText])

  useEffect(() => {
    try {
      if (!queryState.extraParametersJson.trim()) {
        setParamsError(null)
        return
      }
      const parsed = JSON.parse(queryState.extraParametersJson)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setParamsError(null)
      } else {
        setParamsError("Additional parameters must be a JSON object")
      }
    } catch (error: any) {
      setParamsError(error?.message || "Invalid parameters JSON")
    }
  }, [queryState.extraParametersJson])

  useEffect(() => {
    try {
      if (!queryState.filtersJson.trim()) {
        setFiltersError(null)
        return
      }
      const parsed = JSON.parse(queryState.filtersJson)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setFiltersError(null)
      } else {
        setFiltersError("Filters must be a JSON object")
      }
    } catch (error: any) {
      setFiltersError(error?.message || "Invalid filters JSON")
    }
  }, [queryState.filtersJson])

  useEffect(() => {
    const snapshot = JSON.stringify(queryState)
    if (snapshot === lastAppliedRef.current) {
      return
    }

    lastAppliedRef.current = snapshot
    updateElement("queryDefinition", queryState as any)

    if (suppressChangeRef.current) {
      suppressChangeRef.current = false
    } else {
      markAsChanged()
    }
  }, [queryState, updateElement, markAsChanged])

  useEffect(() => {
    setErrors(buildValidationErrors(queryState, pipelineError, paramsError, filtersError))
  }, [queryState, pipelineError, paramsError, filtersError])

  useEffect(() => {
    if (dataSources.length > 0 || !flowServiceUrl) {
      return
    }
    fetchDataSources(flowServiceUrl).catch((error: any) => {
      console.warn("Failed to fetch data sources", error)
    })
  }, [dataSources.length, fetchDataSources, flowServiceUrl])

  const refreshDatasources = async () => {
    if (!flowServiceUrl) {
      toast({
        title: "Missing flow service URL",
        description: "Configure flowServiceUrl in System Settings.",
        variant: "destructive",
      })
      return
    }

    try {
      await fetchDataSources(flowServiceUrl)
      toast({ title: "Datasources refreshed" })
    } catch (error: any) {
      toast({
        title: "Failed to refresh datasources",
        description: error?.message || "Unexpected error",
        variant: "destructive",
      })
    }
  }

  const updateState = (updates: Partial<QueryEditorState>) => {
    setQueryState((prev) => ({ ...prev, ...updates }))
  }

  const handleQueryTypeChange = (type: QueryType) => {
    setQueryState((prev) => {
      const next: QueryEditorState = { ...prev, queryType: type }
      if (type === "sql" && !prev.sqlText.trim()) {
        next.sqlText = "SELECT 1"
      }
      if (type === "mongo" && !prev.mongoPipelineText.trim()) {
        next.mongoPipelineText = DEFAULT_MONGO_PIPELINE
      }
      if (type === "folder" && !prev.folderPath.trim()) {
        next.folderPath = "/"
      }
      return next
    })
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-10 border-b border-border flex items-center px-4 bg-card justify-between">
        <div className="flex items-center gap-2">
          <strong className="text-sm">Query Editor</strong>
          {errors.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>
                {errors.length} issue{errors.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
        <div className={`text-xs px-2 py-0.5 rounded ${queryState.enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
          {queryState.enabled ? "Enabled" : "Disabled"}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {errors.length > 0 && (
            <div className="rounded border border-destructive/50 bg-destructive/10 p-3 space-y-1">
              {errors.map((error) => (
                <div key={error} className="text-xs text-destructive flex items-start gap-2">
                  <AlertCircle className="h-3 w-3 mt-0.5" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1 text-sm">
            <span className="font-semibold">Query ID</span>
            <div className="px-3 py-2 rounded border bg-muted/40 font-mono text-xs select-text">
              {queryState.id || "(not set)"}
            </div>
            <p className="text-xs text-muted-foreground">
              ID is derived from the file name. Rename the file to change the ID.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Display Name</label>
              <Input
                value={queryState.name}
                onChange={(e) => updateState({ name: e.target.value })}
                placeholder="Customer Lookup"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Datasource ID</label>
              <Input
                list={datasourceDatalistId}
                value={queryState.dataSourceId}
                onChange={(e) => updateState({ dataSourceId: e.target.value })}
                placeholder="Select or type datasource ID"
              />
              <datalist id={datasourceDatalistId}>
                {dataSources.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {`${ds.name || ds.id} (${ds.type})`}
                  </option>
                ))}
              </datalist>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>{dataSources.find((ds) => ds.id === queryState.dataSourceId)?.name || ""}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={refreshDatasources}
                  disabled={dsLoading}
                  className="h-7 px-2"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${dsLoading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Description</label>
            <Textarea
              rows={3}
              value={queryState.description || ""}
              onChange={(e) => updateState({ description: e.target.value })}
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Query Type</label>
              <select
                className="w-full px-3 py-2 rounded border text-sm"
                value={queryState.queryType}
                onChange={(e) => handleQueryTypeChange(e.target.value as QueryType)}
              >
                <option value="sql">SQL</option>
                <option value="mongo">Mongo Aggregation</option>
                <option value="folder">Folder Listing (S3/GCS)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Enabled</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  id="query-enabled-toggle"
                  type="checkbox"
                  className="h-4 w-4 rounded border"
                  checked={queryState.enabled}
                  onChange={(e) => updateState({ enabled: e.target.checked })}
                />
                <label htmlFor="query-enabled-toggle" className="text-sm cursor-pointer">
                  {queryState.enabled ? "Active" : "Inactive"}
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Mark Clean</label>
              <Button
                size="sm"
                variant="outline"
                type="button"
                className="mt-1"
                onClick={() => {
                  markAsSaved()
                  toast({ title: "Tab state marked as saved" })
                }}
              >
                Clear Unsaved Flag
              </Button>
            </div>
          </div>

          {queryState.queryType === "sql" && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">SQL Query</label>
              <ResizableCodeMirror
                value={queryState.sqlText}
                onChange={(value) => updateState({ sqlText: value })}
                extensions={[sql()]}
                basicSetup={{ lineNumbers: true, highlightActiveLine: true }}
                initialHeight={300}
                storageKey="builder-query-sql"
              />
            </div>
          )}

          {queryState.queryType === "mongo" && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">Mongo Aggregation Pipeline</label>
              <ResizableCodeMirror
                value={queryState.mongoPipelineText}
                onChange={(value) => updateState({ mongoPipelineText: value })}
                extensions={[json()]}
                basicSetup={{ lineNumbers: true, highlightActiveLine: true }}
                initialHeight={300}
                storageKey="builder-query-mongo"
              />
              {pipelineError && <p className="text-xs text-destructive">{pipelineError}</p>}
            </div>
          )}

          {queryState.queryType === "folder" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Folder Path</label>
                <Input
                  value={queryState.folderPath}
                  onChange={(e) => updateState({ folderPath: e.target.value })}
                  placeholder="/reports/2025"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Max File Size (bytes)</label>
                  <Input
                    type="number"
                    value={queryState.maxFileSize ?? ""}
                    onChange={(e) => {
                      const value = e.target.value
                      updateState({ maxFileSize: value ? Number(value) : undefined })
                    }}
                    placeholder="10485760"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Allowed Extensions</label>
                  <Input
                    value={queryState.allowedExtensionsText}
                    onChange={(e) => updateState({ allowedExtensionsText: e.target.value })}
                    placeholder=".json, .txt, .csv"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border"
                    checked={queryState.recursive}
                    onChange={(e) => updateState({ recursive: e.target.checked })}
                  />
                  Recursive
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border"
                    checked={queryState.includeMetadata}
                    onChange={(e) => updateState({ includeMetadata: e.target.checked })}
                  />
                  Include metadata
                </label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Additional Parameters (JSON)</label>
              {paramsError && <span className="text-xs text-destructive">{paramsError}</span>}
            </div>
            <Textarea
              rows={6}
              value={queryState.extraParametersJson}
              onChange={(e) => updateState({ extraParametersJson: e.target.value })}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Filters (JSON)</label>
              {filtersError && <span className="text-xs text-destructive">{filtersError}</span>}
            </div>
            <Textarea
              rows={4}
              value={queryState.filtersJson}
              onChange={(e) => updateState({ filtersJson: e.target.value })}
              className="font-mono text-xs"
            />
          </div>

          <div className="pt-4 border-t text-xs text-muted-foreground space-y-2">
            <p>Use the workspace save command (⌘/Ctrl + S) to persist this query back to the repository.</p>
            <p>Credentials and secrets should not be included in query definitions.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
