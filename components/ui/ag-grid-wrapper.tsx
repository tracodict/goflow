"use client"
import React from 'react'
import dynamic from 'next/dynamic'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import '@/styles/ag-grid-custom.css'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
// Register community modules once (guarded)
if (typeof window !== 'undefined') {
  try {
    // @ts-ignore
    if (!(window as any).__agGridAllModulesRegistered) {
      ModuleRegistry.registerModules([AllCommunityModule])
      // @ts-ignore
      ;(window as any).__agGridAllModulesRegistered = true
    }
  } catch {/* ignore */}
}

// Dynamically load AgGridReact to avoid SSR issues
const AgGridReact: any = dynamic(() => import('ag-grid-react').then(m => m.AgGridReact), { ssr: false })

export interface AgGridWrapperProps extends Omit<React.ComponentProps<any>, 'rowData'> {
  /** Data rows */
  rowData?: any[]
  /** Column definitions */
  columnDefs?: any[]
  /** Apply autoHeight domLayout (content grows) */
  autoHeight?: boolean
  /** Force full flex height (expects parent flex column) */
  fullHeight?: boolean
  /** Additional container className */
  containerClassName?: string
  /** Additional container styles */
  containerStyle?: React.CSSProperties
  /** Theme name (ag-theme-*) without prefix; default quartz */
  theme?: string
  /** Row height (default 28) */
  rowHeight?: number
  /** Header height (default 30) */
  headerHeight?: number
  /** Optional test id */
  'data-testid'?: string
}

export const AgGridWrapper: React.FC<AgGridWrapperProps> = ({
  rowData,
  columnDefs,
  autoHeight = false,
  fullHeight = true,
  containerClassName = '',
  containerStyle,
  theme = 'quartz',
  rowHeight = 28,
  headerHeight = 30,
  children, // allow overlays or custom children if needed
  ...rest
}) => {
  const domLayout = autoHeight ? 'autoHeight' : (rest as any).domLayout || 'normal'
  // Remove domLayout from rest to avoid duplication
  if ((rest as any).domLayout) delete (rest as any).domLayout
  const baseTheme = `ag-theme-${theme} custom-grid`
  const outerClass = [baseTheme, fullHeight && !autoHeight ? 'h-full min-h-0' : '', containerClassName].filter(Boolean).join(' ')
  return (
    <div className={outerClass} style={containerStyle} data-testid={(rest as any)['data-testid']}>        
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        domLayout={domLayout}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        suppressCellFocus={false}
        {...rest}
      />
      {children}
    </div>
  )
}

export default AgGridWrapper