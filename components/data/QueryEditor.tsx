"use client"
import React, { useCallback, useState } from 'react'
import { useDataSourceStore } from '@/stores/filestore-datasource'
import { useQueryStore } from '@/stores/query'
import { useQueryStore as useFilestoreQueryStore } from '@/stores/filestore-query'
import { useDatasourceSchema } from '@/hooks/use-schema'
import { useSystemSettings, DEFAULT_SETTINGS } from '@/components/petri/system-settings-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResizableCodeMirror } from '@/components/ui/resizable-codemirror'
import { json } from '@codemirror/lang-json'
import { sql } from '@codemirror/lang-sql'
import { cn } from '@/lib/utils'
import { Save, Play, Trash2 } from 'lucide-react'
import { S3Explorer } from '@/vComponents/S3Explorer'
import { GCSQueryInput, type GCSQueryParams } from './GCSQueryInput'

export function QueryEditor() {
  const { dataSources, fetchDataSources } = useDataSourceStore()
  const { activeDatasourceId, setDatasource, mongoInput, setMongoInput, sqlInput, setSqlInput, runMongo, runSql, runS3, running, error, result, clearResult, collection, setCollection, table, setTable, s3Input, setS3Input, setGcsQueryParams, gcsQueryParams } = useQueryStore()
  const { createQuery, fetchQueries } = useFilestoreQueryStore()
  const { settings } = useSystemSettings()
  const current = dataSources.find(d=> d.id===activeDatasourceId)
  const currentType = current?.type
  const isMongoDatasource = currentType === 'mongodb'
  const isFileDatasource = currentType === 's3' || currentType === 'gcs'
  const isSqlDatasource = currentType === 'postgres' || currentType === 'mysql'
  const { collections, tables, folders } = useDatasourceSchema(activeDatasourceId)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  
  // Load datasources when component mounts
  React.useEffect(() => {
    if (settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl) {
      fetchDataSources(settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl)
    }
  }, [fetchDataSources, settings?.flowServiceUrl])
  
  // Handle GCS query execution
  const handleGCSQuery = useCallback(async (params: GCSQueryParams) => {
    if (!current) return
    
    // Get flowServiceUrl from settings
    const flowServiceUrl = settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
    
    // Store GCS query parameters for FileStore API
    setGcsQueryParams(params)
    
    // Also set s3Input for backward compatibility
    const prefix = params.folderPath.startsWith('/') ? params.folderPath.slice(1) : params.folderPath
    setS3Input(prefix)
    
    // Execute query with FileStore API
    await runS3(flowServiceUrl)
  }, [current, setGcsQueryParams, setS3Input, runS3, settings?.flowServiceUrl])
  
    const handleSaveQuery = async () => {
    let currentQuery = ''
    let queryType: 'sql' | 'mongo' | 's3' = 'sql'

    if (isMongoDatasource) {
      currentQuery = mongoInput
      queryType = 'mongo'
    } else if (isFileDatasource) {
      currentQuery = s3Input || '/'
      queryType = 's3'
    } else {
      currentQuery = sqlInput
      queryType = 'sql'
    }
    
    if (!currentQuery?.trim()) return
    
    const queryName = saveName.trim() || 'Untitled Query'
    const flowServiceUrl = settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
    
    try {
      // Create query definition using filestore-query store
      const queryDefinition = {
        name: queryName,
        data_source_id: activeDatasourceId || '',
        query_type: queryType === 's3' ? 'folder' : queryType as any,
        query: queryType === 'sql' ? currentQuery : undefined,
        parameters: {
          ...(queryType === 'mongo' ? { pipeline: JSON.parse(currentQuery) } : {}),
          ...(queryType === 's3' ? { folder_path: currentQuery } : {}),
          ...(isMongoDatasource && collection ? { collection } : {}),
          ...(isSqlDatasource && table ? { table } : {})
        },
        enabled: true
      }
      
      await createQuery(flowServiceUrl, queryDefinition)
      
      // Refresh the queries list to update LeftPanel immediately
      await fetchQueries(flowServiceUrl)
      
      setShowSaveDialog(false)
      setSaveName('')
      
      // Show success message
      console.log('Query saved to server:', queryName)
    } catch (error: any) {
      console.error('Failed to save query:', error)
      // Keep dialog open on error so user can retry
    }
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-2 flex-wrap">
        <select className="border rounded px-2 py-1 text-sm" value={activeDatasourceId||''} onChange={e=> setDatasource(e.target.value||undefined)}>
          <option value="">Select datasource…</option>
          {dataSources.map(d=> <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
        </select>
        {isMongoDatasource && collections.length>0 && (
          <select className="border rounded px-2 py-1 text-sm" value={collection||''} onChange={e=> setCollection(e.target.value||undefined)}>
            <option value="">Collection…</option>
            {collections.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {isSqlDatasource && tables.length>0 && (
          <select className="border rounded px-2 py-1 text-sm" value={table||''} onChange={e=> setTable(e.target.value||undefined)}>
            <option value="">Table…</option>
            {tables.map(t=> <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {isFileDatasource && folders.length>0 && (
          <select
            className="border rounded px-2 py-1 text-sm"
            value={s3Input || ''}
            onChange={e => {
              const nextPrefix = e.target.value
              setS3Input(nextPrefix)
              if (current?.type === 'gcs') {
                setGcsQueryParams({
                  folderPath: nextPrefix || '/',
                  recursive: gcsQueryParams?.recursive ?? false,
                  includeMetadata: gcsQueryParams?.includeMetadata ?? false,
                  maxFileSize: gcsQueryParams?.maxFileSize,
                  allowedExtensions: gcsQueryParams?.allowedExtensions ?? [],
                  showHidden: gcsQueryParams?.showHidden ?? false
                })
              }
            }}
          >
            <option value="">Folder…</option>
            {folders.map((folderName, index) => {
              const optionValue = folderName === '/' ? '' : folderName
              const label = folderName || '/'
              return (
                <option key={`${folderName || 'root'}-${index}`} value={optionValue}>
                  {label}
                </option>
              )
            })}
          </select>
        )}
        <div className="flex gap-1">
          {isMongoDatasource && 
            <Button
              size="sm"
              onClick={() => runMongo(settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl)}
              disabled={running || !mongoInput.trim() || !current}
            >
              <Play className="w-3 h-3 mr-1" />
              Run Pipeline
            </Button>
          }
          {isSqlDatasource && current && 
            <Button size="sm" onClick={()=> runSql()} disabled={running || !sqlInput?.trim()}>
              <Play className="w-3 h-3 mr-1" />
              Run SQL
            </Button>
          }
          {current && isFileDatasource && 
            <span className="text-xs text-gray-600">
              Use the form below to query {current?.type === 'gcs' ? 'GCS' : 'S3'} objects
            </span>
          }
          <Button size="sm" variant="outline" onClick={()=> setShowSaveDialog(true)} disabled={!current || (!mongoInput?.trim() && !sqlInput?.trim() && !s3Input?.trim())}>
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={()=> clearResult()} disabled={running || (!result && !error)}>
            <Trash2 className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
        {running && <span className="text-xs text-muted-foreground">Running…</span>}
        {error && <span className="text-xs text-red-600 max-w-xs line-clamp-1" title={error}>{error}</span>}
      </div>
      
      {showSaveDialog && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
          <Input
            placeholder="Query name..."
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && handleSaveQuery()}
          />
          <Button size="sm" onClick={handleSaveQuery} disabled={!saveName.trim()}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
        </div>
      )}
      
        <div className="flex-1 min-h-0 [&_.cm-editor]:bg-white [&_.cm-content]:bg-white">
          {isMongoDatasource && (
          <ResizableCodeMirror
            value={mongoInput || '[\n  { "$limit": 50 }\n]'}
            flex={true}
            initialHeight={300}
            extensions={[json()]}
            basicSetup={{ lineNumbers:true, highlightActiveLine:true }}
            onChange={(v)=> setMongoInput(v)}
            storageKey="query-editor-mongo"
            placeholder="MongoDB aggregation pipeline..."
          />
          )}
          {isSqlDatasource && current && (
          <ResizableCodeMirror
            value={sqlInput || 'SELECT 1'}
            flex={true}
            initialHeight={300}
            extensions={[sql()]}
            basicSetup={{ lineNumbers:true, highlightActiveLine:true }}
            onChange={(v)=> setSqlInput(v)}
            storageKey="query-editor-sql"
            placeholder="SQL query..."
          />
          )}
          {current && isFileDatasource && (
            <GCSQueryInput
              onExecute={handleGCSQuery}
              disabled={!current}
              loading={running}
              initialValues={gcsQueryParams}
            />
          )}
          {!current && <div className="p-4 text-sm text-muted-foreground bg-white h-full flex items-center justify-center border rounded-md">Choose a datasource to begin</div>}
        </div>
    </div>
  )
}

export function QueryResultViewer() {
  const { result, s3Result, error, running, activeDatasourceId } = useQueryStore()
  const { dataSources } = useDataSourceStore()
  const currentDatasource = dataSources.find(ds => ds.id === activeDatasourceId)
  
  if (running) return <div className="p-4 text-sm text-muted-foreground h-full flex items-center justify-center">Executing…</div>
  if (error) return <div className="p-4 text-sm text-red-600 h-full overflow-auto">{error}</div>
  if (!result && !s3Result) return <div className="p-4 text-xs text-muted-foreground h-full flex items-center justify-center">No results yet</div>
  
  // For S3/GCS datasources, show results in S3Explorer format if s3Result is available
  if ((currentDatasource?.type === 's3' || currentDatasource?.type === 'gcs') && s3Result) {
    return (
      <div className="h-full bg-white border rounded">
        <div className="p-3 border-b bg-gray-50">
          <div className="text-sm font-medium">
            {currentDatasource.type === 'gcs' ? 'GCS' : 'S3'} Query Results
          </div>
          <div className="text-xs text-gray-600">
            {s3Result.files.length} items • {s3Result.meta.executionMs}ms • {s3Result.prefix}
          </div>
        </div>
        <div className="overflow-auto h-full p-4">
          <div className="space-y-2">
            {s3Result.files.map((file: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">
                    {file.isFolder ? '📁' : '📄'}
                  </span>
                  <div>
                    <div className="text-sm font-medium">
                      {file.key}
                    </div>
                    {!file.isFolder && file.size && (
                      <div className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    )}
                  </div>
                </div>
                {file.lastModified && (
                  <div className="text-xs text-gray-500">
                    {new Date(file.lastModified).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  // For S3/GCS datasources with regular result format (fallback)
  if ((currentDatasource?.type === 's3' || currentDatasource?.type === 'gcs') && result && result.rows) {
    return (
      <div className="h-full bg-white border rounded">
        <div className="p-3 border-b bg-gray-50">
          <div className="text-sm font-medium">
            {currentDatasource.type === 'gcs' ? 'GCS' : 'S3'} Query Results
          </div>
          <div className="text-xs text-gray-600">
            {result.rows.length} items • {result.meta.executionMs}ms
          </div>
        </div>
        <div className="overflow-auto h-full p-4">
          <div className="space-y-2">
            {result.rows.map((row: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">
                    {row.isFolder || row.type === 'folder' ? '📁' : '📄'}
                  </span>
                  <div>
                    <div className="text-sm font-medium">
                      {row.name || row.key || row.filename || 'Unknown'}
                    </div>
                    {!row.isFolder && row.size && (
                      <div className="text-xs text-gray-500">
                        {(row.size / 1024).toFixed(1)} KB
                      </div>
                    )}
                  </div>
                </div>
                {row.lastModified && (
                  <div className="text-xs text-gray-500">
                    {new Date(row.lastModified).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  // If no result available, show empty state
  if (!result) return <div className="p-4 text-xs text-muted-foreground h-full flex items-center justify-center">No results yet</div>
  
  const rawColumns = Array.isArray(result.columns) ? result.columns : []
  const columns = rawColumns.map((col, idx) => {
    if (typeof col === 'string') {
      const key = col && col.trim().length > 0 ? col : `column_${idx}`
      return {
        key,
        label: col && col.trim().length > 0 ? col : `Column ${idx + 1}`,
        headerKey: `${key}-${idx}`,
        index: idx
      }
    }

    const keyCandidate = [col?.key, col?.name, col?.field].find((value) => typeof value === 'string' && value.trim().length > 0)
    const key = keyCandidate || `column_${idx}`
    const labelCandidate = [col?.label, col?.name, col?.key, col?.field].find((value) => typeof value === 'string' && value.trim().length > 0)

    return {
      key,
      label: labelCandidate || `Column ${idx + 1}`,
      headerKey: `${key}-${idx}`,
      index: idx
    }
  })

  const getCellValue = (row: any, column: typeof columns[number]) => {
    if (row === null || row === undefined) return undefined
    if (Array.isArray(row)) {
      return row[column.index]
    }
    if (typeof row === 'object') {
      if (column.key in row) return (row as Record<string, any>)[column.key]
      if (column.label in row) return (row as Record<string, any>)[column.label]
    }
    return undefined
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden border rounded bg-white">
        <div className="overflow-auto h-full">
          <table className="min-w-full text-xs table-fixed">
            <thead className="bg-neutral-50 sticky top-0">
              <tr>
                {columns.map((column) => (
                  <th 
                    key={column.headerKey}
                    className="text-left px-2 py-1 font-semibold border-b border-neutral-200 min-w-[80px] max-w-[200px] truncate"
                    style={{ width: column.index < columns.length - 1 ? '150px' : 'auto' }}
                    title={column.label}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={cn(rowIndex % 2 ? 'bg-neutral-50/40' : 'bg-white')}>
                  {columns.map((column) => {
                    const cellValue = getCellValue(row, column)
                    return (
                      <td 
                        key={`${column.headerKey}-row-${rowIndex}`}
                        className="px-2 py-1 align-top border-b border-neutral-100 truncate max-w-[200px]"
                        style={{ width: column.index < columns.length - 1 ? '150px' : 'auto' }}
                        title={formatCell(cellValue)}
                      >
                        <div className="truncate">
                          {formatCell(cellValue)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="p-2 text-[10px] text-muted-foreground flex items-center gap-4 border-t bg-neutral-50 flex-shrink-0">
        <span>{result.rows.length} rows</span>
        <span>Time: {result.meta.executionMs}ms</span>
      </div>
    </div>
  )

  
}

function formatCell(v:any) {
  if (v === null) return 'null'
  if (v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
