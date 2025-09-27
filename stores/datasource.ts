import { create } from 'zustand'
import { DatasourceSummary, QueryAST, QueryResult, DatasourceError, DatasourceDetail } from '@/lib/datasource-types'
import { listDatasources, executeAdhoc, getDatasource, updateDatasource, deleteDatasource, testDatasource } from '@/lib/datasource-client'

interface ExecutionState {
  running: boolean
  result?: QueryResult
  error?: DatasourceError
}

interface DatasourceState {
  datasources: DatasourceSummary[]
  details: Record<string, DatasourceDetail>
  loading: boolean
  error?: string
  execution: ExecutionState
  fetchDatasources: () => Promise<void>
  runAdhoc: (ast: QueryAST) => Promise<void>
  fetchDetail: (id: string) => Promise<DatasourceDetail | undefined>
  patchDatasource: (id: string, payload: { name?: string; config?: Record<string,any>; secret?: Record<string,any> }) => Promise<DatasourceDetail | undefined>
  removeDatasource: (id: string) => Promise<void>
  testDatasource: (id: string, secretOverride?: Record<string,any>) => Promise<{ ok: boolean; latencyMs?: number }|undefined>
  connectDatasource: (id: string) => Promise<void>
}

export const useDatasourceStore = create<DatasourceState>((set, get) => ({
  datasources: [],
  details: {},
  loading: false,
  execution: { running: false },
  async fetchDatasources() {
    set({ loading: true, error: undefined })
    try {
      const list = await listDatasources().catch(() => []) // backend not ready fallback
      set({ datasources: list, loading: false })
    } catch (e:any) {
      set({ error: e?.message || 'Failed to load datasources', loading: false })
    }
  },
  async runAdhoc(ast) {
    set({ execution: { running: true } })
    try {
      const result = await executeAdhoc(ast).catch(() => ({ columns:[], rows:[], meta:{ executionMs:0, datasourceId: ast.datasourceId, cached:false }}))
      set({ execution: { running: false, result } })
    } catch (e:any) {
      set({ execution: { running: false, error: { message: e?.message || 'Query failed' } } })
    }
  },
  async fetchDetail(id) {
    try {
      const d = await getDatasource(id)
      set(s => ({ details: { ...s.details, [id]: d } }))
      return d
    } catch { return undefined }
  },
  async patchDatasource(id, payload) {
    try {
      const d = await updateDatasource(id, payload)
      set(s => ({ details: { ...s.details, [id]: d }, datasources: s.datasources.map(x=> x.id===id ? { ...x, name: d.name } : x) }))
      return d
    } catch { return undefined }
  },
  async removeDatasource(id) {
    try { await deleteDatasource(id) } catch {}
    set(s => ({ datasources: s.datasources.filter(d=> d.id!==id), details: Object.fromEntries(Object.entries(s.details).filter(([k])=> k!==id)) }))
  },
  async testDatasource(id, secretOverride) {
    try {
      const res = await testDatasource(id, secretOverride)
      if (res?.ok) {
        // Persist metadata into detail & list if already loaded
        set(s => ({
          datasources: s.datasources.map(d => d.id===id ? { ...d, lastLatencyMs: res.latencyMs, status: 'healthy' as any } : d),
          details: s.details[id] ? { ...s.details, [id]: { ...s.details[id], lastLatencyMs: res.latencyMs, status: 'healthy' as any } } : s.details
        }))
      }
      return res as any
    } catch { return undefined }
  },
  async connectDatasource(id) {
    const res = await get().testDatasource(id)
    if (!res?.ok) {
      // mark as error if previously known
      set(s => ({
        datasources: s.datasources.map(d => d.id===id ? { ...d, status: 'error' as any } : d),
        details: s.details[id] ? { ...s.details, [id]: { ...s.details[id], status: 'error' as any } } : s.details
      }))
    }
  }
}))
