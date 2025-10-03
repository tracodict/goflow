/**
 * VIAForm vComponent
 * 
 * A comprehensive component for View, Inspect, and Action operations on workflow tokens.
 * Combines color/schema selection with token grid display and interaction capabilities.
 */

export { default as VIAForm } from './VIAForm'
export { default as PageBuilderVIAForm } from './PageBuilderVIAForm'
export { VIAFormComponentInterface } from './interface'
export { VIAFormPropertyConfig } from './property-config'
export type { VIAFormRef } from './VIAForm'

// Register the VIAForm component for dynamic rendering in PageElement
import { registerComponentRenderer, createComponentRenderer } from '../component-renderer-registry'

registerComponentRenderer(
  createComponentRenderer(
    'VIAForm',
    () => require('./PageBuilderVIAForm').default,
    10 // Priority 10 for core components
  )
)