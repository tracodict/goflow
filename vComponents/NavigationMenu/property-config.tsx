/**
 * NavigationMenu Property Tab Configuration
 */

import React from "react"
import { PropertyTabConfig, CustomPropertyRenderProps } from "../property-config-types"
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'

const NavigationMenuCustomRenderer: React.FC<CustomPropertyRenderProps> = ({ 
  attributes, 
  onAttributeUpdate 
}) => {
  const updateConfigProperty = (property: string, value: any) => {
    try {
      const currentConfig = JSON.parse(attributes?.["data-config"] || '{}')
      const newConfig = { ...currentConfig, [property]: JSON.parse(value) }
      onAttributeUpdate("data-config", JSON.stringify(newConfig))
    } catch (err) {
      console.error(`Failed to update menu ${property}:`, err)
    }
  }

  const getConfigValue = (property: string, defaultValue: any) => {
    try {
      const config = JSON.parse(attributes?.["data-config"] || '{}')
      return config[property] ?? defaultValue
    } catch {
      return defaultValue
    }
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-md overflow-hidden">
        <CodeMirror
          value={JSON.stringify(getConfigValue('items', []), null, 2)}
          onChange={(value) => updateConfigProperty('items', value)}
          height="300px"
          extensions={[json()]}
        />
      </div>
      
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Orientation</label>
        <select
          value={getConfigValue('orientation', 'horizontal')}
          onChange={(e) => updateConfigProperty('orientation', e.target.value)}
          className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
        >
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={getConfigValue('showIcons', false)}
              onChange={(e) => updateConfigProperty('showIcons', e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-muted-foreground">Show Icons</span>
          </label>
        </div>
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={getConfigValue('showBadges', false)}
              onChange={(e) => updateConfigProperty('showBadges', e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-muted-foreground">Show Badges</span>
          </label>
        </div>
      </div>
    </div>
  )
}

export const NavigationMenuPropertyConfig: PropertyTabConfig = {
  componentType: "NavigationMenu",
  sections: [],
  customRenderer: NavigationMenuCustomRenderer
}