/**
 * S3Explorer Component
 * 
 * Enhanced GCS/S3 explorer component with FileStore API integration.
 * Uses FileStore API for querying GCS buckets and displaying file listings.
 * Supports both saved query execution and ad-hoc folder queries.
 */

import * as React from "react"
import { executeQuery, executeAdhocQuery, type QueryResult } from "../../lib/filestore-client"
import { BaseEventPayload } from "@/lib/component-interface"
import { S3ExplorerEventPayload } from "./interface"
import { useSystemSettings, DEFAULT_SETTINGS } from "@/components/petri/system-settings-context"

// GCS File item interface (based on FileStore API response)
export interface GCSFile {
  name: string
  path: string
  size: number
  modified: string
  type: 'file' | 'folder'
  extension?: string
  content_type?: string
}

// Component props interface
export interface S3ExplorerProps extends React.HTMLAttributes<HTMLDivElement> {
  // Query execution modes (use one of these)
  queryId?: string        // For saved query execution (/api/queries/:id/run)
  datasourceId?: string   // For ad-hoc queries (legacy compatibility)
  
  // Query parameters
  initialPath?: string
  showHidden?: boolean
  recursive?: boolean
  maxFileSize?: number
  allowedExtensions?: string[]
  
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
    queryId,
    datasourceId,
    initialPath = "/",
    showHidden = false,
    recursive = true,
    maxFileSize = 10485760, // 10MB default
    allowedExtensions = [".md", ".txt", ".json", ".yaml", ".pdf", ".csv", ".xml"],
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
    
    // System settings for flowServiceUrl
    const { settings } = useSystemSettings()  
    
    // Local state for this S3Explorer instance
    const [queryResult, setQueryResult] = React.useState<QueryResult | null>(null)
    const [gcsFiles, setGcsFiles] = React.useState<GCSFile[]>([])
    const [running, setRunning] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [currentPath, setCurrentPath] = React.useState(initialPath)
    
    // Generate element ID
    const finalElementId = elementId || `s3-explorer-${React.useId()}`
    
    // Get flowServiceUrl with fallbacks
    const getFlowServiceUrl = React.useCallback(() => {
      return settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
    }, [settings?.flowServiceUrl])
    
    // Convert QueryResult to GCSFile format
    const parseQueryResultToFiles = React.useCallback((result: QueryResult): GCSFile[] => {
      if (!result.rows || result.rows.length === 0) return []
      
      return result.rows.map((row: any, index: number) => {
        // Handle different possible row formats from GCS queries
        const fileName = row.name || row.key || row.filename || `file_${index}`
        const filePath = row.path || row.key || fileName
        const fileSize = typeof row.size === 'number' ? row.size : (parseInt(row.size) || 0)
        const lastModified = row.modified || row.lastModified || row.updated || new Date().toISOString()
        const isFolder = row.type === 'folder' || row.isFolder || fileName.endsWith('/')
        
        return {
          name: fileName,
          path: filePath,
          size: fileSize,
          modified: lastModified,
          type: isFolder ? 'folder' : 'file',
          extension: isFolder ? undefined : fileName.split('.').pop()?.toLowerCase(),
          content_type: row.content_type || row.contentType || (isFolder ? 'folder' : 'application/octet-stream')
        }
      })
    }, [])
    
    // Local query function using FileStore API
    const runGCSQuery = React.useCallback(async (path: string) => {
      const flowServiceUrl = getFlowServiceUrl()
      if (!flowServiceUrl) {
        setError('No flow service URL configured')
        return
      }
      
      setRunning(true)
      setError(null)
      
      try {
        let result: QueryResult
        
        if (queryId) {
          // Use saved query execution
          result = await executeQuery(flowServiceUrl, queryId, { 
            folderPath: path,
            recursive,
            includeMetadata: true 
          })
        } else if (datasourceId) {
          // Use ad-hoc query for legacy compatibility
          const queryAst = {
            type: 'folder',
            datasource_id: datasourceId,
            parameters: {
              folderPath: path,
              recursive,
              includeMetadata: true,
              maxFileSize,
              allowedExtensions
            }
          }
          result = await executeAdhocQuery(flowServiceUrl, queryAst, { folderPath: path })
        } else {
          throw new Error('Either queryId or datasourceId must be provided')
        }
        
        setQueryResult(result)
        const files = parseQueryResultToFiles(result)
        setGcsFiles(files)
        
      } catch (e: any) {
        const errorMessage = e?.message || 'GCS query failed'
        setError(errorMessage)
        
        // Trigger error event
        if (isPreview && onScriptError) {
          const payload: S3ExplorerEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'error',
            datasourceId: datasourceId,
            error: errorMessage
          }
          onScriptError(payload)
        }
      } finally {
        setRunning(false)
      }
    }, [queryId, datasourceId, recursive, maxFileSize, allowedExtensions, getFlowServiceUrl, parseQueryResultToFiles, isPreview, onScriptError, finalElementId])
    
    // Trigger query when parameters change
    React.useEffect(() => {
      if (queryId || datasourceId) {
        runGCSQuery(currentPath)
      }
    }, [queryId, datasourceId, currentPath])
    
    // Handle path navigation
    const navigateToPath = React.useCallback((newPath: string) => {
      setCurrentPath(newPath)
    }, [])
    
    // Handle folder click
    const handleFolderClick = React.useCallback((folder: GCSFile) => {
      if (folder.type === 'folder') {
        const newPath = folder.path.endsWith('/') ? folder.path : `${folder.path}/`
        navigateToPath(newPath)
        
        // Trigger folder toggle event
        if (isPreview && onScriptFolderToggle) {
          const payload: S3ExplorerEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'folderToggle',
            datasourceId,
            fileName: folder.name,
            filePath: folder.path,
            fileSize: folder.size,
            fileType: folder.content_type,
            isFolder: true,
            action: 'expand'
          }
          onScriptFolderToggle(payload)
        }
      }
    }, [navigateToPath, isPreview, onScriptFolderToggle, finalElementId, datasourceId])
    
    // Handle file selection
    const handleFileSelect = React.useCallback((file: GCSFile) => {
      if (isPreview && onScriptFileSelect) {
        const payload: S3ExplorerEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'fileSelect',
          datasourceId,
          fileName: file.name,
          filePath: file.path,
          fileSize: file.size,
          fileType: file.content_type,
          isFolder: file.type === 'folder',
          action: 'select'
        }
        onScriptFileSelect(payload)
      }
    }, [isPreview, onScriptFileSelect, finalElementId, datasourceId])
    
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
        className={`space-y-4 ${className || ''}`}
        style={style}
        data-element-id={finalElementId}
        {...props}
      >
        {/* Header with current path */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">
            📁 {currentPath}
          </div>
          {currentPath !== '/' && (
            <button
              onClick={() => {
                const parentPath = currentPath.split('/').slice(0, -2).join('/') + '/'
                navigateToPath(parentPath === '/' ? '/' : parentPath)
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ⬆️ Parent
            </button>
          )}
        </div>
        
        {/* Loading state */}
        {running && (
          <div className="flex items-center space-x-2 text-gray-600">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span>Loading GCS files...</span>
          </div>
        )}
        
        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="text-red-700 text-sm">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}
        
        {/* Results display */}
        {!running && gcsFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">
              Found {gcsFiles.length} items
              {queryResult?.meta?.executionMs && (
                <span className="ml-2 text-xs text-gray-500">
                  ({queryResult.meta.executionMs}ms)
                </span>
              )}
            </div>
            
            <div className="border border-gray-200 rounded-md divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {gcsFiles.map((file, index) => (
                <div 
                  key={`${file.path}-${index}`}
                  className={`flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    file.type === 'folder' ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => {
                    if (file.type === 'folder') {
                      handleFolderClick(file)
                    } else {
                      handleFileSelect(file)
                    }
                  }}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-lg flex-shrink-0">
                      {file.type === 'folder' ? '📁' : '📄'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </div>
                      {file.type === 'file' && file.extension && (
                        <div className="text-xs text-gray-500">
                          {file.extension.toUpperCase()} • {(file.size / 1024).toFixed(1)} KB
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    {file.type === 'file' && (
                      <span>{new Date(file.modified).toLocaleDateString()}</span>
                    )}
                    {file.type === 'folder' && (
                      <span className="text-blue-600">→</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Empty state */}
        {!running && !error && gcsFiles.length === 0 && (queryId || datasourceId) && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📂</div>
            <div className="text-sm">No files found in this location</div>
          </div>
        )}
        
        {/* No configuration state */}
        {!running && !error && !queryId && !datasourceId && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">⚙️</div>
            <div className="text-sm">No query or datasource configured</div>
          </div>
        )}
      </div>
    )
  }
)

S3Explorer.displayName = "S3Explorer"

export { S3Explorer }