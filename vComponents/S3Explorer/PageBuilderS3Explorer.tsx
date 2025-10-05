'use client'

import React from "react"
import { S3Explorer } from "./S3Explorer"
import { globalSandbox } from "@/lib/script-sandbox"
import type { BaseEventPayload } from "@/lib/component-interface"
import type { S3ExplorerEventPayload } from "./interface"

// Base props interface for S3Explorer
export interface S3ExplorerProps {
  queryName?: string
  className?: string
  style?: React.CSSProperties
}

// Props for PageBuilder wrapper including all event handlers
export interface PageBuilderS3ExplorerProps extends S3ExplorerProps {
  "data-element-id"?: string
  "data-script-click"?: string
  "data-script-file-select"?: string
  "data-script-folder-toggle"?: string
  "data-script-download"?: string
  "data-script-error"?: string
  // Query execution props
  "data-query-id"?: string
  "data-datasource-id"?: string
  // Query parameters
  "data-initial-path"?: string
  "data-show-hidden"?: string
  "data-recursive"?: string
  "data-max-file-size"?: string
  "data-allowed-extensions"?: string
}

/**
 * PageBuilder wrapper for S3Explorer component
 * Handles script execution via data attributes
 */
export const PageBuilderS3Explorer: React.FC<PageBuilderS3ExplorerProps> = ({ 
  "data-element-id": elementId,
  "data-script-click": scriptClick,
  "data-script-file-select": scriptFileSelect,
  "data-script-folder-toggle": scriptFolderToggle,
  "data-script-download": scriptDownload,
  "data-script-error": scriptError,
  "data-query-id": queryId,
  "data-datasource-id": datasourceId,
  "data-initial-path": initialPath,
  "data-show-hidden": showHiddenString,
  "data-recursive": recursiveString,
  "data-max-file-size": maxFileSizeString,
  "data-allowed-extensions": allowedExtensionsString,
  ...props 
}) => {
  // Parse values from strings
  const showHidden = showHiddenString === "true"
  const recursive = recursiveString !== "false" // default true
  const maxFileSize = maxFileSizeString ? parseInt(maxFileSizeString) : undefined
  const allowedExtensions = allowedExtensionsString ? 
    allowedExtensionsString.split(',').map(ext => ext.trim()) : 
    undefined
  
  // Create context for script execution  
  const createContext = React.useCallback(() => ({
    component: {
      id: elementId || 's3-explorer',
      type: 's3-explorer',
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
      const result = await globalSandbox.executeScript('s3-explorer-click-handler', scriptClick, context, payload)
      if (!result.success) {
        console.error('onClick script error:', result.error)
      }
    }
  }, [scriptClick, createContext])

  const handleScriptFileSelect = React.useCallback(async (payload: S3ExplorerEventPayload) => {
    if (scriptFileSelect) {
      const context = createContext()
      const result = await globalSandbox.executeScript('s3-explorer-file-select-handler', scriptFileSelect, context, payload)
      if (!result.success) {
        console.error('onFileSelect script error:', result.error)
      }
    }
  }, [scriptFileSelect, createContext])

  const handleScriptFolderToggle = React.useCallback(async (payload: S3ExplorerEventPayload) => {
    if (scriptFolderToggle) {
      const context = createContext()
      const result = await globalSandbox.executeScript('s3-explorer-folder-toggle-handler', scriptFolderToggle, context, payload)
      if (!result.success) {
        console.error('onFolderToggle script error:', result.error)
      }
    }
  }, [scriptFolderToggle, createContext])

  const handleScriptDownload = React.useCallback(async (payload: S3ExplorerEventPayload) => {
    if (scriptDownload) {
      const context = createContext()
      const result = await globalSandbox.executeScript('s3-explorer-download-handler', scriptDownload, context, payload)
      if (!result.success) {
        console.error('onDownload script error:', result.error)
      }
    }
  }, [scriptDownload, createContext])

  const handleScriptError = React.useCallback(async (payload: S3ExplorerEventPayload) => {
    if (scriptError) {
      const context = createContext()
      const result = await globalSandbox.executeScript('s3-explorer-error-handler', scriptError, context, payload)
      if (!result.success) {
        console.error('onError script error:', result.error)
      }
    }
  }, [scriptError, createContext])

  return (
    <S3Explorer
      {...props}
      queryId={queryId}
      datasourceId={datasourceId}
      initialPath={initialPath}
      showHidden={showHidden}
      recursive={recursive}
      maxFileSize={maxFileSize}
      allowedExtensions={allowedExtensions}
      elementId={elementId}
      onScriptFileSelect={handleScriptFileSelect}
      onScriptFolderToggle={handleScriptFolderToggle}
      onScriptDownload={handleScriptDownload}
      onScriptError={handleScriptError}
      isPreview={true}
    />
  )
}