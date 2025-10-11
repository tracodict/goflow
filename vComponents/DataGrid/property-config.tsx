"use client"

/**
 * DataGrid Property Tab Configuration
 */

import React from "react"
import { PropertyTabConfig, CustomPropertyRenderProps } from "../property-config-types"
import { useQueryStore as useFilestoreQueryStore } from "@/stores/filestore-query"
import { useSystemSettings, DEFAULT_SETTINGS } from "@/components/petri/system-settings-context"

const DataGridCustomRenderer: React.FC<CustomPropertyRenderProps> = ({ 
  attributes, 
  onAttributeUpdate,
  queries: providedQueries = []
}) => {
  const { queries: remoteQueries, fetchQueries } = useFilestoreQueryStore()
  const { settings } = useSystemSettings()

  React.useEffect(() => {
    if (remoteQueries.length > 0) {
      return
    }

    const flowServiceUrl = settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
    fetchQueries(flowServiceUrl).catch(() => {})
  }, [remoteQueries.length, fetchQueries, settings?.flowServiceUrl])

  const mergedQueries = React.useMemo(() => {
    const deduped = new Map<string, any>()
    const all = [...providedQueries, ...remoteQueries]

    for (const query of all) {
      if (!query) continue
      const key = query.id || query.name
      if (!key || deduped.has(key)) continue
      deduped.set(key, query)
    }

    return Array.from(deduped.values()).map((query) => {
      const rawType = query.query_type || query.type
      const normalizedType = rawType === "folder" ? "s3" : rawType
      return {
        id: query.id || query.name,
        name: query.name || query.id || "Unnamed query",
        type: normalizedType,
      }
    })
  }, [providedQueries, remoteQueries])

  const selectableQueries = mergedQueries.filter((query) => query.type !== "s3")

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLSelectElement>) => {
    if (event.key === "Backspace" || event.key === "Delete") {
      event.stopPropagation()
      event.nativeEvent.stopImmediatePropagation?.()
    }
  }, [])

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Query</label>
        <select
          value={attributes?.["data-query-name"] || ""}
          onChange={(e) => onAttributeUpdate("data-query-name", e.target.value)}
          className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
          onKeyDown={handleKeyDown}
        >
          <option value="">Select a query...</option>
          {selectableQueries.map((query) => (
            <option key={query.id} value={query.name}>
              {query.name} ({query.type || "unknown"})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Auto Refresh</label>
        <select
          value={attributes?.["data-auto-refresh"] || "false"}
          onChange={(e) => onAttributeUpdate("data-auto-refresh", e.target.value)}
          className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
          onKeyDown={handleKeyDown}
        >
          <option value="false">Manual</option>
          <option value="true">Automatic</option>
        </select>
      </div>
    </div>
  )
}

export const DataGridPropertyConfig: PropertyTabConfig = {
  componentType: "data-grid",
  sections: [],
  customRenderer: DataGridCustomRenderer
}