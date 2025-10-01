/**
 * Property Tab Configuration Registry
 * 
 * This file registers all property tab configurations for vComponents
 * and provides utilities for dynamic property panel rendering.
 */

import React from "react"
import { ScriptEditor } from '@/components/builder/ScriptEditor'
import { PropertyTabConfig, PropertyTabRegistry, CustomPropertyRenderProps, PropertyFieldConfig } from "./property-config-types"

// Import property configurations
import { ButtonPropertyConfig } from "./Button/property-config"
import { NavigationMenuPropertyConfig } from "./NavigationMenu/property-config"
import { DataGridPropertyConfig } from "./DataGrid/property-config"
import { S3ExplorerPropertyConfig } from "./S3Explorer/property-config"
import { WorkflowTokensPropertyConfig } from './WorkflowTokens/property-config'
import { DynamicFormPropertyConfig } from './DynamicForm/property-config'
import { DialogFormLauncherPropertyConfig } from './DialogFormLauncher/property-config'

// Property tab registry
export const propertyTabRegistry: PropertyTabRegistry = {
  [ButtonPropertyConfig.componentType]: ButtonPropertyConfig,
  [NavigationMenuPropertyConfig.componentType]: NavigationMenuPropertyConfig,
  [DataGridPropertyConfig.componentType]: DataGridPropertyConfig,
  [S3ExplorerPropertyConfig.componentType]: S3ExplorerPropertyConfig,
  [WorkflowTokensPropertyConfig.componentType]: WorkflowTokensPropertyConfig,
  [DynamicFormPropertyConfig.componentType]: DynamicFormPropertyConfig,
  [DialogFormLauncherPropertyConfig.componentType]: DialogFormLauncherPropertyConfig,
}

// Utility to get property config for a component
export const getPropertyConfig = (componentType: string): PropertyTabConfig | undefined => {
  return propertyTabRegistry[componentType]
}

// Generic field renderer for common field types
export const renderPropertyField = (
  field: PropertyFieldConfig,
  value: string,
  onUpdate: (key: string, value: string) => void,
  additionalProps: { queries?: any[], datasources?: any[] } = {}
): React.ReactElement => {
  const commonClasses = "w-full p-2 border border-input rounded text-xs bg-background text-foreground"
  const labelClasses = "block text-xs font-medium mb-1 text-muted-foreground"
  
  switch (field.type) {
    case 'text':
      return (
        <div key={field.key}>
          <label className={labelClasses}>{field.label}</label>
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onUpdate(field.key, e.target.value)}
            className={commonClasses}
            placeholder={field.placeholder}
          />
          {field.helpText && (
            <div className="text-[10px] text-muted-foreground mt-1">{field.helpText}</div>
          )}
        </div>
      )
      
    case 'textarea':
        case 'script':
          return (
            <div key={field.key}>
              <label className={labelClasses}>{field.label}</label>
              <ScriptEditor
                value={value || ''}
                onChange={(val) => onUpdate(field.key, val)}
                placeholder={field.placeholder}
                initialHeight={(field.rows ? field.rows * 40 : 160)}
              />
              {field.helpText && (
                <div className="text-[10px] text-muted-foreground mt-1">{field.helpText}</div>
              )}
            </div>
          )
      
    case 'select':
      return (
        <div key={field.key}>
          <label className={labelClasses}>{field.label}</label>
          <select
            value={value || ""}
            onChange={(e) => onUpdate(field.key, e.target.value)}
            className={commonClasses}
          >
            <option value="">{field.placeholder || "Select an option..."}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {field.helpText && (
            <div className="text-[10px] text-muted-foreground mt-1">{field.helpText}</div>
          )}
        </div>
      )
      
    case 'checkbox':
      return (
        <div key={field.key}>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value === "true"}
              onChange={(e) => onUpdate(field.key, e.target.checked ? "true" : "false")}
              className="rounded"
            />
            <span className="text-xs text-muted-foreground">{field.label}</span>
          </label>
          {field.helpText && (
            <div className="text-[10px] text-muted-foreground mt-1">{field.helpText}</div>
          )}
        </div>
      )
      
    default:
      return (
        <div key={field.key} className="text-xs text-red-500">
          Unknown field type: {field.type}
        </div>
      )
  }
}

// Component to render a complete property config
export const PropertyConfigRenderer: React.FC<{
  config: PropertyTabConfig
  attributes: Record<string, string>
  onAttributeUpdate: (key: string, value: string) => void
  queries?: any[]
  datasources?: any[]
}> = ({ config, attributes, onAttributeUpdate, queries, datasources }) => {
  
  // If component has custom renderer, use that
  if (config.customRenderer) {
    const CustomRenderer = config.customRenderer
    return (
      <CustomRenderer 
        attributes={attributes}
        onAttributeUpdate={onAttributeUpdate}
        queries={queries}
        datasources={datasources}
      />
    )
  }
  
  // Otherwise render using sections
  return (
    <>
      {config.sections.map((section, sectionIndex) => {
        // Check conditional rendering
        if (section.conditional && !section.conditional(attributes)) {
          return null
        }
        
        return (
          <div key={sectionIndex} className="space-y-3 border-t pt-3 mt-3">
            <h4 className="text-sm font-medium text-foreground">{section.title}</h4>
            
            <div className="space-y-3">
              {section.fields.map(field => 
                renderPropertyField(
                  field, 
                  attributes[field.key] || "",
                  onAttributeUpdate,
                  { queries, datasources }
                )
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}