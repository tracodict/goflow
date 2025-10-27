"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { useBuilderStoreContext } from "@/stores/pagebuilder/editor-context"
import { useSystemSettings } from "@/components/petri/system-settings-context"
import { listMcpTools, registerMcpServer, withApiErrorToast } from "@/components/petri/petri-client"
import {
  McpEditorState,
  McpResourceState,
  McpToolState,
  createDefaultMcpEditorState,
  validateMcpState,
} from "./mcp-utils"

const cloneTool = (tool: McpToolState): McpToolState => ({
  ...tool,
  passthrough: { ...tool.passthrough },
})

const cloneResource = (resource: McpResourceState): McpResourceState => ({
  ...resource,
  passthrough: { ...resource.passthrough },
})

const cloneState = (state: McpEditorState): McpEditorState => ({
  ...state,
  tools: state.tools.map(cloneTool),
  resources: state.resources.map(cloneResource),
  passthrough: { ...state.passthrough },
})

const normalizeDiscoveryTool = (value: any): McpToolState => {
  if (typeof value === "string") {
    return {
      name: value,
      description: undefined,
      enabled: true,
      passthrough: {},
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      name: "",
      description: undefined,
      enabled: true,
      passthrough: {},
    }
  }

  const { name, description, enabled, ...rest } = value as Record<string, any>

  return {
    name: typeof name === "string" ? name : "",
    description: typeof description === "string" ? description : undefined,
    enabled: enabled !== false,
    passthrough: { ...rest },
  }
}

const mergeDiscoveredTools = (existing: McpToolState[], discovered: McpToolState[]): McpToolState[] => {
  if (discovered.length === 0) {
    return existing.map(cloneTool)
  }

  const indexByName = new Map<string, number>()
  existing.forEach((tool, index) => {
    const key = tool.name.trim().toLowerCase()
    if (key) {
      indexByName.set(key, index)
    }
  })

  const next = existing.map(cloneTool)

  discovered.forEach((tool) => {
    const key = tool.name.trim().toLowerCase()
    if (!key) {
      return
    }
    const match = indexByName.get(key)
    if (match !== undefined) {
      const current = next[match]
      next[match] = {
        ...current,
        description: tool.description || current.description,
        passthrough: { ...tool.passthrough, ...current.passthrough },
      }
    } else {
      next.push({
        ...tool,
        enabled: true,
        passthrough: { ...tool.passthrough },
      })
    }
  })

  return next
}

const toTimeout = (value?: number): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value))
  }
  return undefined
}

export const McpEditor: React.FC = () => {
  const store = useBuilderStoreContext()
  const elements = store((state) => state.elements)
  const updateElement = store((state) => state.updateElement)
  const markAsChanged = store((state) => state.markAsChanged)

  const { settings } = useSystemSettings()

  const storedSnapshot = useMemo(() => {
    const raw = elements["mcp"] as unknown
    if (raw && typeof raw === "object") {
      return cloneState(raw as McpEditorState)
    }
    return createDefaultMcpEditorState("")
  }, [elements])

  const [mcp, setMcp] = useState<McpEditorState>(storedSnapshot)
  const [discovering, setDiscovering] = useState(false)
  const [registering, setRegistering] = useState(false)

  const lastAppliedRef = useRef<string>(JSON.stringify(storedSnapshot))
  const suppressChangeRef = useRef<boolean>(true)

  useEffect(() => {
    const snapshot = JSON.stringify(storedSnapshot)
    if (snapshot !== lastAppliedRef.current) {
      lastAppliedRef.current = snapshot
      suppressChangeRef.current = true
      setMcp(cloneState(storedSnapshot))
    }
  }, [storedSnapshot])

  useEffect(() => {
    const snapshot = JSON.stringify(mcp)
    if (snapshot === lastAppliedRef.current) {
      return
    }

    lastAppliedRef.current = snapshot
  updateElement("mcp", cloneState(mcp) as any)

    if (suppressChangeRef.current) {
      suppressChangeRef.current = false
    } else {
      markAsChanged()
    }
  }, [mcp, updateElement, markAsChanged])

  const validationErrors = useMemo(() => validateMcpState(mcp), [mcp])

  const resourceErrors = useMemo(() => {
    const errors: Record<number, string> = {}
    mcp.resources.forEach((resource, index) => {
      const text = resource.configText?.trim()
      if (!text) {
        return
      }
      try {
        JSON.parse(text)
      } catch (error: any) {
        errors[index] = typeof error?.message === "string" ? error.message : "Invalid JSON"
      }
    })
    return errors
  }, [mcp.resources])

  const handleDiscover = async () => {
    const baseUrl = mcp.baseUrl.trim()
    if (!baseUrl) {
      toast({ title: "Enter a base URL before discovering tools", variant: "destructive" })
      return
    }

    const flowServiceUrl = settings.flowServiceUrl?.trim()
    if (!flowServiceUrl) {
      toast({ title: "Flow service URL is not configured", variant: "destructive" })
      return
    }

    setDiscovering(true)
    try {
      const tools = await withApiErrorToast(
        listMcpTools(flowServiceUrl, { baseUrl, timeoutMs: toTimeout(mcp.timeoutMs) }),
        toast,
        "Discover MCP tools"
      )

      const normalized = Array.isArray(tools)
        ? tools.map(normalizeDiscoveryTool).filter((tool) => tool.name.trim())
        : []

      setMcp((prev) => ({
        ...prev,
        tools: mergeDiscoveredTools(prev.tools, normalized),
      }))

      if (!normalized.length) {
        toast({ title: "No tools reported by the MCP server", description: baseUrl })
      }
    } catch (error) {
      // Error surfaced by wrapper
    } finally {
      setDiscovering(false)
    }
  }

  const handleRegister = async () => {
    const baseUrl = mcp.baseUrl.trim()
    if (!baseUrl) {
      toast({ title: "Base URL is required", variant: "destructive" })
      return
    }

    const flowServiceUrl = settings.flowServiceUrl?.trim()
    if (!flowServiceUrl) {
      toast({ title: "Flow service URL is not configured", variant: "destructive" })
      return
    }

    const errors = validateMcpState(mcp)
    if (errors.length > 0) {
      toast({ title: "Fix validation issues before registering", description: errors[0], variant: "destructive" })
      return
    }

    setRegistering(true)
    try {
      await withApiErrorToast(
        registerMcpServer(flowServiceUrl, {
          id: mcp.id.trim() || undefined,
          name: mcp.name.trim() || undefined,
          baseUrl,
          timeoutMs: toTimeout(mcp.timeoutMs),
          tools: mcp.tools
            .filter((tool) => tool.name.trim())
            .map((tool) => ({
              name: tool.name.trim(),
              enabled: tool.enabled !== false,
              ...(tool.description?.trim() ? { description: tool.description.trim() } : {}),
            })),
        }),
        toast,
        "Register MCP server"
      )

      toast({ title: "MCP server registered", description: baseUrl })
      try {
        window.dispatchEvent(
          new CustomEvent("goflow-mcp-registered", { detail: { baseUrl } })
        )
      } catch {
        /* noop */
      }
    } catch (error) {
      // surfaced above
    } finally {
      setRegistering(false)
    }
  }

  const updateField = (updates: Partial<Pick<McpEditorState, "id" | "name" | "baseUrl" | "timeoutMs">>) => {
    setMcp((prev) => ({
      ...prev,
      ...updates,
    }))
  }

  const addTool = () => {
    setMcp((prev) => ({
      ...prev,
      tools: [
        ...prev.tools,
        {
          name: "",
          description: undefined,
          enabled: true,
          passthrough: {},
        },
      ],
    }))
  }

  const updateTool = (index: number, updates: Partial<Omit<McpToolState, "passthrough">>) => {
    setMcp((prev) => {
      if (index < 0 || index >= prev.tools.length) {
        return prev
      }
      const tools = prev.tools.map((tool, idx) =>
        idx === index
          ? {
              ...tool,
              ...updates,
              passthrough: { ...tool.passthrough },
            }
          : tool
      )
      return { ...prev, tools }
    })
  }

  const removeTool = (index: number) => {
    setMcp((prev) => ({
      ...prev,
      tools: prev.tools.filter((_, idx) => idx !== index),
    }))
  }

  const addResource = () => {
    setMcp((prev) => ({
      ...prev,
      resources: [
        ...prev.resources,
        {
          name: "",
          type: "",
          uri: undefined,
          configText: "",
          passthrough: {},
        },
      ],
    }))
  }

  const updateResource = (
    index: number,
    updates: Partial<Omit<McpResourceState, "passthrough">>
  ) => {
    setMcp((prev) => {
      if (index < 0 || index >= prev.resources.length) {
        return prev
      }
      const resources = prev.resources.map((resource, idx) =>
        idx === index
          ? {
              ...resource,
              ...updates,
              passthrough: { ...resource.passthrough },
            }
          : resource
      )
      return { ...prev, resources }
    })
  }

  const removeResource = (index: number) => {
    setMcp((prev) => ({
      ...prev,
      resources: prev.resources.filter((_, idx) => idx !== index),
    }))
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-6 overflow-auto p-6">
        {validationErrors.length > 0 && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="font-semibold">Needs attention</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {validationErrors.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Server details
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Server ID</span>
              <input
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                value={mcp.id}
                onChange={(event) => updateField({ id: event.target.value })}
                placeholder="Optional identifier"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Display name</span>
              <input
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                value={mcp.name}
                onChange={(event) => updateField({ name: event.target.value })}
                placeholder="Shown in the MCP list"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Base URL</span>
              <input
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                value={mcp.baseUrl}
                onChange={(event) => updateField({ baseUrl: event.target.value })}
                placeholder="https://example.com/api/mcp"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Timeout (ms)</span>
              <input
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                type="number"
                value={mcp.timeoutMs ?? ""}
                onChange={(event) =>
                  updateField({
                    timeoutMs: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
                placeholder="8000"
                min={0}
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Actions
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleDiscover} disabled={discovering}>
              {discovering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Discover tools
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegister}
              disabled={registering}
            >
              {registering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register with Flow
            </Button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tools
            </h2>
            <Button size="sm" variant="outline" onClick={addTool}>
              <Plus className="mr-2 h-4 w-4" />
              Add tool
            </Button>
          </div>
          {mcp.tools.length === 0 ? (
            <div className="mt-3 rounded border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-sm text-muted-foreground">
              Discover from the MCP server or add entries manually.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {mcp.tools.map((tool, index) => (
                <div key={index} className="rounded border bg-card p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1 space-y-2">
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="text-xs font-medium text-muted-foreground">Name</span>
                        <input
                          className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                          value={tool.name}
                          onChange={(event) => updateTool(index, { name: event.target.value })}
                          placeholder="tool-name"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="text-xs font-medium text-muted-foreground">Description</span>
                        <input
                          className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                          value={tool.description ?? ""}
                          onChange={(event) => updateTool(index, { description: event.target.value })}
                          placeholder="Optional description"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={tool.enabled !== false}
                          onChange={(event) => updateTool(index, { enabled: event.target.checked })}
                        />
                        Enabled
                      </label>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeTool(index)}
                        title="Remove tool"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resources
            </h2>
            <Button size="sm" variant="outline" onClick={addResource}>
              <Plus className="mr-2 h-4 w-4" />
              Add resource
            </Button>
          </div>
          {mcp.resources.length === 0 ? (
            <div className="mt-3 rounded border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-sm text-muted-foreground">
              Define optional MCP resources (files, APIs, datasets) referenced by the server.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {mcp.resources.map((resource, index) => (
                <div key={index} className="rounded border bg-card p-4 space-y-3">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs font-medium text-muted-foreground">Name</span>
                      <input
                        className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                        value={resource.name}
                        onChange={(event) => updateResource(index, { name: event.target.value })}
                        placeholder="resource-name"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs font-medium text-muted-foreground">Type</span>
                      <input
                        className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                        value={resource.type}
                        onChange={(event) => updateResource(index, { type: event.target.value })}
                        placeholder="file | api | dataset"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs font-medium text-muted-foreground">URI</span>
                      <input
                        className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                        value={resource.uri ?? ""}
                        onChange={(event) => updateResource(index, { uri: event.target.value })}
                        placeholder="Optional uri"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs font-medium text-muted-foreground">Config (JSON)</span>
                    <textarea
                      className="min-h-[120px] w-full rounded border border-input bg-background px-3 py-2 text-sm font-mono"
                      value={resource.configText}
                      onChange={(event) => updateResource(index, { configText: event.target.value })}
                      placeholder={`{
  "key": "value"
}`}
                    />
                    {resourceErrors[index] && (
                      <span className="text-xs text-destructive">{resourceErrors[index]}</span>
                    )}
                  </label>
                  <div className="flex justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeResource(index)}
                      title="Remove resource"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
