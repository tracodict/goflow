/**
 * DataGrid Component
 * 
 * Enhanced data grid component with event system and dynamic configuration.
 * Uses LocalDataGrid to avoid global state conflicts between multiple instances.
 */

import * as React from "react"
import { LocalDataGrid } from "../../components/builder/LocalDataGrid"
import { BaseEventPayload } from "@/lib/component-interface"
import { DataGridEventPayload } from "./interface"

// Component props interface
export interface DataGridProps extends React.HTMLAttributes<HTMLDivElement> {
  queryName?: string
  autoRefresh?: boolean
  
  // Script integration props
  isPreview?: boolean
  elementId?: string
  
  // Event handlers (for script integration)
  onScriptDataLoad?: (payload: DataGridEventPayload) => void
  onScriptRowClick?: (payload: DataGridEventPayload) => void
  onScriptError?: (payload: DataGridEventPayload) => void
  onScriptMount?: (payload: BaseEventPayload) => void
  onScriptUnmount?: (payload: BaseEventPayload) => void
}

// DataGrid component implementation
const DataGrid = React.forwardRef<HTMLDivElement, DataGridProps>(
  ({ 
    queryName,
    autoRefresh = false,
    className,
    style,
    isPreview = false,
    elementId,
    onScriptDataLoad,
    onScriptRowClick,
    onScriptError,
    onScriptMount,
    onScriptUnmount,
    ...props 
  }, ref) => {
    
    // Generate element ID
    const finalElementId = elementId || `data-grid-${React.useId()}`
    
    // Handle component mount/unmount events
    React.useEffect(() => {
      if (isPreview && onScriptMount) {
        const payload: BaseEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'mount'
        }
        onScriptMount(payload)
      }
      
      return () => {
        if (isPreview && onScriptUnmount) {
          const payload: BaseEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'unmount'
          }
          onScriptUnmount(payload)
        }
      }
    }, [isPreview, onScriptMount, onScriptUnmount, finalElementId])
    
    // Handle click events on the data grid container
    const handleClick = React.useCallback((event: React.MouseEvent) => {
      if (isPreview && onScriptRowClick) {
        // Try to determine if this was a row click
        const target = event.target as HTMLElement
        const row = target.closest('[role="row"]') || target.closest('tr')
        
        if (row) {
          // Extract row data if possible (this is a simplified approach)
          const rowIndex = Array.from(row.parentNode?.children || []).indexOf(row) - 1 // -1 for header
          
          const payload: DataGridEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'rowClick',
            queryName,
            rowIndex: rowIndex >= 0 ? rowIndex : undefined,
            rowData: {} // We could enhance this to extract actual row data
          }
          onScriptRowClick(payload)
        }
      }
    }, [isPreview, onScriptRowClick, finalElementId, queryName])

    return (
      <div 
        ref={ref}
        className={className}
        style={style}
        data-element-id={finalElementId}
        onClick={handleClick}
        {...props}
      >
        <LocalDataGrid
          queryName={queryName}
          autoRefresh={isPreview && autoRefresh}
        />
      </div>
    )
  }
)

DataGrid.displayName = "DataGrid"

export { DataGrid }