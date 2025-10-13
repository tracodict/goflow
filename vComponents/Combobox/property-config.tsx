"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useSystemSettings, DEFAULT_SETTINGS } from "@/components/petri/system-settings-context"
import { useQueryStore as useFilestoreQueryStore } from "@/stores/filestore-query"
import type { PropertyTabConfig, CustomPropertyRenderProps } from "../property-config-types"

interface LocalOption {
  key: string
  value: string
}

const parseLocalOptions = (optionsJson?: string): LocalOption[] => {
  if (!optionsJson) return []
  try {
    const parsed = JSON.parse(optionsJson)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (!item) return null
        if (typeof item === "object") {
          const key = item.key ?? item.value ?? item.id
          const value = item.value ?? item.label ?? item.key ?? item.id
          if (!key || !value) return null
          return { key: String(key), value: String(value) }
        }
        const stringified = String(item)
        return { key: stringified, value: stringified }
      })
      .filter((item): item is LocalOption => Boolean(item?.key))
  } catch (error) {
    console.warn("[Combobox] Failed to parse local options", error)
    return []
  }
}

const serializeOptions = (options: LocalOption[]) => JSON.stringify(options, null, 2)

const ComboboxPropertyPanel: React.FC<CustomPropertyRenderProps> = ({ attributes, onAttributeUpdate, queries: providedQueries = [] }) => {
  const { settings } = useSystemSettings()
  const { queries, fetchQueries } = useFilestoreQueryStore()

  const kind = attributes["data-kind"] === "server" ? "server" : "local"

  const [localOptions, setLocalOptions] = React.useState<LocalOption[]>(() => parseLocalOptions(attributes["data-options"]))

  React.useEffect(() => {
    setLocalOptions(parseLocalOptions(attributes["data-options"]))
  }, [attributes["data-options"]])

  React.useEffect(() => {
    if (kind === "server" && queries.length === 0) {
      const flowServiceUrl = settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
      fetchQueries(flowServiceUrl).catch(() => {})
    }
  }, [kind, queries.length, fetchQueries, settings?.flowServiceUrl])

  const mergedQueries = React.useMemo(() => {
    const deduped = new Map<string, { id: string; name: string; type?: string }>()
    const combined = [...providedQueries, ...queries]
    for (const query of combined) {
      if (!query) continue
      const id = query.id || query.name
      if (!id || deduped.has(id)) continue
      deduped.set(id, {
        id,
        name: query.name || query.id || "Unnamed query",
        type: query.query_type || query.type,
      })
    }
    return Array.from(deduped.values())
  }, [providedQueries, queries])

  const handleKindChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onAttributeUpdate("data-kind", event.target.value)
  }

  const handleOptionChange = (index: number, field: keyof LocalOption, value: string) => {
    setLocalOptions((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      onAttributeUpdate("data-options", serializeOptions(next))
      return next
    })
  }

  const handleAddOption = () => {
    setLocalOptions((prev) => {
      const next = [...prev, { key: `option_${prev.length + 1}`, value: "Label" }]
      onAttributeUpdate("data-options", serializeOptions(next))
      return next
    })
  }

  const handleRemoveOption = (index: number) => {
    setLocalOptions((prev) => {
      const next = prev.filter((_, idx) => idx !== index)
      onAttributeUpdate("data-options", serializeOptions(next))
      return next
    })
  }

  const selectedQueryId = attributes["data-query-id"] || ""
  const selectedQueryName = React.useMemo(() => {
    if (!selectedQueryId) return ""
    const match = mergedQueries.find((query) => query.id === selectedQueryId || query.name === selectedQueryId)
    return match?.name || attributes["data-query-name"] || selectedQueryId
  }, [mergedQueries, selectedQueryId, attributes])

  const updateAttribute = (key: string, value: string) => {
    onAttributeUpdate(key, value)
  }

  const handleQueryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value
    if (!nextId) {
      onAttributeUpdate("data-query-id", "")
      onAttributeUpdate("data-query-name", "")
      return
    }
    const query = mergedQueries.find((item) => item.id === nextId)
    onAttributeUpdate("data-query-id", nextId)
    onAttributeUpdate("data-query-name", query?.name || nextId)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Mode</label>
        <select
          className="w-full rounded border px-2 py-1 text-xs"
          value={kind}
          onChange={handleKindChange}
        >
          <option value="local">Local options</option>
          <option value="server">Server query</option>
        </select>
      </div>

      {kind === "local" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">Options</label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={handleAddOption}
            >
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {localOptions.length === 0 ? (
              <div className="rounded border border-dashed p-3 text-[11px] text-muted-foreground">
                No options defined. Add options for the local combobox.
              </div>
            ) : (
              localOptions.map((option, index) => (
                <div key={index} className="grid grid-cols-5 items-center gap-2">
                  <Input
                    className="col-span-2 h-7 text-xs"
                    value={option.key}
                    placeholder="Key"
                    onChange={(event) => handleOptionChange(index, "key", event.target.value)}
                  />
                  <Input
                    className="col-span-3 h-7 text-xs"
                    value={option.value}
                    placeholder="Label"
                    onChange={(event) => handleOptionChange(index, "value", event.target.value)}
                  />
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={() => handleRemoveOption(index)}
                  >
                    ×
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Query</label>
            <select
              className="w-full rounded border px-2 py-1 text-xs"
              value={selectedQueryId}
              onChange={handleQueryChange}
            >
              <option value="">Select a query…</option>
              {mergedQueries.map((query) => (
                <option key={query.id} value={query.id}>
                  {query.name} {query.type ? `(${query.type})` : ""}
                </option>
              ))}
            </select>
            {selectedQueryName ? (
              <div className="text-[10px] text-muted-foreground">Selected query: {selectedQueryName}</div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Key field</label>
              <Input
                className="h-7 text-xs"
                value={attributes["data-key-field"] || ""}
                placeholder="e.g. id"
                onChange={(event) => updateAttribute("data-key-field", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Value field</label>
              <Input
                className="h-7 text-xs"
                value={attributes["data-value-field"] || ""}
                placeholder="e.g. name"
                onChange={(event) => updateAttribute("data-value-field", event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Search param</label>
              <Input
                className="h-7 text-xs"
                value={attributes["data-search-param"] || "search"}
                placeholder="search"
                onChange={(event) => updateAttribute("data-search-param", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Debounce (ms)</label>
              <Input
                className="h-7 text-xs"
                type="number"
                value={attributes["data-debounce-ms"] || "700"}
                onChange={(event) => updateAttribute("data-debounce-ms", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Static params (JSON)</label>
            <Textarea
              className="h-24 text-xs"
              value={attributes["data-static-params"] || ""}
              placeholder='{"status": "active"}'
              onChange={(event) => updateAttribute("data-static-params", event.target.value)}
            />
            <div className="text-[10px] text-muted-foreground">
              Provide additional parameters to send with each query execution. Values can be referenced via ${"{param}"} inside the query definition.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Placeholder</label>
          <Input
            className="h-7 text-xs"
            value={attributes["data-placeholder"] || "Select option"}
            onChange={(event) => updateAttribute("data-placeholder", event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Label</label>
          <Input
            className="h-7 text-xs"
            value={attributes["data-label"] || ""}
            onChange={(event) => updateAttribute("data-label", event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Default value</label>
          <Input
            className="h-7 text-xs"
            value={attributes["data-default-value"] || ""}
            onChange={(event) => updateAttribute("data-default-value", event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Disabled</label>
          <select
            className="h-7 w-full rounded border px-2 text-xs"
            value={attributes["data-disabled"] === "true" ? "true" : "false"}
            onChange={(event) => updateAttribute("data-disabled", event.target.value)}
          >
            <option value="false">Enabled</option>
            <option value="true">Disabled</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export const ComboboxPropertyConfig: PropertyTabConfig = {
  componentType: "Combobox",
  sections: [],
  customRenderer: ComboboxPropertyPanel,
}
