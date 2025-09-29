import React from 'react'
import { PropertyTabConfig, CustomPropertyRenderProps } from "../property-config-types"
import { ViaTokensPanel } from '@/components/via/via-tokens-panel'

const WorkflowTokensCustomRenderer: React.FC<CustomPropertyRenderProps> = ({ attributes, onAttributeUpdate }) => {
  const definedColors = (attributes?.['data-defined-colors'] || '').split(',').filter(Boolean)
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Color (Schema)</label>
        <ViaTokensPanel
          definedColors={definedColors}
          selected={attributes?.['data-workflow-color']}
          onSelect={(c)=>onAttributeUpdate('data-workflow-color', c)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Base URL</label>
        <input
          type="text"
          value={attributes?.['data-workflow-base-url'] || '/api'}
          onChange={e=>onAttributeUpdate('data-workflow-base-url', e.target.value)}
          className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Dictionary URL</label>
        <input
          type="text"
          value={attributes?.['data-workflow-dictionary-url'] || '/api/dictionary'}
          onChange={e=>onAttributeUpdate('data-workflow-dictionary-url', e.target.value)}
          className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
        />
      </div>
    </div>
  )
}

export const WorkflowTokensPropertyConfig: PropertyTabConfig = {
  componentType: 'workflow-tokens',
  sections: [],
  customRenderer: WorkflowTokensCustomRenderer
}
