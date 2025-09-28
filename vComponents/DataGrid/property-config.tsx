/**
 * DataGrid Property Tab Configuration
 */

import React from "react"
import { PropertyTabConfig, CustomPropertyRenderProps } from "../property-config-types"

const DataGridCustomRenderer: React.FC<CustomPropertyRenderProps> = ({ 
  attributes, 
  onAttributeUpdate,
  queries = []
}) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Query</label>
        <select
          value={attributes?.["data-query-name"] || ""}
          onChange={(e) => onAttributeUpdate("data-query-name", e.target.value)}
          className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
        >
          <option value="">Select a query...</option>
          {queries.filter(q => q.type !== 's3').map((query) => (
            <option key={query.name} value={query.name}>
              {query.name} ({query.type})
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