// TEMP MINIMAL STORE to isolate syntax error
import { create } from 'zustand'
import { runDatasourceQuery } from '@/lib/datasource-client'
import type { QueryResult } from '@/lib/datasource-types'

type Engine = 'mongo' | 'postgres' | 'mysql'

export interface QueryHistoryItem { id: string; datasourceId: string; engine: Engine; input: unknown; started: number; durationMs: number; error?: string }

export interface QueryState {
  activeDatasourceId?: string
  mongoInput: string
  sqlInput: string
  collection?: string
  table?: string
  running: boolean
  result?: QueryResult
  error?: string
  history: QueryHistoryItem[]
  setDatasource(id: string | undefined): void
  setMongoInput(v: string): void
  setSqlInput(v: string): void
  setCollection(v: string | undefined): void
  setTable(v: string | undefined): void
  clearResult(): void
  runMongo(): Promise<void>
  runSql(): Promise<void>
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
          history: Array.isArray(data.history) ? data.history.filter((h: any) => h && h.id && h.engine).slice(0,50) : [],
          collection: data.collection,
          table: data.table
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
          history: state.history,
          collection: state.collection,
          table: state.table
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
    running: false,
    history: [],
    setDatasource(id) { set({ activeDatasourceId: id, result: undefined, error: undefined }) },
    setMongoInput(v) { set({ mongoInput: v }); persistState() },
    setSqlInput(v) { set({ sqlInput: v }); persistState() },
    setCollection(v) { set({ collection: v }); persistState() },
    setTable(v) { set({ table: v }); persistState() },
    clearResult() { set({ result: undefined, error: undefined }) },
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
    }
  }
})

// Persistence subscription (client side only)
if (typeof window !== 'undefined') {
  useQueryStore.subscribe((s) => {
    try {
      const payload = { mongoInput: s.mongoInput, sqlInput: s.sqlInput, history: s.history, collection: s.collection, table: s.table }
      window.localStorage.setItem('gf.queryState', JSON.stringify(payload))
    } catch {}
  })
}
