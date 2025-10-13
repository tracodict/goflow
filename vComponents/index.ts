/**
 * vComponents Main Index
 * 
 * This file imports all vComponents to ensure their renderers are registered.
 * Import this file to initialize all component renderers.
 */

// Import all components to trigger their renderer registrations
import './Button'
import './NavigationMenu'
import './DataGrid'
import './S3Explorer'
import './DynamicForm'
import './DialogFormLauncher'
import './VIAForm'
import './Markdown'
import './ECharts'
import './PivotTable'

// Re-export the registry for external use
export { componentRendererRegistry, registerComponentRenderer, createComponentRenderer } from './component-renderer-registry'

// Re-export property configurations
export { propertyTabRegistry, getPropertyConfig, PropertyConfigRenderer } from './property-config-registry'
export type { PropertyTabConfig, PropertyFieldConfig, PropertySectionConfig } from './property-config-types'

// Re-export all components for convenience
export * from './Button'
export * from './NavigationMenu'
export * from './DataGrid'
export * from './S3Explorer'
export * from './DynamicForm'
export * from './DialogFormLauncher'
export * from './VIAForm'
export * from './Markdown'
export * from './ECharts'
export * from './PivotTable'