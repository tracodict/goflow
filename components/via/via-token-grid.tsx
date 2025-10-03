"use client"
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import AgGridWrapper from '@/components/ui/ag-grid-wrapper'
import { Hand, Loader2 } from 'lucide-react'
// Replaced dropdown menu with lightweight custom hover menu for stability
import { fetchPreSupportedSchema } from '@/components/petri/pre-supported-schemas'
import { queryTokens, tokensEnabled, fireTokenTransition } from '@/components/petri/petri-client'
import { DynamicForm, inferPrimitiveSchema } from '@/components/run/forms/dynamic-form'

interface TokenRow { id: string; caseId: string; placeId: string; value: any; timestamp?: number; color?: string }

async function fetchTokensForColor(baseUrl: string, color: string): Promise<TokenRow[]> {
  try {
    // Server expects { status: 'LIVE', color: '<COLOR>', limit: N }
    const data = await queryTokens(baseUrl, { status: 'LIVE', color, limit: 50 })
    const items = data?.data?.items || data?.data || []
    return Array.isArray(items) ? items.map((t: any, i: number) => ({ id: t.id || `${i}-${t.placeId}-${t.caseId}`, caseId: t.caseId, placeId: t.placeId, value: t.value, timestamp: t.timestamp, color: t.color || color })) : []
  } catch (e) { /* eslint-disable no-console */ console.warn('fetchTokensForColor failed', e); return [] }
}

async function fetchEnabledTransitionsRow(baseUrl: string, row: TokenRow): Promise<any[]> {
  try {
    const data = await tokensEnabled(baseUrl, { caseId: row.caseId, tokens: [{ placeId: row.placeId, value: row.value }] })
    const r = data?.data?.results?.[0]
    // Support both legacy planned 'enabledTransitions' and current 'transitions'
    return r?.enabledTransitions || r?.transitions || []
  } catch (e) { /* eslint-disable no-console */ console.warn('tokensEnabled failed', e); return [] }
}

export const ViaTokenGrid: React.FC<{ baseUrl: string; color: string; dictionaryUrl: string }> = ({ baseUrl, color, dictionaryUrl }) => {
  const [rows, setRows] = useState<TokenRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMenu, setActionMenu] = useState<{ row: TokenRow; x: number; y: number } | null>(null)
  const [enabled, setEnabled] = useState<any[]>([])
  const [inspectRow, setInspectRow] = useState<TokenRow | null>(null)
  const [inspectSchema, setInspectSchema] = useState<any>(null)
  const [inspectFormData, setInspectFormData] = useState<any>({})
  const [inspectMax, setInspectMax] = useState(false)
  const [inspectDims, setInspectDims] = useState<{ width: number; height: number }>({ width: 520, height: 520 })
  const resizingRef = useRef(false)
  const [fireInfo, setFireInfo] = useState<{ row: TokenRow; transitionId: string } | null>(null)
  const [fireMax, setFireMax] = useState(false)
  const [fireDims, setFireDims] = useState<{ width: number; height: number }>({ width: 640, height: 520 })
  const fireResizingRef = useRef(false)
  const [formSchema, setFormSchema] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  // Schema-derived dynamic top-level property columns for token value (object)
  const [valueProps, setValueProps] = useState<string[]>([])
  const schemaInitRef = useRef<{ color: string } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      const list = await fetchTokensForColor(baseUrl, color)
      if (!cancelled) { setRows(list); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [baseUrl, color])

  // Reset derived props when color changes
  useEffect(() => { setValueProps([]); schemaInitRef.current = null }, [color])

  // Derive schema property columns: try pre-supported schema first, else infer from first row's value
  useEffect(() => {
    if (!rows.length) return
    if (valueProps.length) return
    let active = true
    ;(async () => {
      let props: string[] = []
      try {
        const schema = await fetchPreSupportedSchema(color, dictionaryUrl)
        if (schema && schema.type === 'object' && schema.properties && typeof schema.properties === 'object') {
          props = Object.keys(schema.properties)
        } else {
          const sample = rows[0].value
          if (sample && typeof sample === 'object' && !Array.isArray(sample)) {
            props = Object.keys(sample)
          }
        }
      } catch {/* ignore */}
      if (active && props.length) {
        // Limit to first 20 columns for usability
        setValueProps(props.slice(0, 20))
      }
    })()
    return () => { active = false }
  }, [rows, color, dictionaryUrl, valueProps.length])

  const columnDefs = useMemo<any[]>(() => {
    const base: any[] = [
      { headerName: 'Case', field: 'caseId' as keyof TokenRow, flex: 1, sortable: true, filter: true },
      { headerName: 'Place', field: 'placeId' as keyof TokenRow, flex: 1, sortable: true, filter: true },
    ]
    // Dynamic value property columns
    valueProps.forEach(prop => {
      base.push({
        headerName: prop,
        field: undefined,
        flex: 1,
        sortable: true,
        filter: true,
        valueGetter: (p: any) => {
          const v = p.data?.value
          if (v && typeof v === 'object' && !Array.isArray(v)) return v[prop]
          return undefined
        },
        cellRenderer: (p: any) => {
          const val = p.value
          if (val == null) return ''
          if (typeof val === 'object') return JSON.stringify(val)
          return String(val)
        }
      })
    })
    base.push({
      headerName: 'Value', field: 'value' as keyof TokenRow, flex: 1, cellRenderer: (p: any) => typeof p.value === 'object' ? JSON.stringify(p.value) : String(p.value), sortable: true, filter: true
    })
    base.push({ headerName: '', field: undefined, width: 40, pinned: 'right', cellRenderer: (p: any) => {
      const r: TokenRow = p.data
      return (
        <div className="relative group flex items-center justify-center h-full">
          <button
            className="token-action-btn opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity inline-flex items-center justify-center h-6 w-6 rounded hover:bg-neutral-100"
            aria-label="Actions"
            onClick={(e)=> {
              e.preventDefault(); e.stopPropagation();
              const target = e.currentTarget as HTMLElement
              const rect = target.getBoundingClientRect()
              // Compute safe position (menu width ~ 220, height heuristic 200)
              let x = rect.right - 220
              let y = rect.bottom + 4
              if (x < 8) x = rect.left
              const vw = window.innerWidth; const vh = window.innerHeight
              if (x + 220 > vw - 4) x = vw - 224
              if (y + 260 > vh - 4) y = rect.top - 260
              setActionMenu({ row: r, x, y })
              fetchEnabledTransitionsRow(baseUrl, r).then(setEnabled)
            }}
            onKeyDown={(e)=> { if(e.key==='Enter' || e.key===' '){ e.preventDefault(); (e.currentTarget as any).click() } }}
          >
            <Hand className="h-4 w-4" />
          </button>
        </div>
      )
    } })
    return base
  }, [baseUrl, dictionaryUrl, enabled, valueProps])

  const closeActionMenu = useCallback(() => setActionMenu(null), [])

  useEffect(() => {
    if (!actionMenu) return
    const onScroll = () => closeActionMenu()
    const onResize = () => closeActionMenu()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeActionMenu() }
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) closeActionMenu()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick, true)
    }
  }, [actionMenu, closeActionMenu])

  const menuPortal = actionMenu ? createPortal(
    <div
      ref={menuRef}
      className="fixed z-[250] w-56 max-h-[60vh] overflow-auto rounded-md border bg-white shadow-lg text-xs py-1"
      style={{ left: actionMenu.x, top: actionMenu.y }}
      role="menu"
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-neutral-500">Actions</div>
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-neutral-100"
        onClick={()=> { setInspectRow(actionMenu.row); closeActionMenu() }}
      >Inspect</button>
      <div className="my-1 h-px bg-neutral-200" />
      {enabled.length === 0 && <div className="px-3 py-1 text-[10px] text-neutral-400">No transitions</div>}
      {enabled.map(tr => (
        <button
          key={tr.id || tr.transitionId}
          className="w-full text-left px-3 py-1.5 hover:bg-neutral-100"
          onClick={async () => {
            const name = tr.formSchema || tr.manual?.formSchema
            // Reset previous form state and seed with the row's current token value
            const rowValue = actionMenu.row.value
            setFormData(rowValue)
            setFormSchema(null)
            if (name) {
              const schema = await fetchPreSupportedSchema(name, dictionaryUrl)
              setFormSchema(schema || { type: 'object', properties: {} })
            } else {
              const v = actionMenu.row.value
              let schema: any = { type: 'string' }
              if (typeof v === 'number') schema = { type: Number.isInteger(v)?'integer':'number' }
              else if (typeof v === 'boolean') schema = { type: 'boolean' }
              else if (Array.isArray(v)) schema = { type: 'array' }
              else if (typeof v === 'object') schema = { type: 'object', properties: Object.keys(v||{}).reduce((acc,k)=>{acc[k]={type:typeof (v||{})[k]};return acc},{} as any) }
              setFormSchema(schema)
            }
            setFireInfo({ row: actionMenu.row, transitionId: tr.id || tr.transitionId })
            closeActionMenu()
          }}
        >{tr.name || tr.id || tr.transitionId}</button>
      ))}
      <div className="mt-1 pt-1 border-t flex">
        <button className="ml-auto text-[10px] px-2 py-1 hover:text-red-600" onClick={closeActionMenu}>Close</button>
      </div>
    </div>, document.body) : null

  // When inspectRow changes, build schema (pre-supported color schema first, else infer from value)
  useEffect(() => {
    let active = true
    if (!inspectRow) { setInspectSchema(null); setInspectFormData({}); return }
    ;(async () => {
      setInspectFormData(inspectRow.value)
      let schema: any = null
      try {
        const pre = await fetchPreSupportedSchema(color, dictionaryUrl)
        if (pre) schema = pre
      } catch { /* ignore */ }
      if (!schema) {
        const build = (val: any, depth: number = 0): any => {
          if (val == null) return { type: 'string' }
          if (Array.isArray(val)) return { type: 'array' }
          const t = typeof val
          if (t === 'number') return { type: Number.isInteger(val) ? 'integer' : 'number' }
          if (t === 'boolean') return { type: 'boolean' }
          if (t === 'object') {
            if (depth > 2) return { type: 'object' } // depth guard
            const props: any = {}
            Object.keys(val).forEach(k => {
              props[k] = build(val[k], depth + 1)
            })
            return { type: 'object', properties: props }
          }
          return { type: 'string' }
        }
        schema = build(inspectRow.value)
      }
      if (active) setInspectSchema(schema)
    })()
    return () => { active = false }
  }, [inspectRow, color, dictionaryUrl])

  return (
    <div className="h-full min-h-0 flex flex-col">
      {loading && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading tokens...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="p-4 bg-destructive/10 border-b flex items-center gap-2">
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}
      {!loading && !error && (
        <>
          {rows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <span className="text-sm">No tokens to display</span>
            </div>
          ) : (
            <>
              <AgGridWrapper
                rowData={rows}
                columnDefs={columnDefs}
                fullHeight
                rowHeight={28}
                headerHeight={30}
                theme="quartz"
              />
            </>
          )}
        </>
      )}
      {inspectRow && (
        <div
          className="fixed inset-0 z-[120] bg-black/30 flex items-center justify-center"
          onClick={()=>{ if(!resizingRef.current) setInspectRow(null) }}
        >
          <div
            className="bg-white rounded shadow-lg overflow-hidden text-xs flex flex-col"
            style={inspectMax ? { width: '90vw', height: '85vh' } : { width: inspectDims.width, height: inspectDims.height, maxWidth: '90vw', maxHeight: '85vh' }}
            onClick={e=>e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-neutral-50 select-none cursor-default">
              <div className="font-medium">Token Details</div>
              <span className="ml-auto text-[10px] text-neutral-500">Case: {inspectRow.caseId} · Place: {inspectRow.placeId}</span>
              <button
                className="text-[10px] px-2 py-1 border rounded hover:bg-neutral-100"
                onClick={()=> setInspectMax(m => !m)}
              >{inspectMax ? 'Restore' : 'Maximize'}</button>
              <button
                className="text-[10px] px-2 py-1 border rounded hover:bg-neutral-100"
                onClick={()=> setInspectRow(null)}
              >Close</button>
            </div>
            <div className="px-3 py-2 text-[10px] text-neutral-500 break-all">Token ID: {inspectRow.id}</div>
            <div className="px-3 pb-2 flex-1 min-h-0 overflow-auto">
              <div className="border rounded p-2 mb-3 bg-neutral-50/40">
                <div className="text-[10px] font-medium mb-1">Value (schema-driven)</div>
                <DynamicForm
                  schema={inspectSchema || { type: 'object', properties: {} }}
                  data={inspectFormData}
                  onChange={(d)=> setInspectFormData(d)}
                />
              </div>
              <details className="mb-3">
                <summary className="cursor-pointer text-[11px]">Raw JSON</summary>
                <pre className="text-[10px] whitespace-pre-wrap break-all mt-1">{JSON.stringify(inspectRow, null, 2)}</pre>
              </details>
            </div>
            {!inspectMax && (
              <div
                className="absolute bottom-1 right-1 h-3 w-3 cursor-se-resize bg-neutral-300 rounded-sm"
                onMouseDown={(e)=> {
                  e.preventDefault();
                  resizingRef.current = true
                  const startX = e.clientX; const startY = e.clientY
                  const startW = inspectDims.width; const startH = inspectDims.height
                  const move = (ev: MouseEvent) => {
                    const dw = ev.clientX - startX
                    const dh = ev.clientY - startY
                    setInspectDims({ width: Math.max(360, startW + dw), height: Math.max(320, startH + dh) })
                  }
                  const up = () => { resizingRef.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
                  window.addEventListener('mousemove', move)
                  window.addEventListener('mouseup', up)
                }}
                title="Resize"
              />
            )}
          </div>
        </div>
      )}
      {fireInfo && (
        <div className="fixed inset-0 z-[130] bg-black/30 flex items-center justify-center" onClick={()=>{ if(!fireResizingRef.current) setFireInfo(null) }}>
          <div
            className="bg-white rounded shadow-lg overflow-hidden text-xs flex flex-col"
            style={fireMax ? { width: '90vw', height: '85vh' } : { width: fireDims.width, height: fireDims.height, maxWidth: '90vw', maxHeight: '85vh' }}
            onClick={e=>e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-neutral-50 select-none cursor-default">
              <div className="font-medium">Fire Transition</div>
              <span className="ml-auto text-[10px] text-neutral-500">{fireInfo.row.caseId} · {fireInfo.row.placeId} · {fireInfo.transitionId}</span>
              <button
                className="text-[10px] px-2 py-1 border rounded hover:bg-neutral-100"
                onClick={()=> setFireMax(m => !m)}
              >{fireMax ? 'Restore' : 'Maximize'}</button>
              <button
                className="text-[10px] px-2 py-1 border rounded hover:bg-neutral-100"
                onClick={()=> setFireInfo(null)}
              >Close</button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3">
              <div className="mb-2 text-[10px] text-neutral-500">Provide input (if required) then Submit to fire transition.</div>
              <DynamicForm
                schema={formSchema || inferPrimitiveSchema(fireInfo.row.value)}
                data={formData}
                onChange={(d)=> setFormData(d)}
              />
            </div>
            <div className="px-3 py-2 border-t flex justify-end gap-2 bg-neutral-50">
              <button className="px-3 py-1.5 border rounded hover:bg-neutral-100" onClick={()=>setFireInfo(null)}>Close</button>
              <button className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500" onClick={async ()=>{ await fireTokenTransition(baseUrl, { caseId: fireInfo.row.caseId, transitionId: fireInfo.transitionId, tokenBinding: { placeId: fireInfo.row.placeId, value: fireInfo.row.value }, input: formData }); setFireInfo(null); fetchTokensForColor(baseUrl, color).then(setRows) }}>Submit</button>
            </div>
            {!fireMax && (
              <div
                className="absolute bottom-1 right-1 h-3 w-3 cursor-se-resize bg-neutral-300 rounded-sm"
                onMouseDown={(e)=> {
                  e.preventDefault();
                  fireResizingRef.current = true
                  const startX = e.clientX; const startY = e.clientY
                  const startW = fireDims.width; const startH = fireDims.height
                  const move = (ev: MouseEvent) => {
                    const dw = ev.clientX - startX
                    const dh = ev.clientY - startY
                    setFireDims({ width: Math.max(480, startW + dw), height: Math.max(360, startH + dh) })
                  }
                  const up = () => { fireResizingRef.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
                  window.addEventListener('mousemove', move)
                  window.addEventListener('mouseup', up)
                }}
                title="Resize"
              />
            )}
          </div>
        </div>
      )}
      {menuPortal}
    </div>
  )
}
