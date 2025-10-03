"use client"
import React, { useEffect } from 'react'
import dynamic from 'next/dynamic'
// NOTE: Using classic CSS-based theming (Quartz). Do NOT also supply the new Theming API "theme" grid option
// simultaneously, or AG Grid will emit error #239 (mixed theme application).
// If you want to migrate to the new Theming API, remove these CSS imports and the ag-theme-* class below
// and instead pass the `theme` grid option created via `createTheme`. For now we stick to CSS classes.
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
const AgGridReact: any = dynamic(() => import('ag-grid-react').then(m => m.AgGridReact), { 
  ssr: false,
  loading: () => <div className="p-4 text-center">Loading grid...</div>
})

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
  // Create a shallow clone of rest to manipulate safe props without mutating original reference (helps dependency of useEffect)
  const gridProps: any = { ...rest }
  const domLayout = autoHeight ? 'autoHeight' : gridProps.domLayout || 'normal'
  if (gridProps.domLayout) delete gridProps.domLayout
  const baseTheme = `ag-theme-${theme} custom-grid`

  useEffect(() => {
    if (gridProps.gridOptions?.theme) {
      console.warn('[AgGridWrapper] Detected gridOptions.theme while also using CSS theme class. Remove gridOptions.theme or migrate fully to Theming API to avoid error #239.')
      gridProps.gridOptions = { ...gridProps.gridOptions }
      delete gridProps.gridOptions.theme
    }
  }, [])
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
        theme="legacy"
        {...gridProps}
      />
      {children}
    </div>
  )
}

export default AgGridWrapper