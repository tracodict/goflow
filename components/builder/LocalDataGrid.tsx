/**
 * Local DataGrid Component
 * 
 * DataGrid component with local state to avoid conflicts between multiple instances.
 * Uses saved queries and executes them with isolated state management.
 */

import React, { useEffect, useState } from 'react'
import { useSavedQueriesStore } from '../../stores/saved-queries'
import { runDatasourceQuery } from '../../lib/datasource-client'
import { QueryResult } from '../../lib/datasource-types'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'

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

  const selectedQuery = queryName ? queries.find(q => q.name === queryName) : null

  const executeQuery = async () => {
    if (!selectedQuery) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      let queryResult: QueryResult
      
      if (selectedQuery.type === 'mongo') {
        // For MongoDB queries, parse the content as pipeline
        let pipeline
        try {
          pipeline = JSON.parse(selectedQuery.content)
          if (!Array.isArray(pipeline)) {
            pipeline = [pipeline]
          }
        } catch {
          throw new Error('Invalid MongoDB pipeline JSON')
        }
        
        queryResult = await runDatasourceQuery(selectedQuery.datasourceId, {
          pipeline,
          collection: selectedQuery.collection
        })
      } else {
        // For SQL queries
        queryResult = await runDatasourceQuery(selectedQuery.datasourceId, {
          sql: selectedQuery.content
        })
      }
      
      setResult(queryResult)
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

    return (
      <div className="overflow-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="bg-muted sticky top-0">
            <tr>
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
                    {typeof row[col.name] === 'object' 
                      ? JSON.stringify(row[col.name]) 
                      : String(row[col.name] ?? '')
                    }
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