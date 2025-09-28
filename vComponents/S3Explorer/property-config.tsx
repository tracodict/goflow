/**
 * S3Explorer Property Tab Configuration
 */

import React from "react"
import { PropertyTabConfig, CustomPropertyRenderProps } from "../property-config-types"

const S3ExplorerCustomRenderer: React.FC<CustomPropertyRenderProps> = ({ 
  attributes, 
  onAttributeUpdate,
  datasources = []
}) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">S3 Datasource</label>
        <select
          value={attributes?.["data-datasource-id"] || ""}
          onChange={(e) => onAttributeUpdate("data-datasource-id", e.target.value)}
          className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
        >
          <option value="">Select an S3 datasource...</option>
          {datasources.filter(ds => ds.type === 's3').map((datasource) => (
            <option key={datasource.id} value={datasource.id}>
              {datasource.name}
            </option>
          ))}
        </select>
      </div>
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
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Show Hidden Files</label>
        <select
          value={attributes?.["data-show-hidden"] || "false"}
          onChange={(e) => onAttributeUpdate("data-show-hidden", e.target.value)}
          className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </div>
    </div>
  )
}

export const S3ExplorerPropertyConfig: PropertyTabConfig = {
  componentType: "s3-explorer", 
  sections: [],
  customRenderer: S3ExplorerCustomRenderer
}