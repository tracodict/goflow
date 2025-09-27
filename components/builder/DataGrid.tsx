"use client"

import React, { useEffect, useState } from 'react'
import { useSavedQueriesStore } from '../../stores/saved-queries'
import { useQueryStore } from '../../stores/query'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'

interface DataGridProps {
  queryName?: string
  autoRefresh?: boolean
  style?: React.CSSProperties
  className?: string
  onClick?: () => void
  onMouseEnter?: () => void
}

export const DataGrid: React.FC<DataGridProps> = ({ 
  queryName, 
  autoRefresh = false, 
  style, 
  className,
  onClick,
  onMouseEnter
}) => {
  const { queries, hydrated, hydrate } = useSavedQueriesStore()
  const { runMongo, runSql, result, running, error: queryError, setDatasource, setMongoInput, setSqlInput, setCollection, setTable } = useQueryStore()
  
  const [localResult, setLocalResult] = useState<any>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastExecutedQuery, setLastExecutedQuery] = useState<string | null>(null)

  // Debug logging
  console.log('DataGrid render:', { 
    queryName, 
    selectedQueryExists: !!queries.find(q => q.name === queryName),
    resultExists: !!result,
    resultRowsLength: result?.rows?.length,
    isLoading,
    running,
    localResultExists: !!localResult
  })

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
    setLocalError(null)
    setLastExecutedQuery(selectedQuery.name)
    
    try {
      // Set up the query in the store
      setDatasource(selectedQuery.datasourceId)
      
      if (selectedQuery.type === 'mongo') {
        setMongoInput(selectedQuery.content)
        if (selectedQuery.collection) {
          setCollection(selectedQuery.collection)
        }
        await runMongo()
      } else {
        setSqlInput(selectedQuery.content)
        if (selectedQuery.table) {
          setTable(selectedQuery.table)
        }
        await runSql()
      }
      
      // The result will be automatically updated via the useEffect below
      
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Query execution failed')
      setIsLoading(false)
    }
  }

  // Auto-execute query when queryName changes or on mount
  useEffect(() => {
    if (selectedQuery && hydrated) {
      executeQuery()
    }
  }, [selectedQuery?.name, hydrated])

  // Also sync loading state with the query store running state
  useEffect(() => {
    if (running && selectedQuery) {
      setIsLoading(true)
    }
  }, [running, selectedQuery])

  // Sync with query store results - update immediately when they change
  useEffect(() => {
    // Only update if we just executed this query
    if (result && !running && lastExecutedQuery === queryName) {
      setLocalResult(result)
      setIsLoading(false)
    }
    if (queryError && lastExecutedQuery === queryName) {
      setLocalError(queryError)
      setIsLoading(false)
    }
  }, [result, queryError, running, lastExecutedQuery, queryName])

  const renderTable = () => {
    if (!localResult?.rows || !Array.isArray(localResult.rows) || localResult.rows.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          No data to display
        </div>
      )
    }

    const data = localResult.rows
    const headers = Object.keys(data[0] || {})

    return (
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map((header) => (
                <th key={header} className="p-2 text-left text-xs font-medium text-muted-foreground border-r last:border-r-0">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((row: any, index: number) => (
              <tr key={index} className="border-b hover:bg-muted/25">
                {headers.map((header) => (
                  <td key={header} className="p-2 text-xs border-r last:border-r-0">
                    <div className="max-w-[200px] truncate">
                      {typeof row[header] === 'object' 
                        ? JSON.stringify(row[header]) 
                        : String(row[header] ?? '')
                      }
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 100 && (
          <div className="p-2 text-xs text-muted-foreground text-center border-t">
            Showing first 100 of {data.length} rows
          </div>
        )}
      </div>
    )
  }

  const containerStyle: React.CSSProperties = {
    ...style,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden'
  }

  return (
    <div 
      style={containerStyle} 
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* Header */}
      <div className="p-3 bg-muted/30 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">
            {selectedQuery ? `Data: ${selectedQuery.name}` : 'Data Grid'}
          </h3>
          {selectedQuery && (
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
              {selectedQuery.type.toUpperCase()}
            </span>
          )}
        </div>
        {selectedQuery && (
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6"
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
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!selectedQuery ? (
          <div className="p-4 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No query selected</p>
            <p className="text-xs">Select a query in the Properties panel</p>
          </div>
        ) : isLoading ? (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Running query...</span>
          </div>
        ) : localError ? (
          <div className="p-4 text-center text-red-600">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="font-medium">Query Error</p>
            <p className="text-xs mt-1">{localError}</p>
          </div>
        ) : (
          renderTable()
        )}
      </div>
    </div>
  )
}