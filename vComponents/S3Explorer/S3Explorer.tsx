/**
 * S3Explorer Component
 * 
 * Enhanced S3 explorer component with event system and dynamic configuration.
 * Uses datasources directly with local state to avoid conflicts between multiple instances.
 */

import * as React from "react"
import { runDatasourceQuery } from "../../lib/datasource-client"
import { BaseEventPayload } from "@/lib/component-interface"
import { S3ExplorerEventPayload } from "./interface"
import type { S3QueryResult } from "@/lib/datasource-types"

// Component props interface
export interface S3ExplorerProps extends React.HTMLAttributes<HTMLDivElement> {
  datasourceId?: string
  initialPath?: string
  showHidden?: boolean
  
  // Script integration props
  isPreview?: boolean
  elementId?: string
  
  // Event handlers (for script integration)
  onScriptFileSelect?: (payload: S3ExplorerEventPayload) => void
  onScriptFolderToggle?: (payload: S3ExplorerEventPayload) => void
  onScriptDownload?: (payload: S3ExplorerEventPayload) => void
  onScriptError?: (payload: S3ExplorerEventPayload) => void
  onScriptMount?: (payload: BaseEventPayload) => void
  onScriptUnmount?: (payload: BaseEventPayload) => void
}

// S3Explorer component implementation
const S3Explorer = React.forwardRef<HTMLDivElement, S3ExplorerProps>(
  ({ 
    datasourceId,
    initialPath = "/",
    showHidden = false,
    className,
    style,
    isPreview = false,
    elementId,
    onScriptFileSelect,
    onScriptFolderToggle,
    onScriptDownload,
    onScriptError,
    onScriptMount,
    onScriptUnmount,
    ...props 
  }, ref) => {
    
    // Local state for this S3Explorer instance
    const [s3Result, setS3Result] = React.useState<S3QueryResult | null>(null)
    const [running, setRunning] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    
    // Generate element ID
    const finalElementId = elementId || `s3-explorer-${React.useId()}`
    
    // Local query function for this instance
    const runLocalS3Query = React.useCallback(async (dsId: string, prefix: string) => {
      if (!dsId) return
      
      setRunning(true)
      setError(null)
      
      try {
        // For S3 datasources, the API returns S3QueryResult directly, not wrapped in QueryResult
        const response = await fetch(`/api/ds/datasources/${dsId}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix })
        })
        
        if (!response.ok) {
          let errorMessage = `Query failed: ${response.statusText}`
          try {
            const errorBody = await response.json()
            errorMessage = errorBody?.error || errorMessage
          } catch {}
          throw new Error(errorMessage)
        }
        
        const result = await response.json() as S3QueryResult
        setS3Result(result)
      } catch (e: any) {
        const errorMessage = e?.message || 'S3 query failed'
        setError(errorMessage)
        
        // Trigger error event
        if (isPreview && onScriptError) {
          const payload: S3ExplorerEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'error',
            datasourceId: dsId,
            error: errorMessage
          }
          onScriptError(payload)
        }
      } finally {
        setRunning(false)
      }
    }, [isPreview, onScriptError, finalElementId])
    
    // Set up datasource and trigger query when datasourceId or initialPath changes
    React.useEffect(() => {
      if (datasourceId) {
        runLocalS3Query(datasourceId, initialPath)
      }
    }, [datasourceId, initialPath, runLocalS3Query])
    
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
    
    // Handle errors
    React.useEffect(() => {
      if (error && isPreview && onScriptError) {
        const payload: S3ExplorerEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'error',
          datasourceId,
          error
        }
        onScriptError(payload)
      }
    }, [error, isPreview, onScriptError, finalElementId, datasourceId])

    return (
      <div 
        ref={ref}
        className={className}
        style={style}
        data-element-id={finalElementId}
        {...props}
      >
        {/* We'll render the S3 files directly here instead of using the original component */}
        {running && <div>Loading S3 files...</div>}
        {error && <div className="text-red-500">Error: {error}</div>}
        {s3Result && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">
              Found {s3Result.files.length} items in {s3Result.prefix || '/'}
            </div>
            <div className="space-y-1">
              {s3Result.files.map((file, index) => (
                <div 
                  key={index}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded"
                  onClick={() => {
                    if (isPreview && onScriptFileSelect) {
                      const payload: S3ExplorerEventPayload = {
                        timestamp: Date.now(),
                        componentId: finalElementId,
                        eventType: 'fileSelect',
                        datasourceId,
                        fileName: file.key.split('/').pop() || file.key,
                        filePath: file.key,
                        fileSize: file.size,
                        fileType: file.contentType,
                        isFolder: file.isFolder,
                        action: 'select'
                      }
                      onScriptFileSelect(payload)
                    }
                  }}
                >
                  <span className="text-sm">
                    {file.isFolder ? '📁' : '📄'} {file.key}
                  </span>
                  {!file.isFolder && (
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {!running && !s3Result && !error && datasourceId && (
          <div className="text-gray-500">No S3 datasource selected</div>
        )}
      </div>
    )
  }
)

S3Explorer.displayName = "S3Explorer"

export { S3Explorer }