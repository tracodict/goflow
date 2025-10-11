/**
 * Local DataGrid Component
 * 
 * DataGrid component with local state to avoid conflicts between multiple instances.
 * Uses saved queries and executes them with isolated state management.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useSavedQueriesStore } from '../../stores/saved-queries'
import { useQueryStore as useFilestoreQueryStore } from '../../stores/filestore-query'
import { executeAdhocQuery, executeQuery as runSavedQuery } from '../../lib/datastore-client'
import { QueryResult } from '../../lib/datasource-types'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { useSystemSettings, DEFAULT_SETTINGS } from '../petri/system-settings-context'

interface LocalDataGridProps {
  queryName?: string
  autoRefresh?: boolean
  style?: React.CSSProperties
  className?: string
  onClick?: () => void
  onMouseEnter?: () => void
}

export const LocalDataGrid: React.FC<LocalDataGridProps> = ({ 
  queryName, 
  autoRefresh = false, 
  style, 
  className,
  onClick,
  onMouseEnter
}) => {
  const { queries, hydrated, hydrate } = useSavedQueriesStore()
  const { queries: remoteQueries, fetchQueries } = useFilestoreQueryStore()
  const { settings } = useSystemSettings()
  
  // Local state for this instance
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Hydrate queries if not already done
  useEffect(() => {
    if (!hydrated) {
      hydrate()
    }
  }, [hydrated, hydrate])

  useEffect(() => {
    if (!queryName) return

    const flowServiceUrl = settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
    if (remoteQueries.length === 0) {
      fetchQueries(flowServiceUrl).catch(() => {})
    }
  }, [fetchQueries, remoteQueries.length, queryName, settings?.flowServiceUrl])

  const remoteQuery = useMemo(() => {
    return queryName ? remoteQueries.find((query) => query.name === queryName) : undefined
  }, [queryName, remoteQueries])

  const selectedQuery = useMemo(() => {
    if (queryName == null) return null

    const saved = queries.find(q => q.name === queryName)
    if (saved) return saved

    if (!remoteQuery) return null

    const normalizedType = remoteQuery.query_type === 'folder' ? 's3' : remoteQuery.query_type as any
    const pipeline = remoteQuery.parameters?.pipeline
    const normalizedContent = remoteQuery.query
      ?? (pipeline ? JSON.stringify(pipeline, null, 2) : JSON.stringify(remoteQuery.parameters ?? {}))

    return {
      id: remoteQuery.id,
      name: remoteQuery.name,
      type: normalizedType,
      datasourceId: remoteQuery.data_source_id,
      content: normalizedContent || '',
      collection: remoteQuery.parameters?.collection,
      table: remoteQuery.parameters?.table,
      s3Prefix: remoteQuery.parameters?.folder_path,
      createdAt: remoteQuery.createdAt || new Date().toISOString(),
      updatedAt: remoteQuery.updatedAt || new Date().toISOString()
    } as const
  }, [queries, queryName, remoteQuery])

  const executeQuery = async () => {
    if (!selectedQuery) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const flowServiceUrl = settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl

  const queryId = selectedQuery.id || remoteQuery?.id
  let apiResult: import('../../lib/datastore-client').QueryResult

      if (queryId) {
        apiResult = await runSavedQuery(flowServiceUrl, queryId, {})
      } else {
        let ast: any

        if (selectedQuery.type === 'mongo') {
          let pipeline
          try {
            pipeline = JSON.parse(selectedQuery.content)
          } catch {
            throw new Error('Invalid MongoDB pipeline JSON')
          }
          ast = {
            type: 'mongo',
            datasource_id: selectedQuery.datasourceId,
            parameters: {
              pipeline,
              collection: selectedQuery.collection
            }
          }
        } else if (selectedQuery.type === 's3') {
          ast = {
            type: 'folder',
            datasource_id: selectedQuery.datasourceId,
            parameters: {
              folderPath: selectedQuery.s3Prefix || selectedQuery.content || '/',
              recursive: true,
              includeMetadata: true,
              showHidden: false
            }
          }
        } else {
          ast = {
            type: 'sql',
            datasource_id: selectedQuery.datasourceId,
            parameters: {
              sql: selectedQuery.content,
              table: selectedQuery.table
            }
          }
        }

        apiResult = await executeAdhocQuery(flowServiceUrl, ast)
      }

      const normalized: QueryResult = {
        columns: Array.isArray(apiResult.columns)
          ? apiResult.columns.map((col: any, index: number) => {
              if (typeof col === 'string') {
                const name = col?.trim().length ? col : `column_${index}`
                return { name }
              }
              const keyCandidates = [col?.name, col?.key, col?.field, col?.label].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
              const name = keyCandidates[0] || `column_${index}`
              return { ...col, name }
            })
          : [],
        rows: apiResult.rows || [],
        meta: apiResult.meta || { executionMs: 0, datasourceId: selectedQuery.datasourceId }
      }

      setResult(normalized)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query execution failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-execute query when queryName changes or on mount
  useEffect(() => {
    if (selectedQuery && hydrated) {
      executeQuery()
    }
  }, [selectedQuery?.name, hydrated])

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && selectedQuery && hydrated) {
      const interval = setInterval(executeQuery, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh, selectedQuery, hydrated])

  const renderTable = () => {
    if (!result?.rows || !Array.isArray(result.rows) || result.rows.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          No data to display
        </div>
      )
    }

    const columns = result.columns || []
    const rows = result.rows

    const getCellValue = (row: any, column: any, columnIndex: number) => {
      if (row === null || row === undefined) return ''

      const keyCandidates: string[] = [column?.name, column?.key, column?.field, column?.label].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

      if (Array.isArray(row)) {
        return row[columnIndex]
      }

      if (typeof row === 'object') {
        for (const key of keyCandidates) {
          if (key in row) {
            return (row as Record<string, unknown>)[key]
          }
        }
      }

      return ''
    }

    return (
      <div className="overflow-auto max-h-96">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              {columns.map((col, index) => (
                <th key={index} className="p-2 text-left font-medium border">
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-muted/50">
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className="p-2 border">
                    {(() => {
                      const value = getCellValue(row, col, colIndex)
                      if (value === null) return 'null'
                      if (value === undefined) return ''
                      if (typeof value === 'object') return JSON.stringify(value)
                      return String(value)
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!queryName) {
    return (
      <div className="p-4 text-center text-muted-foreground border rounded-lg" style={style}>
        No query selected
      </div>
    )
  }

  if (!selectedQuery) {
    return (
      <div className="p-4 text-center text-muted-foreground border rounded-lg" style={style}>
        Query "{queryName}" not found
      </div>
    )
  }

  return (
    <div 
      className={`border rounded-lg ${className || ''}`} 
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className="p-2 bg-muted/30 border-b flex justify-between items-center">
        <h3 className="font-medium text-sm">
          {selectedQuery.name}
        </h3>
        <div className="flex items-center gap-2">
          {autoRefresh && (
            <span className="text-xs text-muted-foreground">Auto-refresh</span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              executeQuery()
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border-b flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {renderTable()}

      {result && (
        <div className="p-2 text-xs text-muted-foreground bg-muted/20 border-t">
          {result.rows?.length || 0} rows • {result.meta?.executionMs || 0}ms
        </div>
      )}
    </div>
  )
}