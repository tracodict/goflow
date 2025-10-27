"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useBuilderStoreContext } from "@/stores/pagebuilder/editor-context"
import { AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { DEFAULT_SETTINGS, useSystemSettings } from "@/components/petri/system-settings-context"
import { encodeWorkspaceId } from "@/lib/workspace/id"
import { useWorkspace } from "@/stores/workspace-store"

export type DataSourceType = "mongodb" | "postgres" | "mysql" | "s3" | "gcs"

export interface DataSourceConfig {
  id: string
  name: string
  type: DataSourceType
  description?: string
  config: Record<string, any>
  credentials?: Record<string, any>
  enabled: boolean
}

const DEFAULT_CONFIG: Record<DataSourceType, Record<string, any>> = {
  mongodb: { database: "app" },
  postgres: { host: "localhost", port: 5432, database: "app" },
  mysql: { host: "localhost", port: 3306, database: "app" },
  s3: { bucketName: "", region: "us-east-1" },
  gcs: { bucketName: "", projectId: "", region: "us-central1" },
}

const normalizeDataSource = (input: Partial<DataSourceConfig> | undefined): DataSourceConfig => {
  const baseType = (input?.type as DataSourceType) || "mongodb"
  return {
    id: input?.id ?? "",
    name: input?.name ?? "",
    type: baseType,
    description: input?.description,
    config: { ...DEFAULT_CONFIG[baseType], ...(input?.config || {}) },
    credentials: { ...(input?.credentials || {}) },
    enabled: input?.enabled !== false,
  }
}

const buildValidationErrors = (ds: DataSourceConfig, uriError: string): string[] => {
  const errors: string[] = []

  if (!ds.name.trim()) {
    errors.push("Name is required")
  }

  if (ds.type === "gcs") {
    if (!ds.config.bucketName) {
      errors.push("GCS bucket name is required")
    }
  } else if (ds.type === "s3") {
    if (!ds.config.bucketName) {
      errors.push("S3 bucket name is required")
    }
  } else {
    if (!ds.config.uri && !ds.config.host) {
      errors.push("Provide either a connection URI or host information")
    }
  }

  if (uriError) {
    errors.push(uriError)
  }

  return errors
}

const validateUriFormat = (
  uri: string,
  type: Extract<DataSourceType, "mongodb" | "postgres" | "mysql">
): { valid: boolean; error?: string } => {
  if (!uri || uri.trim() === "") {
    return { valid: true }
  }

  const protocolRules: Record<typeof type, { pattern: RegExp; label: string }> = {
    mongodb: { pattern: /^mongodb(\+srv)?:\/\//i, label: "mongodb:// or mongodb+srv://" },
    postgres: { pattern: /^postgres(ql)?:\/\//i, label: "postgres:// or postgresql://" },
    mysql: { pattern: /^mysql:\/\//i, label: "mysql://" },
  }

  const { pattern, label } = protocolRules[type]
  if (!pattern.test(uri)) {
    return { valid: false, error: `Invalid URI format. Expected prefix ${label}` }
  }

  try {
    const normalized = type === "postgres" ? uri.replace(/^postgres:\/\//i, "postgresql://") : uri
    new URL(normalized)
    return { valid: true }
  } catch {
    return { valid: false, error: "Malformed URI. Check host, credentials, and database name." }
  }
}

export const DataSourceEditor: React.FC = () => {
  const store = useBuilderStoreContext()
  const elements = store((state) => state.elements)
  const updateElement = store((state) => state.updateElement)
  const markAsChanged = store((state) => state.markAsChanged)
  const { workspaceId, provider } = useWorkspace((state) => ({
    workspaceId: state.workspaceId,
    provider: state.provider,
  }))
  const { settings } = useSystemSettings()

  const storedSnapshot = useMemo(
    () => normalizeDataSource(elements["datasource"] as unknown as DataSourceConfig | undefined),
    [elements]
  )

  const [dataSource, setDataSource] = useState<DataSourceConfig>(storedSnapshot)
  const [uriError, setUriError] = useState<string>("")
  const [errors, setErrors] = useState<string[]>([])
  const [testingConnection, setTestingConnection] = useState<boolean>(false)
  const [testStatus, setTestStatus] = useState<{ state: "success" | "error"; message: string } | null>(null)

  const lastAppliedRef = useRef<string>(JSON.stringify(storedSnapshot))
  const suppressChangeRef = useRef<boolean>(true)
  const lastParsedUriRef = useRef<string>("")
  const isParsingRef = useRef<boolean>(false)

  // Sync local state when store updates externally (e.g., file reload)
  useEffect(() => {
    const snapshot = JSON.stringify(storedSnapshot)
    if (snapshot !== lastAppliedRef.current) {
      lastAppliedRef.current = snapshot
      suppressChangeRef.current = true
      setDataSource(storedSnapshot)
      setUriError("")
    }
  }, [storedSnapshot])

  // Push local state to store when it changes
  useEffect(() => {
    const snapshot = JSON.stringify(dataSource)
    if (snapshot === lastAppliedRef.current) {
      return
    }

    lastAppliedRef.current = snapshot
    updateElement("datasource", dataSource as any)

    if (suppressChangeRef.current) {
      suppressChangeRef.current = false
    } else {
      markAsChanged()
    }
  }, [dataSource, updateElement, markAsChanged])

  // Validation tracking
  useEffect(() => {
    setErrors(buildValidationErrors(dataSource, uriError))
  }, [dataSource, uriError])

  const updateDataSource = (updates: Partial<DataSourceConfig>) => {
    setDataSource((prev) => normalizeDataSource({ ...prev, ...updates }))
  }

  const updateConfig = (updates: Record<string, any>) => {
    setDataSource((prev) => {
      const next = {
        ...prev,
        config: {
          ...prev.config,
          ...updates,
        },
      }

      if (
        typeof updates.uri === "string" &&
        (prev.type === "mongodb" || prev.type === "postgres" || prev.type === "mysql")
      ) {
        const { valid, error } = validateUriFormat(updates.uri, prev.type)
        if (!valid) {
          setUriError(error || "Invalid URI")
        } else {
          setUriError("")
          if (
            updates.uri &&
            updates.uri !== lastParsedUriRef.current &&
            updates.uri.trim() !== ""
          ) {
            lastParsedUriRef.current = updates.uri
            parseAndPopulateFromUri(updates.uri, prev.type)
          }
        }
      }

      return next
    })
  }

  const updateCredentials = (updates: Record<string, any>) => {
    setDataSource((prev) => ({
      ...prev,
      credentials: {
        ...(prev.credentials || {}),
        ...updates,
      },
    }))
  }

  const parseAndPopulateFromUri = async (
    uri: string,
    type: Extract<DataSourceType, "mongodb" | "postgres" | "mysql">
  ) => {
    if (!uri || isParsingRef.current) {
      return
    }

    isParsingRef.current = true
    try {
      const response = await fetch("/api/datasource-crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "parseUri",
          data: { uri, type },
        }),
      })

      if (response.ok) {
        const { parsed } = await response.json()
        if (parsed && typeof parsed === "object") {
          setDataSource((prev) => ({
            ...prev,
            config: {
              ...prev.config,
              ...(parsed.host && { host: parsed.host }),
              ...(parsed.port && { port: parsed.port }),
              ...(parsed.database && { database: parsed.database }),
            },
            credentials: {
              ...(prev.credentials || {}),
              ...(parsed.username && { username: parsed.username }),
              ...(parsed.password && { password: parsed.password }),
            },
          }))
        }
      }
    } catch (error) {
      console.error("Failed to parse connection URI", error)
      toast({
        title: "Unable to parse URI",
        description: "Please verify the connection string format.",
        variant: "destructive",
      })
    } finally {
      isParsingRef.current = false
    }
  }

  const handleTypeChange = (type: DataSourceType) => {
    setDataSource((prev) => ({
      ...normalizeDataSource({ ...prev, type }),
      id: prev.id,
      name: prev.name,
      description: prev.description,
      enabled: prev.enabled,
    }))
    setUriError("")
    lastParsedUriRef.current = ""
  }

  const renderDatabaseFields = () => (
    <>
      <div className="space-y-2">
        <label className="text-sm font-semibold">Connection URI (optional)</label>
        <input
          type="password"
          className={`w-full px-3 py-2 rounded border text-sm font-mono ${uriError ? "border-destructive focus:ring-destructive" : ""}`}
          value={dataSource.config.uri || ""}
          onChange={(e) => updateConfig({ uri: e.target.value })}
          placeholder={
            dataSource.type === "mongodb"
              ? "mongodb://user:pass@host:27017/db"
              : dataSource.type === "postgres"
              ? "postgres://user:pass@host:5432/db"
              : "mysql://user:pass@host:3306/db"
          }
        />
        {uriError ? (
          <div className="flex items-start gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
            <span>{uriError}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            URI values override the host/port/username/password fields when provided.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Host</label>
          <input
            className="w-full px-3 py-2 rounded border text-sm"
            value={dataSource.config.host || ""}
            onChange={(e) => updateConfig({ host: e.target.value })}
            placeholder="localhost"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">Port</label>
          <input
            type="number"
            className="w-full px-3 py-2 rounded border text-sm"
            value={dataSource.config.port ?? ""}
            onChange={(e) =>
              updateConfig({ port: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder={dataSource.type === "postgres" ? "5432" : "3306"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold">Database Name</label>
        <input
          className="w-full px-3 py-2 rounded border text-sm"
          value={dataSource.config.database || ""}
          onChange={(e) => updateConfig({ database: e.target.value })}
          placeholder="mydb"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Username</label>
          <input
            className="w-full px-3 py-2 rounded border text-sm"
            value={dataSource.credentials?.username || ""}
            onChange={(e) => updateCredentials({ username: e.target.value })}
            placeholder="db-user"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">Password</label>
          <input
            type="password"
            className="w-full px-3 py-2 rounded border text-sm"
            value={dataSource.credentials?.password || ""}
            onChange={(e) => updateCredentials({ password: e.target.value })}
            placeholder="••••••"
          />
        </div>
      </div>
    </>
  )

  const renderS3Fields = () => (
    <>
      <div className="space-y-2">
        <label className="text-sm font-semibold">Bucket Name</label>
        <input
          className="w-full px-3 py-2 rounded border text-sm"
          value={dataSource.config.bucketName || ""}
          onChange={(e) => updateConfig({ bucketName: e.target.value })}
          placeholder="my-s3-bucket"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Access Key</label>
          <input
            className="w-full px-3 py-2 rounded border text-sm font-mono"
            value={dataSource.credentials?.accessKey || ""}
            onChange={(e) => updateCredentials({ accessKey: e.target.value })}
            placeholder="AKIA..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">Secret Key</label>
          <input
            type="password"
            className="w-full px-3 py-2 rounded border text-sm font-mono"
            value={dataSource.credentials?.secretKey || ""}
            onChange={(e) => updateCredentials({ secretKey: e.target.value })}
            placeholder="••••••"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Region</label>
          <input
            className="w-full px-3 py-2 rounded border text-sm"
            value={dataSource.config.region || ""}
            onChange={(e) => updateConfig({ region: e.target.value })}
            placeholder="us-east-1"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">Endpoint (optional)</label>
          <input
            className="w-full px-3 py-2 rounded border text-sm"
            value={dataSource.config.endpoint || ""}
            onChange={(e) => updateConfig({ endpoint: e.target.value })}
            placeholder="https://s3.amazonaws.com"
          />
        </div>
      </div>
    </>
  )

  const renderGcsFields = () => (
    <>
      <div className="space-y-2">
        <label className="text-sm font-semibold">Bucket Name</label>
        <input
          className="w-full px-3 py-2 rounded border text-sm"
          value={dataSource.config.bucketName || ""}
          onChange={(e) => updateConfig({ bucketName: e.target.value })}
          placeholder="my-gcs-bucket"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Project ID</label>
          <input
            className="w-full px-3 py-2 rounded border text-sm"
            value={dataSource.config.projectId || ""}
            onChange={(e) => updateConfig({ projectId: e.target.value })}
            placeholder="my-project"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">Region</label>
          <input
            className="w-full px-3 py-2 rounded border text-sm"
            value={dataSource.config.region || ""}
            onChange={(e) => updateConfig({ region: e.target.value })}
            placeholder="us-central1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold">Service Account Key (JSON)</label>
        <textarea
          className="w-full px-3 py-2 rounded border text-sm font-mono resize-none"
          rows={5}
          value={dataSource.credentials?.apiKey || ""}
          onChange={(e) => updateCredentials({ apiKey: e.target.value })}
          placeholder='{"type":"service_account","project_id":"..."}'
        />
      </div>
    </>
  )

  const sanitizeObject = (input: Record<string, any> | undefined) =>
    Object.fromEntries(
      Object.entries(input || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
    )

  const buildTestPayload = (input: DataSourceConfig) => {
    const draft: Record<string, any> = {
      type: input.type,
      config: sanitizeObject(input.config),
      enabled: input.enabled,
    }

    if (input.name) {
      draft.name = input.name
    }

    if (input.description) {
      draft.description = input.description
    }

    const credentials = sanitizeObject(input.credentials)
    return {
      draft,
      secret: Object.keys(credentials).length > 0 ? credentials : undefined,
    }
  }

  const handleTestConnection = async () => {
    if (!dataSource.id) {
      toast({ title: "Missing data source ID", description: "Save the file with a valid name before testing.", variant: "destructive" })
      return
    }

    if (!workspaceId) {
      toast({ title: "No workspace", description: "Open a workspace before testing the datasource.", variant: "destructive" })
      return
    }

    if (provider !== "github") {
      toast({ title: "Unsupported workspace provider", description: "Datasource testing is only available for GitHub-backed workspaces.", variant: "destructive" })
      return
    }

    const baseUrl = (settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl || "").trim()
    if (!baseUrl) {
      toast({ title: "Missing flow service URL", description: "Configure flowServiceUrl in System Settings to run connection tests.", variant: "destructive" })
      return
    }

    const { draft, secret } = buildTestPayload(dataSource)
    const encodedWorkspace = encodeWorkspaceId(workspaceId)
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/ws/${encodedWorkspace}/ds/${encodeURIComponent(dataSource.id)}/test`
    const body: Record<string, any> = { draft }

    if (secret) {
      body.secret = secret
    }

    setTestingConnection(true)
    setTestStatus(null)

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })

      const isJson = (response.headers.get("Content-Type") || "").includes("application/json")
      const payload = isJson ? await response.json() : null

      if (!response.ok || payload?.success === false) {
        const message = payload?.error?.message || payload?.message || `Request failed (${response.status})`
        throw new Error(message)
      }

      const result = payload?.data ?? payload
      if (!result || typeof result.ok !== "boolean") {
        throw new Error("Unexpected response from server")
      }

      if (result.ok) {
        const latency = typeof result.latencyMs === "number" ? `${Math.round(result.latencyMs)} ms` : "success"
        setTestStatus({ state: "success", message: `Connection verified${latency === "success" ? "" : ` (${latency})`}` })
        toast({ title: "Connection succeeded", description: latency === "success" ? "Datasource test passed." : `Latency: ${latency}` })
      } else {
        const message = result.error || "Datasource test failed"
        setTestStatus({ state: "error", message })
        toast({ title: "Connection failed", description: message, variant: "destructive" })
      }
    } catch (error: any) {
      console.error("Datasource test failed", error)
      const message = error?.message || "Unable to test data source"
      setTestStatus({ state: "error", message })
      toast({ title: "Connection failed", description: message, variant: "destructive" })
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-10 border-b border-border flex items-center px-4 bg-card justify-between">
        <div className="flex items-center gap-2">
          <strong className="text-sm">Data Source Editor</strong>
          {errors.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>{errors.length} issue{errors.length === 1 ? "" : "s"}</span>
            </div>
          )}
        </div>
        <div className={`text-xs px-2 py-0.5 rounded ${dataSource.enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
          {dataSource.enabled ? "Enabled" : "Disabled"}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
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
            <span className="font-semibold">Data Source ID</span>
            <div className="px-3 py-2 rounded border bg-muted/40 font-mono text-xs select-text">
              {dataSource.id || "(not set)"}
            </div>
            <p className="text-xs text-muted-foreground">
              ID is derived from the file name and cannot be edited here. Rename the file in the explorer to change the ID.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Display Name</label>
            <input
              className="w-full px-3 py-2 rounded border text-sm"
              value={dataSource.name}
              onChange={(e) => updateDataSource({ name: e.target.value })}
              placeholder="My Data Source"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Description</label>
            <textarea
              className="w-full px-3 py-2 rounded border text-sm resize-none"
              rows={3}
              value={dataSource.description || ""}
              onChange={(e) => updateDataSource({ description: e.target.value })}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Data Source Type</label>
            <select
              className="w-full px-3 py-2 rounded border text-sm"
              value={dataSource.type}
              onChange={(e) => handleTypeChange(e.target.value as DataSourceType)}
            >
              <option value="mongodb">MongoDB</option>
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="s3">Amazon S3</option>
              <option value="gcs">Google Cloud Storage</option>
            </select>
          </div>

          {dataSource.type === "mongodb" || dataSource.type === "postgres" || dataSource.type === "mysql"
            ? renderDatabaseFields()
            : null}
          {dataSource.type === "s3" ? renderS3Fields() : null}
          {dataSource.type === "gcs" ? renderGcsFields() : null}

          <div className="space-y-1 pt-2">
            <div className="flex items-center gap-2">
              <input
                id="ds-enabled-toggle"
                type="checkbox"
                className="h-4 w-4 rounded border"
                checked={dataSource.enabled}
                onChange={(e) => updateDataSource({ enabled: e.target.checked })}
              />
              <label htmlFor="ds-enabled-toggle" className="text-sm font-semibold cursor-pointer">
                Enabled
              </label>
              <button
                type="button"
                className="ml-auto px-3 py-1.5 rounded border text-xs font-semibold hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? "Testing…" : "Test Connection"}
              </button>
            </div>
            {testingConnection ? (
              <p className="text-xs text-muted-foreground">Testing connection…</p>
            ) : testStatus ? (
              <p
                className={`text-xs ${testStatus.state === "success" ? "text-emerald-600" : "text-destructive"}`}
              >
                {testStatus.message}
              </p>
            ) : null}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Credentials are encrypted before the file is saved via workspace commits. Avoid sharing raw secrets in version control.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
