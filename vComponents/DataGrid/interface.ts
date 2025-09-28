import type { BaseEventPayload } from "@/lib/component-interface"

// DataGrid-specific event payload interfaces  
export interface DataGridEventPayload extends BaseEventPayload {
  // Query information
  queryName?: string
  queryType?: 'mongodb' | 'sql'
  
  // Data information
  totalRows?: number
  loadedRows?: number
  
  // Row interaction (for row click events)
  rowData?: Record<string, any>
  rowIndex?: number
  
  // Error information (for error events)
  error?: string
}