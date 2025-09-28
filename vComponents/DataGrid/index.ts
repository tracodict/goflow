// DataGrid vComponent exports

export { DataGrid } from './DataGrid'
export { PageBuilderDataGrid } from './PageBuilderDataGrid'
export type { DataGridEventPayload } from './interface'

// Register the DataGrid component for dynamic rendering in PageElement
import { registerComponentRenderer, createComponentRenderer } from '../component-renderer-registry'

registerComponentRenderer(
  createComponentRenderer(
    'data-grid', // This matches the data-type attribute
    () => require('./PageBuilderDataGrid').PageBuilderDataGrid,
    10 // Priority 10 for core components
  )
)

// Component registration information
export const DataGridComponent = {
  name: 'DataGrid',
  category: 'Data',
  description: 'Interactive data grid with query integration',
  icon: 'Table',
  version: '1.0.0'
}