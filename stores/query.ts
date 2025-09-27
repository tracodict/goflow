// TEMP MINIMAL STORE to isolate syntax error
import { create } from 'zustand'
import { runDatasourceQuery } from '@/lib/datasource-client'
import type { QueryResult, S3QueryResult } from '@/lib/datasource-types'

type Engine = 'mongo' | 'postgres' | 'mysql' | 's3'

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
  setDatasource(id: string | undefined): void
  setMongoInput(v: string): void
  setSqlInput(v: string): void
  setS3Input(v: string): void
  setCollection(v: string | undefined): void
  setTable(v: string | undefined): void
  setS3Prefix(v: string | undefined): void
  clearResult(): void
  runMongo(): Promise<void>
  runSql(): Promise<void>
  runS3(): Promise<void>
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
    clearResult() { set({ result: undefined, s3Result: undefined, error: undefined }) },
    async runMongo() {
      const dsId = get().activeDatasourceId; if (!dsId) return
      let pipeline: any[]
      try { pipeline = JSON.parse(get().mongoInput) } catch { set({ error: 'Invalid JSON pipeline' }); return }
      set({ running: true, error: undefined })
      const started = Date.now()
      try {
  const result = await runDatasourceQuery(dsId, { pipeline, collection: get().collection })
        pushHistory({ id: Math.random().toString(36).slice(2), datasourceId: dsId, engine: 'mongo', input: pipeline, started, durationMs: Date.now() - started })
        set({ running: false, result })
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
  const result = await runDatasourceQuery(dsId, { sql })
        pushHistory({ id: Math.random().toString(36).slice(2), datasourceId: dsId, engine: 'postgres', input: sql, started, durationMs: Date.now() - started })
        set({ running: false, result })
      } catch(e:any) {
        pushHistory({ id: Math.random().toString(36).slice(2), datasourceId: dsId, engine: 'postgres', input: sql, started, durationMs: Date.now() - started, error: e?.message })
        set({ running: false, error: e?.message || 'Query failed' })
      }
    },
    async runS3() {
      const dsId = get().activeDatasourceId; if (!dsId) return
      const s3Query = get().s3Input || get().s3Prefix || ''
      set({ running: true, error: undefined })
      const started = Date.now()
      try {
        // For now, return mock data since S3 API is future-proof
        const mockResult: S3QueryResult = {
          files: [
            { key: 'folder1/', size: 0, lastModified: new Date(), etag: '', isFolder: true },
            { key: 'file1.txt', size: 1024, lastModified: new Date(), etag: 'abc123', isFolder: false, contentType: 'text/plain' },
            { key: 'image.jpg', size: 2048, lastModified: new Date(), etag: 'def456', isFolder: false, contentType: 'image/jpeg' }
          ],
          prefix: s3Query,
          totalFiles: 3,
          meta: { executionMs: Date.now() - started, datasourceId: dsId }
        }
        pushHistory({ id: Math.random().toString(36).slice(2), datasourceId: dsId, engine: 's3', input: s3Query, started, durationMs: Date.now() - started })
        set({ running: false, s3Result: mockResult })
      } catch(e:any) {
        pushHistory({ id: Math.random().toString(36).slice(2), datasourceId: dsId, engine: 's3', input: s3Query, started, durationMs: Date.now() - started, error: e?.message })
        set({ running: false, error: e?.message || 'S3 query failed' })
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
