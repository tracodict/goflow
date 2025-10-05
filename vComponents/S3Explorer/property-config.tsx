/**
 * S3Explorer Property Tab Configuration
 */

import React from "react"
import { PropertyTabConfig, CustomPropertyRenderProps } from "../property-config-types"

const S3ExplorerCustomRenderer: React.FC<CustomPropertyRenderProps> = ({ 
  attributes, 
  onAttributeUpdate,
  datasources = [],
  queries = []
}) => {
  const queryMode = attributes?.["data-query-id"] ? "query" : "datasource"
  
  return (
    <div className="space-y-4">
      {/* Query Mode Selection */}
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Query Mode</label>
        <select
          value={queryMode}
          onChange={(e) => {
            if (e.target.value === "query") {
              onAttributeUpdate("data-datasource-id", "")
            } else {
              onAttributeUpdate("data-query-id", "")
            }
          }}
          className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
        >
          <option value="datasource">Direct Datasource (Legacy)</option>
          <option value="query">Saved Query (Recommended)</option>
        </select>
      </div>

      {/* Query ID Selection */}
      {queryMode === "query" && (
        <div>
          <label className="block text-xs font-medium mb-1 text-muted-foreground">GCS Query</label>
          <select
            value={attributes?.["data-query-id"] || ""}
            onChange={(e) => onAttributeUpdate("data-query-id", e.target.value)}
            className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
          >
            <option value="">Select a GCS query...</option>
            {queries.filter(q => q.query_type === 'folder').map((query) => (
              <option key={query.id} value={query.id}>
                {query.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Datasource Selection (Legacy) */}
      {queryMode === "datasource" && (
        <div>
          <label className="block text-xs font-medium mb-1 text-muted-foreground">GCS/S3 Datasource</label>
          <select
            value={attributes?.["data-datasource-id"] || ""}
            onChange={(e) => onAttributeUpdate("data-datasource-id", e.target.value)}
            className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
          >
            <option value="">Select a GCS/S3 datasource...</option>
            {datasources.filter(ds => ds.type === 'gcs' || ds.type === 's3').map((datasource) => (
              <option key={datasource.id} value={datasource.id}>
                {datasource.name} ({datasource.type.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Query Parameters */}
      <div className="border-t pt-3">
        <h4 className="text-xs font-medium mb-2 text-muted-foreground">Query Parameters</h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Initial Path</label>
            <input
              type="text"
              value={attributes?.["data-initial-path"] || ""}
              onChange={(e) => onAttributeUpdate("data-initial-path", e.target.value)}
              className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
              placeholder="/"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Show Hidden</label>
              <select
                value={attributes?.["data-show-hidden"] || "false"}
                onChange={(e) => onAttributeUpdate("data-show-hidden", e.target.value)}
                className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Recursive</label>
              <select
                value={attributes?.["data-recursive"] || "true"}
                onChange={(e) => onAttributeUpdate("data-recursive", e.target.value)}
                className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Max File Size (bytes)</label>
            <input
              type="number"
              value={attributes?.["data-max-file-size"] || ""}
              onChange={(e) => onAttributeUpdate("data-max-file-size", e.target.value)}
              className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
              placeholder="10485760 (10MB)"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Allowed Extensions</label>
            <input
              type="text"
              value={attributes?.["data-allowed-extensions"] || ""}
              onChange={(e) => onAttributeUpdate("data-allowed-extensions", e.target.value)}
              className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
              placeholder=".pdf,.txt,.json,.md,.csv"
            />
            <div className="text-xs text-muted-foreground mt-1">
              Comma-separated list of file extensions
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const S3ExplorerPropertyConfig: PropertyTabConfig = {
  componentType: "s3-explorer", 
  sections: [],
  customRenderer: S3ExplorerCustomRenderer
}