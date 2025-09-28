'use client'

import React from "react"
import { DataGrid } from "./DataGrid"
import { globalSandbox } from "@/lib/script-sandbox"
import type { BaseEventPayload } from "@/lib/component-interface"
import type { DataGridEventPayload } from "./interface"

// Base props interface for DataGrid
export interface DataGridProps {
  queryName?: string
  autoRefresh?: boolean
  className?: string
  style?: React.CSSProperties
}

// Props for PageBuilder wrapper including all event handlers
export interface PageBuilderDataGridProps extends DataGridProps {
  "data-element-id"?: string
  "data-script-click"?: string
  "data-script-data-load"?: string
  "data-script-row-click"?: string
  "data-script-error"?: string
  "data-query-name"?: string
  "data-auto-refresh"?: string
}

/**
 * PageBuilder wrapper for DataGrid component
 * Handles script execution via data attributes
 */
export const PageBuilderDataGrid: React.FC<PageBuilderDataGridProps> = ({ 
  "data-element-id": elementId,
  "data-script-click": scriptClick,
  "data-script-data-load": scriptDataLoad,
  "data-script-row-click": scriptRowClick,
  "data-script-error": scriptError,
  "data-query-name": queryName,
  "data-auto-refresh": autoRefreshString,
  ...props 
}) => {
  // Convert string autoRefresh to boolean
  const autoRefresh = autoRefreshString === "true"
  // Create context for script execution  
  const createContext = React.useCallback(() => ({
    component: {
      id: elementId || 'data-grid',
      type: 'data-grid',
      getProps: () => props,
      setProps: (newProps: Record<string, any>) => {
        console.log('Setting props:', newProps)
      },
      emit: (event: string, payload: any) => {
        console.log(`Event emitted: ${event}`, payload)
      },
      callAction: async (actionName: string, params: any) => {
        console.log(`Action called: ${actionName}`, params)
        return { success: true }
      }
    },
    data: {
      query: async (queryId: string) => ({}),
      mutate: async (mutation: any) => ({}),
      subscribe: (callback: (data: any) => void) => () => {}
    },
    page: {
      navigate: (path: string) => {
        console.log('Navigate to:', path)
      },
      getState: () => ({}),
      setState: (state: any) => {},
      dispatch: (action: any) => {
        console.log('Action dispatched:', action)
      }
    },
    app: {
      getGlobalState: () => ({}),
      setGlobalState: (state: any) => {},
      showNotification: (message: string, type = 'info') => {
        console.log(`[${type.toUpperCase()}] ${message}`)
      },
      callWorkflow: async (workflowId: string, payload: any) => ({ success: true })
    },
    utils: {
      formatDate: (date: Date | string, format?: string) => {
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toISOString()
      },
      validateSchema: (data: any, schema: any) => ({ valid: true }),
      debounce: <T extends (...args: any[]) => void>(func: T, delay: number) => func,
      throttle: <T extends (...args: any[]) => void>(func: T, delay: number) => func,
      log: (message: string, level = 'info') => {
        console.log(`[${level.toUpperCase()}] ${message}`)
      }
    }
  }), [elementId, props])

  // Script execution handlers
  const handleScriptClick = React.useCallback(async (payload: BaseEventPayload) => {
    if (scriptClick) {
      const context = createContext()
      const result = await globalSandbox.executeScript('data-grid-click-handler', scriptClick, context, payload)
      if (!result.success) {
        console.error('onClick script error:', result.error)
      }
    }
  }, [scriptClick, createContext])

  const handleScriptDataLoad = React.useCallback(async (payload: DataGridEventPayload) => {
    if (scriptDataLoad) {
      const context = createContext()
      const result = await globalSandbox.executeScript('data-grid-data-load-handler', scriptDataLoad, context, payload)
      if (!result.success) {
        console.error('onDataLoad script error:', result.error)
      }
    }
  }, [scriptDataLoad, createContext])

  const handleScriptRowClick = React.useCallback(async (payload: DataGridEventPayload) => {
    if (scriptRowClick) {
      const context = createContext()
      const result = await globalSandbox.executeScript('data-grid-row-click-handler', scriptRowClick, context, payload)
      if (!result.success) {
        console.error('onRowClick script error:', result.error)
      }
    }
  }, [scriptRowClick, createContext])

  const handleScriptError = React.useCallback(async (payload: DataGridEventPayload) => {
    if (scriptError) {
      const context = createContext()
      const result = await globalSandbox.executeScript('data-grid-error-handler', scriptError, context, payload)
      if (!result.success) {
        console.error('onError script error:', result.error)
      }
    }
  }, [scriptError, createContext])

  return (
    <DataGrid
      {...props}
      queryName={queryName}
      autoRefresh={autoRefresh}
      elementId={elementId}
      onScriptDataLoad={handleScriptDataLoad}
      onScriptRowClick={handleScriptRowClick}
      onScriptError={handleScriptError}
    />
  )
}