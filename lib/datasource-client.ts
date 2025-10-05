// Thin REST client wrappers – Phase 1 (Mongo only implemented server side later)
import { DatasourceDetail, DatasourceSummary, QueryAST, QueryResult } from './datasource-types'

const BASE = '/api'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText
    try { const body = await res.json(); msg = body?.error?.message || body?.message || msg } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function listDatasources(): Promise<DatasourceSummary[]> {
  const r = await fetch(`${BASE}/datasources`, { cache: 'no-store' })
  const data = await json<{ datasources: DatasourceSummary[] }>(r)
  return data.datasources
}

export async function createDatasource(payload: { type: string; name: string; config: Record<string,any> }): Promise<DatasourceSummary> {
  const r = await fetch(`${BASE}/datasources`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
  return json<DatasourceSummary>(r)
}

export async function getDatasource(id: string): Promise<DatasourceDetail> {
  const r = await fetch(`${BASE}/datasources/${id}`, { cache: 'no-store' })
  return json<DatasourceDetail>(r)
}

export async function updateDatasource(id: string, payload: { name?: string; config?: Record<string,any>; secret?: Record<string,any> }): Promise<DatasourceDetail> {
  const r = await fetch(`${BASE}/datasources/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
  return json<DatasourceDetail>(r)
}

export async function deleteDatasource(id: string): Promise<{ ok: boolean }> {
  const r = await fetch(`${BASE}/datasources/${id}`, { method:'DELETE' })
  return json<{ ok: boolean }>(r)
}

export async function testDatasource(id: string, secretOverride?: Record<string,any>): Promise<{ ok: boolean; latencyMs?: number }> {
  const r = await fetch(`${BASE}/datasources/${id}/test`, { method:'POST', headers:{'Content-Type':'application/json'}, body: secretOverride ? JSON.stringify({ secret: secretOverride }) : undefined })
  return json(r)
}

export async function runDatasourceQuery(id: string, payload: { pipeline?: any[]; sql?: string; collection?: string; prefix?: string; key?: string; format?: string }): Promise<QueryResult> {
  const res = await fetch(`${BASE}/datasources/${id}/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) {
    let err: any = 'Query failed'
    try { const j = await res.json(); err = j.error || err } catch {}
    throw new Error(err)
  }
  return res.json()
}

export async function introspectDatasource(id: string, refresh = false): Promise<any> {
  const r = await fetch(`${BASE}/datasources/${id}/structure${refresh ? '?refresh=1':''}`)
  return json(r)
}

export async function executeAdhoc(ast: QueryAST, params?: Record<string,any>): Promise<QueryResult> {
  const r = await fetch(`${BASE}/query/execute`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ast, params }) })
  return json<QueryResult>(r)
}

export async function introspectSchema(id: string): Promise<{ collections?: string[]; tables?: string[] }> {
  const r = await fetch(`${BASE}/datasources/${id}/schema`, { cache:'no-store' })
  try { return await json(r) } catch { return {} as any }
}
