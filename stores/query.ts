// TEMP MINIMAL STORE to isolate syntax error
import { create } from 'zustand'
import { executeAdhocQuery, type QueryResult } from '@/lib/datastore-client'
import type { S3QueryResult } from '@/lib/datasource-types'
import { DEFAULT_SETTINGS } from '@/components/petri/system-settings-context'

type Engine = 'mongo' | 'postgres' | 'mysql' | 's3' | 'gcs'

export interface QueryHistoryItem { id: string; datasourceId: string; engine: Engine; input: unknown; started: number; durationMs: number; error?: string }

export interface QueryState {
  activeDatasourceId?: string
  mongoInput: string
  sqlInput: string
  s3Input: string
  collection?: string
  table?: string
  s3Prefix?: string
  running: boolean
  result?: QueryResult
  s3Result?: S3QueryResult
  error?: string
  history: QueryHistoryItem[]
  gcsQueryParams?: {
    folderPath: string
    recursive: boolean
    includeMetadata: boolean
    maxFileSize?: number
    allowedExtensions: string[]
    showHidden: boolean
  }
  setDatasource(id: string | undefined): void
  setMongoInput(v: string): void
  setSqlInput(v: string): void
  setS3Input(v: string): void
  setCollection(v: string | undefined): void
  setTable(v: string | undefined): void
  setS3Prefix(v: string | undefined): void
  setGcsQueryParams(params: QueryState['gcsQueryParams']): void
  setResult(result: QueryResult): void
  setS3Result(result: S3QueryResult): void
  clearResult(): void
  runMongo(flowServiceUrl?: string): Promise<void>
  runSql(): Promise<void>
  runS3(flowServiceUrl?: string): Promise<void>
}

export const useQueryStore = create<QueryState>((set, get) => {
  // Hydration from localStorage (safe in client only)
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('gf.queryState')
      if (raw) {
        const data = JSON.parse(raw)
        set({
          mongoInput: typeof data.mongoInput === 'string' ? data.mongoInput : '[\n  { "$limit": 50 }\n]',
          sqlInput: typeof data.sqlInput === 'string' ? data.sqlInput : 'SELECT 1',
          s3Input: typeof data.s3Input === 'string' ? data.s3Input : '',
          history: Array.isArray(data.history) ? data.history.filter((h: any) => h && h.id && h.engine).slice(0,50) : [],
          collection: data.collection,
          table: data.table,
          s3Prefix: data.s3Prefix
        })
      }
    } catch {}
  }

  const persistState = () => {
    if (typeof window !== 'undefined') {
      try {
        const state = get()
        const dataToSave = {
          mongoInput: state.mongoInput,
          sqlInput: state.sqlInput,
          s3Input: state.s3Input,
          history: state.history,
          collection: state.collection,
          table: state.table,
          s3Prefix: state.s3Prefix
        }
        window.localStorage.setItem('gf.queryState', JSON.stringify(dataToSave))
      } catch (error) {
        console.warn('Failed to persist query state:', error)
      }
    }
  }

  const pushHistory = (entry: QueryHistoryItem) => {
    set({ history: [entry, ...get().history].slice(0,50) })
    persistState()
  }

  return {
    activeDatasourceId: undefined,
    mongoInput: '[\n  { "$limit": 50 }\n]',
    sqlInput: 'SELECT 1',
    s3Input: '',
    s3Prefix: undefined,
    running: false,
    history: [],
    setDatasource(id) { set({ activeDatasourceId: id, result: undefined, s3Result: undefined, error: undefined }) },
    setMongoInput(v) { set({ mongoInput: v }); persistState() },
    setSqlInput(v) { set({ sqlInput: v }); persistState() },
    setS3Input(v) { set({ s3Input: v }); persistState() },
    setCollection(v) { set({ collection: v }); persistState() },
    setTable(v) { set({ table: v }); persistState() },
    setS3Prefix(v) { set({ s3Prefix: v }); persistState() },
    setGcsQueryParams(params) { set({ gcsQueryParams: params }); persistState() },
    setResult(result) { set({ result, s3Result: undefined, error: undefined }) },
    setS3Result(result) { set({ s3Result: result, result: undefined, error: undefined }) },
    clearResult() { set({ result: undefined, s3Result: undefined, error: undefined }) },
    async runMongo(flowServiceUrl?: string) {
      const dsId = get().activeDatasourceId; if (!dsId) return
      let pipeline: any[]
      try { pipeline = JSON.parse(get().mongoInput) } catch { set({ error: 'Invalid JSON pipeline' }); return }
      set({ running: true, error: undefined })
      const started = Date.now()
      try {
        const serviceUrl = flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
        const state = get()
        const parameters: Record<string, unknown> = {
          pipeline,
          ...(state.collection ? { collection: state.collection } : {})
        }

        const queryAST = {
          type: 'mongo',
          datasource_id: dsId,
          parameters
        }

        const result = await executeAdhocQuery(serviceUrl, queryAST, parameters)

        pushHistory({ id: Math.random().toString(36).slice(2), datasourceId: dsId, engine: 'mongo', input: pipeline, started, durationMs: Date.now() - started })
        set({ running: false, result, error: undefined, s3Result: undefined })
      } catch(e:any) {
        pushHistory({ id: Math.random().toString(36).slice(2), datasourceId: dsId, engine: 'mongo', input: pipeline, started, durationMs: Date.now() - started, error: e?.message })
        set({ running: false, error: e?.message || 'Query failed' })
      }
    },
    async runSql() {
      const dsId = get().activeDatasourceId; if (!dsId) return
      const sql = get().sqlInput
      set({ running: true, error: undefined })
      const started = Date.now()
      try {
        // TODO: Migrate SQL queries to FileStore API
        set({ running: false, error: 'SQL queries not yet migrated to FileStore API' })
        pushHistory({ id: Math.random().toString(36).slice(2), datasourceId: dsId, engine: 'postgres', input: sql, started, durationMs: Date.now() - started, error: 'Not migrated to FileStore API' })
      } catch(e:any) {
        pushHistory({ id: Math.random().toString(36).slice(2), datasourceId: dsId, engine: 'postgres', input: sql, started, durationMs: Date.now() - started, error: e?.message })
        set({ running: false, error: e?.message || 'Query failed' })
      }
    },
    async runS3(flowServiceUrl?: string) {
      const dsId = get().activeDatasourceId; if (!dsId) return
      const gcsParams = get().gcsQueryParams
      const s3Query = get().s3Input || get().s3Prefix || ''
      
      set({ running: true, error: undefined })
      const started = Date.now()
      
      try {
        const serviceUrl = flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl

        const folderPath = gcsParams?.folderPath || s3Query || '/'
        const allowedExtensions = gcsParams?.allowedExtensions?.length
          ? gcsParams.allowedExtensions
          : ['.pdf', '.txt', '.json', '.md', '.csv', '.xml', '.dat']

        const parameters: Record<string, unknown> = {
          folderPath,
          recursive: gcsParams?.recursive ?? true,
          includeMetadata: gcsParams?.includeMetadata ?? true,
          allowedExtensions
        }

        if (typeof gcsParams?.maxFileSize === 'number') {
          parameters.maxFileSize = gcsParams.maxFileSize
        }

        if (typeof gcsParams?.showHidden === 'boolean') {
          parameters.showHidden = gcsParams.showHidden
        }

        const queryAST = {
          type: 'folder',
          datasource_id: dsId,
          parameters
        }

        const result = await executeAdhocQuery(serviceUrl, queryAST)
        
        // Transform FileStore QueryResult into S3QueryResult format for backward compatibility
        const s3Result = {
          files: result.rows.map((row: any) => ({
            key: row.name || row.key || row.filename || 'Unknown',
            size: Number(row.size) || 0,
            lastModified: new Date(row.modified || row.lastModified || row.last_modified || Date.now()),
            etag: row.etag || row.hash || 'unknown',
            isFolder: row.type === 'folder' || row.isFolder || false,
            contentType: row.content_type || row.contentType
          })),
          prefix: folderPath,
          totalFiles: result.rows.length,
          meta: {
            executionMs: result.meta.executionMs,
            datasourceId: result.meta.datasourceId || dsId
          }
        }
        
        // Use 's3' as engine type for both S3 and GCS for backward compatibility in history
        pushHistory({ 
          id: Math.random().toString(36).slice(2), 
          datasourceId: dsId, 
          engine: 's3', 
          input: gcsParams || s3Query, 
          started, 
          durationMs: Date.now() - started 
        })
        
        set({ running: false, s3Result })
      } catch(e:any) {
        pushHistory({ 
          id: Math.random().toString(36).slice(2), 
          datasourceId: dsId, 
          engine: 's3', 
          input: gcsParams || s3Query, 
          started, 
          durationMs: Date.now() - started, 
          error: e?.message 
        })
        set({ running: false, error: e?.message || 'S3/GCS query failed' })
      }
    }
  }
})

// Persistence subscription (client side only)
if (typeof window !== 'undefined') {
  useQueryStore.subscribe((s) => {
    try {
      const payload = { mongoInput: s.mongoInput, sqlInput: s.sqlInput, s3Input: s.s3Input, history: s.history, collection: s.collection, table: s.table, s3Prefix: s.s3Prefix }
      window.localStorage.setItem('gf.queryState', JSON.stringify(payload))
    } catch {}
  })
}
