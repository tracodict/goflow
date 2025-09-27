"use client"
import React, { useCallback, useState } from 'react'
import { useDatasourceStore } from '@/stores/datasource'
import { useQueryStore } from '@/stores/query'
import { useSavedQueriesStore } from '@/stores/saved-queries'
import { useDatasourceSchema } from '@/hooks/use-schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { sql } from '@codemirror/lang-sql'
import { cn } from '@/lib/utils'
import { Save, Play, Trash2 } from 'lucide-react'

export function QueryEditor() {
  const { datasources } = useDatasourceStore()
  const { activeDatasourceId, setDatasource, mongoInput, setMongoInput, sqlInput, setSqlInput, runMongo, runSql, running, error, result, clearResult, collection, setCollection, table, setTable } = useQueryStore()
  const { saveQuery } = useSavedQueriesStore()
  const current = datasources.find(d=> d.id===activeDatasourceId)
  const { collections, tables } = useDatasourceSchema(activeDatasourceId)
  
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  
    const handleSaveQuery = async () => {
    const currentQuery = current?.type === 'mongo' ? mongoInput : sqlInput
    if (!currentQuery?.trim()) return
    
    const queryName = saveName.trim() || 'Untitled Query'
    await saveQuery({
      name: queryName,
      type: current?.type === 'mongo' ? 'mongo' : 'sql',
      datasourceId: activeDatasourceId || '',
      content: currentQuery,
      collection: current?.type === 'mongo' ? collection : undefined,
      table: current?.type !== 'mongo' ? table : undefined
    })
    
    setShowSaveDialog(false)
    setSaveName('')
    
    // Optionally show a toast or feedback that the query was saved
    console.log('Query saved:', queryName)
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-2 flex-wrap">
        <select className="border rounded px-2 py-1 text-sm" value={activeDatasourceId||''} onChange={e=> setDatasource(e.target.value||undefined)}>
          <option value="">Select datasource…</option>
          {datasources.map(d=> <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
        </select>
        {current?.type==='mongo' && collections.length>0 && (
          <select className="border rounded px-2 py-1 text-sm" value={collection||''} onChange={e=> setCollection(e.target.value||undefined)}>
            <option value="">Collection…</option>
            {collections.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {current && current.type!=='mongo' && tables.length>0 && (
          <select className="border rounded px-2 py-1 text-sm" value={table||''} onChange={e=> setTable(e.target.value||undefined)}>
            <option value="">Table…</option>
            {tables.map(t=> <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <div className="flex gap-1">
          {current?.type==='mongo' && 
            <Button size="sm" onClick={()=> runMongo()} disabled={running || !mongoInput.trim() || !current}>
              <Play className="w-3 h-3 mr-1" />
              Run Pipeline
            </Button>
          }
          {current?.type!=='mongo' && current && 
            <Button size="sm" onClick={()=> runSql()} disabled={running || !sqlInput?.trim()}>
              <Play className="w-3 h-3 mr-1" />
              Run SQL
            </Button>
          }
          <Button size="sm" variant="outline" onClick={()=> setShowSaveDialog(true)} disabled={!current || (!mongoInput?.trim() && !sqlInput?.trim())}>
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
      
        <div className="flex-1 border rounded bg-white overflow-hidden [&_.cm-editor]:bg-white [&_.cm-content]:bg-white [&_.cm-editor]:h-full">
          {current?.type==='mongo' && (
          <CodeMirror
            value={mongoInput || '[\n  { "$limit": 50 }\n]'}
            height="100%"
            extensions={[json()]}
            basicSetup={{ lineNumbers:true, highlightActiveLine:true }}
            onChange={(v)=> setMongoInput(v)}
          />
          )}
          {current && current.type!=='mongo' && (
          <CodeMirror
            value={sqlInput || 'SELECT 1'}
            height="100%"
            extensions={[sql()]}
            basicSetup={{ lineNumbers:true, highlightActiveLine:true }}
            onChange={(v)=> setSqlInput(v)}
          />
          )}
          {!current && <div className="p-4 text-sm text-muted-foreground bg-white h-full flex items-center justify-center">Choose a datasource to begin</div>}
        </div>
    </div>
  )
}

export function QueryResultViewer() {
  const { result, error, running } = useQueryStore()
  if (running) return <div className="p-4 text-sm text-muted-foreground h-full flex items-center justify-center">Executing…</div>
  if (error) return <div className="p-4 text-sm text-red-600 h-full overflow-auto">{error}</div>
  if (!result) return <div className="p-4 text-xs text-muted-foreground h-full flex items-center justify-center">No results yet</div>
  const cols = result.columns
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden border rounded bg-white">
        <div className="overflow-auto h-full">
          <table className="min-w-full text-xs table-fixed">
            <thead className="bg-neutral-50 sticky top-0">
              <tr>
                {cols.map((c, index) => (
                  <th 
                    key={c.name} 
                    className="text-left px-2 py-1 font-semibold border-b border-neutral-200 min-w-[80px] max-w-[200px] truncate"
                    style={{ width: index < cols.length - 1 ? '150px' : 'auto' }}
                    title={c.name}
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r,i)=> (
                <tr key={i} className={cn(i%2?'bg-neutral-50/40':'bg-white')}>
                  {cols.map((c, index) => (
                    <td 
                      key={c.name} 
                      className="px-2 py-1 align-top border-b border-neutral-100 truncate max-w-[200px]"
                      style={{ width: index < cols.length - 1 ? '150px' : 'auto' }}
                      title={formatCell(r[c.name])}
                    >
                      <div className="truncate">
                        {formatCell(r[c.name])}
                      </div>
                    </td>
                  ))}
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
