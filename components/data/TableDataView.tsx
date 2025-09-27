"use client"
import React from 'react'
import { QueryResult } from '@/lib/datasource-types'

interface ColumnSpec { key: string; label?: string }
interface Props {
  data: any[]
  loading?: boolean
  columns?: ColumnSpec[]
  pageSize?: number
  onRowSelect?: (row:any)=>void
  emptyMessage?: string
}

export const TableDataView: React.FC<Props> = ({ data, loading, columns, pageSize = 25, onRowSelect, emptyMessage = 'No data' }) => {
  const [page, setPage] = React.useState(0)
  const derivedCols = React.useMemo(() => {
    if (columns?.length) return columns
    const first = data[0]
    if (!first) return []
    return Object.keys(first).slice(0,20).map(k => ({ key: k, label: k }))
  }, [columns, data])
  const start = page * pageSize
  const pageRows = data.slice(start, start + pageSize)
  const totalPages = Math.ceil(data.length / pageSize) || 1
  React.useEffect(()=>{ if (page >= totalPages) setPage(0) }, [totalPages, page])
  return (
    <div className="border rounded bg-white text-xs">
      <div className="overflow-auto max-h-96">
        <table className="min-w-full border-collapse">
          <thead className="bg-neutral-50">
            <tr>
              {derivedCols.map(c => <th key={c.key} className="text-left px-2 py-1 border-b font-medium">{c.label || c.key}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-2 py-2 text-neutral-500" colSpan={derivedCols.length || 1}>Loading...</td></tr>
            )}
            {!loading && pageRows.length === 0 && (
              <tr><td className="px-2 py-2 text-neutral-500" colSpan={derivedCols.length || 1}>{emptyMessage}</td></tr>
            )}
            {!loading && pageRows.map((r,i) => (
              <tr key={i} className="hover:bg-emerald-50 cursor-pointer" onClick={()=>onRowSelect?.(r)}>
                {derivedCols.map(c => <td key={c.key} className="px-2 py-1 border-t align-top">{formatVal((r as any)[c.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-2 py-1 border-t bg-neutral-50">
        <div>Rows: {data.length}</div>
        <div className="flex items-center gap-2">
          <button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} className="px-2 py-0.5 border rounded disabled:opacity-40">Prev</button>
          <span>{page+1}/{totalPages}</span>
          <button disabled={page+1>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} className="px-2 py-0.5 border rounded disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  )
}

function formatVal(v:any) {
  if (v == null) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
