"use client"
import React, { useEffect, useState } from 'react'
import { MessageSquare, MessageSquareDot, Square, X, PanelLeftOpen, PanelLeftClose, Plus, RefreshCcw, LogOut, UserCircle2, Loader2, ClockArrowDown, ClockArrowUp } from 'lucide-react'
import { useSession } from '@/components/auth/session-context'
// JSON Forms imports (packages added in package.json). Types may be unresolved until install.
// @ts-ignore
import { JsonForms } from '@jsonforms/react'
// @ts-ignore
import { vanillaCells, vanillaRenderers } from '@jsonforms/vanilla-renderers'
// Shadcn/Radix based custom renderers
import { shadcnRenderers, shadcnCells } from '@/components/run/forms/renderers'
// @ts-ignore
import { rankWith, isStringControl, isNumberControl, isBooleanControl } from '@jsonforms/core'
import { fetchWorkflowList, fetchWorkflow, createCase, startCase, fetchCaseEnabledTransitions, fireCaseTransition, fetchCaseList, suspendCase, resumeCase, abortCase, deleteCase } from '@/components/petri/petri-client'
import type { PetriNodeData } from '@/lib/petri-types'
import type { Node } from '@xyflow/react'
import { DEFAULT_SETTINGS } from '@/components/petri/system-settings-context'
import { fetchPreSupportedSchema } from '@/components/petri/pre-supported-schemas'

// Minimal run view: shows floating button indicating if any transition enabled
export default function RunMain({ workflowId }: { workflowId: string | null }) {
  const [nodes, setNodes] = useState<Node<PetriNodeData>[]>([])
  const [wfTransitions, setWfTransitions] = useState<any[]>([])
  const [jsonSchemas, setJsonSchemas] = useState<{ name: string; schema: any }[]>([])
  const [workflows, setWorkflows] = useState<any[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false)
  const [cases, setCases] = useState<{ id: string; cpnId: string; name: string; description?: string; enabled: any[]; status?: string; createdAt?: string }[]>([])
  // Filter: show only RUNNING status when true
  const [showLive, setShowLive] = useState(true) // Live = not COMPLETED / ABORTED
  const [sortDesc, setSortDesc] = useState(true) // true => newest first
  const [openMenuCaseId, setOpenMenuCaseId] = useState<string | null>(null)
  // Close open case menu on outside click
  useEffect(() => {
    if (!openMenuCaseId) return
    function handleDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target) return
      if (target.closest('[data-case-menu="true"]')) return
      if (target.closest('[data-case-menu-trigger="true"]')) return
      setOpenMenuCaseId(null)
    }
    document.addEventListener('mousedown', handleDocClick)
    return () => document.removeEventListener('mousedown', handleDocClick)
  }, [openMenuCaseId])
  // Pagination state for infinite scroll
  const [caseTotal, setCaseTotal] = useState<number | null>(null)
  const [caseLoading, setCaseLoading] = useState(false)
  const [caseError, setCaseError] = useState<string | null>(null)
  const pageSize = 30
  const nextOffsetRef = React.useRef(0)
  const reachedEnd = caseTotal != null && cases.length >= caseTotal
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null)
  // Mutable ref to always access latest cases inside stable callbacks
  const casesRef = React.useRef(cases)
  useEffect(() => { casesRef.current = cases }, [cases])
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const hideTimerRef = React.useRef<any>(null)
  const [hoverTransitionId, setHoverTransitionId] = useState<string | null>(null)
  const bindingHideTimerRef = React.useRef<any>(null)
  const [hoveredBindingIndex, setHoveredBindingIndex] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formSchema, setFormSchema] = useState<any>(null)
  const [formUiSchema, setFormUiSchema] = useState<any>(null)
  const [formData, setFormData] = useState<any>(null)
  const [formTitle, setFormTitle] = useState<string>('Manual Task')
  const [formTransitionId, setFormTransitionId] = useState<string | null>(null)
  const [formBindingIndex, setFormBindingIndex] = useState<number>(0)
  // Removed dropdown user menu; simple inline logout button now.
  const userMenuRef = React.useRef<HTMLDivElement | null>(null)

  // User menu dropdown removed; no outside click logic needed.
  // Effective (frozen) schema determined once when form opens (avoid re-inferring on each keystroke)
  const [effectiveSchema, setEffectiveSchema] = useState<any>(null)
  // Resolve flowServiceUrl with fallbacks: env -> global -> persisted settings -> default
  const flowServiceUrl = process.env.NEXT_PUBLIC_FLOW_SERVICE_URL
    || (typeof window !== 'undefined' ? (window as any).__goflowServiceBase : undefined)
    || (typeof window !== 'undefined'
        ? (() => {
            try {
              const raw = window.localStorage.getItem('goflow.systemSettings')
              if (raw) {
                const parsed = JSON.parse(raw)
                if (parsed && typeof parsed.flowServiceUrl === 'string' && parsed.flowServiceUrl.trim()) {
                  return parsed.flowServiceUrl as string
                }
              }
            } catch {/* ignore */}
            return DEFAULT_SETTINGS.flowServiceUrl
          })()
        : undefined)

  // Case-based polling of enabled transitions (simple interval)
  const [enabled, setEnabled] = useState<any[]>([])
  const refresh = React.useCallback(async () => {
    if (!flowServiceUrl || !activeCaseId) return
    const currentCase = casesRef.current.find(c => c.id === activeCaseId)
  if (currentCase?.status !== 'RUNNING') return
    try {
      const data = await fetchCaseEnabledTransitions(flowServiceUrl, activeCaseId)
      const list = Array.isArray(data) ? data : (data?.data || [])
      setEnabled(list)
      setCases(cs => cs.map(c => c.id === activeCaseId ? { ...c, enabled: list } : c))
    } catch {/* ignore */}
  }, [flowServiceUrl, activeCaseId])

  // Fetch workflow definition for currently selected case's cpn
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!flowServiceUrl) return
      const cpn = activeCaseId ? casesRef.current.find(c => c.id === activeCaseId)?.cpnId : workflowId
      if (!cpn) return
      try {
        const resp: any = await fetchWorkflow(flowServiceUrl, cpn)
        const data = resp?.data || resp
        if (!cancelled && data) {
          setWfTransitions(Array.isArray(data.transitions) ? data.transitions : [])
          setJsonSchemas(Array.isArray(data.jsonSchemas) ? data.jsonSchemas : [])
        }
      } catch {/* ignore */}
    }
    load()
    return () => { cancelled = true }
    // Only refetch when identifiers change, not on every cases mutation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCaseId, workflowId, flowServiceUrl])

  // Load workflow list for picker
  useEffect(() => {
    if (!flowServiceUrl) return
    fetchWorkflowList(flowServiceUrl).then(res => {
      const arr = res?.cpns || res?.data?.cpns || []
      setWorkflows(arr)
    }).catch(()=>{})
  }, [flowServiceUrl])

  // Poll enabled transitions for active case
  useEffect(() => {
    if (!activeCaseId) return
    refresh()
    const id = setInterval(() => refresh(), 4000)
    return () => clearInterval(id)
  }, [activeCaseId, refresh])

  // Initial load of first page of cases (legacy auto-seed removed for clarity)
  useEffect(() => {
    if (!flowServiceUrl) return
    nextOffsetRef.current = 0
    setCases([])
    setCaseTotal(null)
    setCaseError(null)
    const load = async () => {
      setCaseLoading(true)
      try {
        const resp: any = await fetchCaseList(flowServiceUrl, { offset: nextOffsetRef.current, limit: pageSize })
        const list = resp?.data?.cases || resp?.data || resp?.cases || []
        const total = resp?.data?.total ?? resp?.total ?? null
  const mapped = list.map((c: any) => ({ id: c.id, cpnId: c.cpnId, name: c.name || c.id, description: c.description, enabled: [], status: c.status || 'ACTIVE', createdAt: c.createdAt }))
        setCases(mapped)
        if (total != null) setCaseTotal(total)
        nextOffsetRef.current += mapped.length
        if (!activeCaseId && mapped[0]?.id) setActiveCaseId(mapped[0].id)
      } catch (e:any) {
        setCaseError(e?.message || 'Failed to load cases')
      } finally {
        setCaseLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowServiceUrl])

  const loadMoreCases = React.useCallback(async () => {
    if (caseLoading || reachedEnd || !flowServiceUrl) return
    setCaseLoading(true)
    setCaseError(null)
    try {
      const resp: any = await fetchCaseList(flowServiceUrl, { offset: nextOffsetRef.current, limit: pageSize })
      const list = resp?.data?.cases || resp?.data || resp?.cases || []
      const total = resp?.data?.total ?? resp?.total ?? null
  const mapped = list.map((c: any) => ({ id: c.id, cpnId: c.cpnId, name: c.name || c.id, description: c.description, enabled: [], status: c.status || 'ACTIVE', createdAt: c.createdAt }))
      setCases(cs => [...cs, ...mapped])
      if (total != null) setCaseTotal(total)
      nextOffsetRef.current += mapped.length
    } catch (e:any) {
      setCaseError(e?.message || 'Failed to load more cases')
    } finally {
      setCaseLoading(false)
    }
  }, [caseLoading, reachedEnd, flowServiceUrl])

  // Intersection observer to auto-load more
  useEffect(() => {
    if (!loadMoreRef.current) return
    const el = loadMoreRef.current
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadMoreCases()
        }
      })
    }, { root: el.parentElement, rootMargin: '0px', threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMoreCases])

  const activeCase = React.useMemo(() => cases.find(c => c.id === activeCaseId), [cases, activeCaseId])
  const caseCompleted = activeCase?.status === 'COMPLETED'
  const anyEnabled = enabled.length > 0

  // Close enabled transitions menu when none enabled and not completed
  useEffect(() => {
    if (!anyEnabled && !caseCompleted) setMenuOpen(false)
  }, [anyEnabled, caseCompleted])

  function getTransitionDef(t: any) {
    const tid = t.id || t.transitionId
    return wfTransitions.find(x => x.id === tid || x.transitionId === tid)
  }

  // Determine dictionaryUrl similarly to flowServiceUrl (persisted settings / defaults)
  const dictionaryUrl = (typeof window !== 'undefined'
    ? (() => {
        try {
          const raw = window.localStorage.getItem('goflow.systemSettings')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed.dictionaryUrl === 'string' && parsed.dictionaryUrl.trim()) return parsed.dictionaryUrl as string
          }
        } catch {/* ignore */}
        return DEFAULT_SETTINGS.dictionaryUrl
      })()
    : DEFAULT_SETTINGS.dictionaryUrl)

  function getSchemaForTransition(t: any) {
    const def = getTransitionDef(t)
    const formSchemaName = def?.formSchema || def?.manual?.formSchema
    const layoutSchemaRaw = def?.manual?.layoutSchema || def?.layoutSchema
    if (!formSchemaName) return { name: undefined, schema: null, ui: layoutSchemaRaw ? safeParse(layoutSchemaRaw) : null }
    // Prefer workflow-embedded schema if present (explicit inclusion), otherwise null placeholder; actual body may be CDN-fetched later
    const found = jsonSchemas.find(s => s.name === formSchemaName)
    return found ? { name: formSchemaName, schema: found.schema, ui: layoutSchemaRaw ? safeParse(layoutSchemaRaw) : null } : { name: formSchemaName, schema: null, ui: layoutSchemaRaw ? safeParse(layoutSchemaRaw) : null }
  }

  const safeParse = (txt: string) => { try { return JSON.parse(txt) } catch { return null } }

  function inferSchemaFromData(sample: any): any {
    if (sample == null) return { type: 'string' }
    if (typeof sample === 'string') {
      // Infer date format yyyy-mm-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(sample)) return { type: 'string', format: 'date' }
      return { type: 'string' }
    }
    if (typeof sample === 'number') return { type: Number.isInteger(sample) ? 'integer' : 'number' }
    if (typeof sample === 'boolean') return { type: 'boolean' }
    if (Array.isArray(sample)) {
      const first = sample[0]
      return { type: 'array', items: inferSchemaFromData(first) }
    }
    if (typeof sample === 'object') {
      const props: Record<string, any> = {}
      Object.entries(sample).forEach(([k, v]) => { props[k] = inferSchemaFromData(v) })
      return { type: 'object', properties: props }
    }
    return { type: 'string' }
  }

  const bindingsForHover = React.useMemo(() => {
    if (!hoverTransitionId) return [] as any[]
    const t = enabled.find(et => (et.id || et.transitionId) === hoverTransitionId)
    if (!t) return []
    return Array.isArray(t.bindings) ? t.bindings : []
  }, [hoverTransitionId, enabled])

  const handleClickBinding = (transition: any, binding: any, index: number) => {
  const schemaInfo = getSchemaForTransition(transition)
  setFormSchema(schemaInfo?.schema || null)
    setFormUiSchema(schemaInfo?.ui || null)
    // Binding shape: { variableName: value } – extract the value
    let value = binding
    let variableName: string | undefined
    if (binding && typeof binding === 'object' && !Array.isArray(binding)) {
      const keys = Object.keys(binding)
      if (keys.length === 1) {
        variableName = keys[0]
        value = (binding as any)[keys[0]]
      }
    }
  setFormData(value);
    // Determine and freeze schema once
    // If formSchema name exists and no embedded schema body, fetch from CDN (pre-supported) and override inference.
  (async () => {
      let eff = schemaInfo?.schema
      const name = schemaInfo?.name
      if (!eff && name) {
        const fetched = await fetchPreSupportedSchema(name, dictionaryUrl)
        if (fetched) eff = fetched
      }
      if (!eff) {
        // Fallback inference ONLY when no pre-supported schema found
        if (value === null) eff = { type: 'string' }
        else if (value === undefined) eff = { type: 'object', properties: {} }
        else eff = inferSchemaFromData(value)
      }
      setEffectiveSchema(eff)
    })()
    setFormTitle((transition.name || transition.id || 'Manual Task') + (variableName ? ` – ${variableName}` : ''))
  setFormOpen(true)
  setFormTransitionId(transition.id || transition.transitionId)
  setFormBindingIndex(index)
    setMenuOpen(false)
    setHoverTransitionId(null)
  }

  // Reset frozen schema when form closes
  useEffect(() => {
    if (!formOpen) {
      setEffectiveSchema(null)
    }
  }, [formOpen])

  const { session: userSession, loading: sessionLoading, refresh: refreshSession } = useSession()
  const primaryRole = (userSession?.roles || [])[0]

  // Robust logout handler
  // Removed handleLogout; using plain anchor to /api/logout ensures navigation always fires.

  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col">
      {/* Top header bar */}
  <div className="flex items-center justify-between h-10 border-b bg-white/80 backdrop-blur px-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-7 w-7 inline-flex items-center justify-center rounded border bg-white hover:bg-neutral-50"
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >{sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}</button>
          <span className="font-medium">Run Mode</span>
          {activeCaseId && <span className="text-neutral-500">Case: {cases.find(c=>c.id===activeCaseId)?.name || activeCaseId}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => refresh()} className="h-7 w-7 inline-flex items-center justify-center rounded border bg-white hover:bg-neutral-50" title="Refresh transitions"><RefreshCcw className="h-4 w-4" /></button>
          <div className="flex items-center gap-2 pl-2 pr-2 h-8 rounded-full border bg-white" ref={userMenuRef}>
            {sessionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCircle2 className="h-5 w-5 text-neutral-600" />}
            <span className="hidden sm:inline truncate max-w-[8rem]" title={userSession?.email}>{userSession?.name || 'Guest'}{primaryRole ? ` (${primaryRole})` : ''}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const ret = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '/')
              if (typeof window !== 'undefined') window.location.href = `/api/logout?return=${ret}`
            }}
            className="h-8 px-3 inline-flex items-center gap-1 rounded border bg-white hover:bg-neutral-50 text-xs"
            title="Logout"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-64 border-r flex flex-col bg-white">
            <div className="flex items-center gap-2 h-9 px-2 border-b text-xs font-medium">
              <span>Cases</span>
              <label className="flex items-center gap-1 text-[10px] font-normal cursor-pointer select-none" title="Toggle to show only live (not completed / aborted) cases">
                <input
                  type="checkbox"
                  className="h-3 w-3 cursor-pointer"
                  checked={showLive}
                  onChange={e => setShowLive(e.target.checked)}
                />
                <span>Live</span>
              </label>
              <button type="button" onClick={() => setSortDesc(s => !s)} className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded border bg-white hover:bg-neutral-50" title={sortDesc ? 'CreatedAt desc (newest first) – click for asc' : 'CreatedAt asc (oldest first) – click for desc'}>
                {sortDesc ? <ClockArrowDown className="h-4 w-4" /> : <ClockArrowUp className="h-4 w-4" />}
              </button>
              <button type="button" className="h-7 w-7 inline-flex items-center justify-center rounded border bg-white hover:bg-neutral-50" title="Create case" onClick={() => setShowWorkflowPicker(v=>!v)}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1 text-xs relative">
              {(() => {
                let visibleCases = showLive ? cases.filter(c => c.status !== 'COMPLETED' && c.status !== 'ABORTED') : [...cases]
                // Sort by createdAt (desc when sortDesc) fallback id
                const parseTime = (c: any) => {
                  if (c.createdAt) {
                    const t = Date.parse(c.createdAt)
                    if (!Number.isNaN(t)) return t
                  }
                  // fallback: derive numeric from id hash-ish
                  return 0
                }
                visibleCases.sort((a,b) => {
                  const ta = parseTime(a)
                  const tb = parseTime(b)
                  if (ta !== tb) return sortDesc ? tb - ta : ta - tb
                  return sortDesc ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id)
                })
                return visibleCases.map(c => {
                const enabledCount = c.enabled?.length || 0
                return (
                  <div key={c.id} className={`group relative border rounded px-2 py-1 cursor-pointer ${c.id===activeCaseId ? 'bg-emerald-50 border-emerald-300' : 'bg-white hover:bg-neutral-50'}`}>
                    <div className="flex items-center gap-1" onClick={() => { setActiveCaseId(c.id); setMenuOpen(false) }}>
                      <input
                        className="flex-1 bg-transparent outline-none text-xs font-medium"
                        value={c.name}
                        onChange={e => setCases(cs => cs.map(x => x.id===c.id ? { ...x, name: e.target.value } : x))}
                      />
                      <span className={(() => {
                        switch(c.status){
                          case 'RUNNING': return 'text-[9px] px-1 rounded text-emerald-700 font-semibold'
                          case 'SUSPENDED': return 'text-[9px] px-1 rounded text-amber-700 italic'
                          case 'COMPLETED': return 'text-[9px] px-1 rounded text-neutral-500 line-through'
                          case 'ABORTED': return 'text-[9px] px-1 rounded text-red-600 italic'
                          default: return 'text-[9px] px-1 rounded text-neutral-500'
                        }
                      })()} title={c.status}>{c.status || ''}</span>
                      {enabledCount>0 && <span className="text-[9px] text-emerald-600" title={`${enabledCount} enabled transitions`}>{enabledCount}</span>}
                      <button
                        type="button"
                        className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-neutral-100"
                        data-case-menu-trigger="true"
                        onClick={(e) => { e.stopPropagation(); setOpenMenuCaseId(id => id === c.id ? null : c.id) }}
                        title="Actions"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1"/><circle cx="10" cy="10" r="1"/><circle cx="16" cy="10" r="1"/></svg>
                      </button>
                    </div>
                    <div className="text-[10px] text-neutral-400 truncate pr-6">{c.cpnId}</div>
                    {openMenuCaseId === c.id && (
                      <div className="absolute top-1 right-1 z-10 w-40 rounded border bg-white shadow-lg p-1 text-[11px]" data-case-menu="true" onClick={e => e.stopPropagation()}>
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50" onClick={async () => { if(!flowServiceUrl)return; try { await startCase(flowServiceUrl, c.id); setCases(cs=>cs.map(x=>x.id===c.id?{...x,status:'RUNNING'}:x)) } catch{} setOpenMenuCaseId(null) }}>Start</button>
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50" onClick={async () => { if(!flowServiceUrl)return; try { await suspendCase(flowServiceUrl, c.id); setCases(cs=>cs.map(x=>x.id===c.id?{...x,status:'SUSPENDED'}:x)) } catch{} setOpenMenuCaseId(null) }}>Suspend</button>
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50" onClick={async () => { if(!flowServiceUrl)return; try { await resumeCase(flowServiceUrl, c.id); setCases(cs=>cs.map(x=>x.id===c.id?{...x,status:'RUNNING'}:x)) } catch{} setOpenMenuCaseId(null) }}>Resume</button>
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50 text-red-600" onClick={async () => { if(!flowServiceUrl)return; try { await abortCase(flowServiceUrl, c.id); setCases(cs=>cs.map(x=>x.id===c.id?{...x,status:'ABORTED'}:x)) } catch{} setOpenMenuCaseId(null) }}>Abort</button>
                        <div className="h-px bg-neutral-200 my-1" />
                        <button className="w-full text-left px-2 py-1 rounded hover:bg-red-50 text-red-700" onClick={async () => { if(!flowServiceUrl)return; try { await deleteCase(flowServiceUrl, c.id); setCases(cs=>cs.filter(x=>x.id!==c.id)); if(activeCaseId===c.id) setActiveCaseId(null) } catch{} setOpenMenuCaseId(null) }}>Delete</button>
                      </div>
                    )}
                  </div>
                )
                })
              })()}
              {caseLoading && cases.length===0 && <div className="text-neutral-400 text-[11px]">Loading cases...</div>}
              {caseError && cases.length===0 && <div className="text-red-500 text-[11px]">{caseError}</div>}
              {!caseLoading && !caseError && cases.length===0 && <div className="text-neutral-400 text-[11px]">No cases</div>}
              {/* Load more sentinel */}
              <div ref={loadMoreRef} className="h-8 flex items-center justify-center text-[10px] text-neutral-400">
                {reachedEnd ? (cases.length>0 ? 'No more cases' : null) : (caseLoading ? 'Loading…' : (cases.length>0 ? 'Scroll to load more' : null))}
              </div>
              {caseError && cases.length>0 && <div className="sticky bottom-0 bg-white p-1 text-[10px] text-red-600 border rounded">{caseError} <button className="underline" onClick={()=>loadMoreCases()}>Retry</button></div>}
            </div>
          </div>
        )}
        {/* Main panel */}
        <div className="relative flex-1">
          {/* Background placeholder */}
          <div className="absolute inset-0 flex items-center justify-center text-neutral-300 text-sm select-none pointer-events-none">
            {activeCaseId ? `Active case: ${cases.find(c=>c.id===activeCaseId)?.name}` : 'No case selected'}
          </div>
          {/* Floating enabled transitions button (hidden if none and not completed) */}
      {(anyEnabled || caseCompleted) && (
        <div
          className="fixed right-4 bottom-4 z-50"
          onMouseEnter={() => {
            if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
            if (enabled.length) setMenuOpen(true)
          }}
          onMouseLeave={() => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
            hideTimerRef.current = setTimeout(() => setMenuOpen(false), 2000)
          }}
        >
          <button
            type="button"
            onClick={() => refresh()}
            title={caseCompleted ? 'Case completed' : (anyEnabled ? 'Enabled transitions available – click to refresh' : 'No transitions enabled – click to refresh')}
            className="group inline-flex h-12 w-12 items-center justify-center rounded-full border bg-white shadow-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {caseCompleted ? <Square className="h-6 w-6 text-emerald-600" /> : (anyEnabled ? <MessageSquareDot className="h-6 w-6 text-emerald-600" /> : <MessageSquare className="h-6 w-6 text-neutral-500" />)}
          </button>
          {menuOpen && enabled.length > 0 && (
          <>
            <div
              className="absolute bottom-14 right-0 w-60 max-h-72 overflow-auto rounded-md border bg-white shadow-lg p-1 text-xs"
              onMouseEnter={() => {
                if (bindingHideTimerRef.current) { clearTimeout(bindingHideTimerRef.current); bindingHideTimerRef.current = null }
              }}
              onMouseLeave={() => {
                if (bindingHideTimerRef.current) clearTimeout(bindingHideTimerRef.current)
                bindingHideTimerRef.current = setTimeout(() => { setHoverTransitionId(null); setHoveredBindingIndex(null) }, 2000)
              }}
            >
              <div className="mb-1 px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-500">Enabled Transitions</div>
              {enabled.map(m => {
                const def = getTransitionDef(m)
                const schemaName = def?.formSchema || def?.manual?.formSchema || ''
                const isHover = (m.id || m.transitionId) === hoverTransitionId
                return (
                  <div
                    key={m.id || m.transitionId}
                    className={`group rounded px-2 py-1 cursor-pointer ${isHover ? 'bg-neutral-50' : 'hover:bg-neutral-50'}`}
                    onMouseEnter={() => setHoverTransitionId(m.id || m.transitionId)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-1 truncate" title={m.name || (m.data?.name)}>
                        {(m.data?.name) || m.name || (m.id || m.transitionId)}
                      </span>
                      {schemaName && <span className="text-[9px] text-neutral-400" title={schemaName}>{schemaName}</span>}
                      {Array.isArray(m.bindings) && m.bindings.length > 0 && (
                        <span className="text-[9px] text-emerald-600" title={`${m.bindings.length} binding(s)`}>{m.bindings.length}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              {!enabled.length && <div className="px-2 py-1 text-neutral-400">None</div>}
            </div>
            {hoverTransitionId && bindingsForHover.length > 0 && (
              <div
                className="absolute bottom-14 right-[15.5rem] max-h-72 text-xs"
                onMouseEnter={() => {
                  if (bindingHideTimerRef.current) { clearTimeout(bindingHideTimerRef.current); bindingHideTimerRef.current = null }
                }}
                onMouseLeave={() => {
                  if (bindingHideTimerRef.current) clearTimeout(bindingHideTimerRef.current)
                  bindingHideTimerRef.current = setTimeout(() => { setHoverTransitionId(null); setHoveredBindingIndex(null) }, 2000)
                }}
              >
                <div className="relative">
                  <div className="w-64 overflow-auto rounded-md border bg-white shadow-lg p-1">
                    <div className="mb-1 px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-500">Bindings</div>
                    {bindingsForHover.map((b: any, i: number) => {
                      const transition = enabled.find(t => (t.id || t.transitionId) === hoverTransitionId)
                      const isHover = hoveredBindingIndex === i
                      return (
                        <button
                          key={i}
                          onClick={() => transition && handleClickBinding(transition, b, i)}
                          onMouseEnter={() => setHoveredBindingIndex(i)}
                          onMouseLeave={() => setHoveredBindingIndex(prev => prev === i ? null : prev)}
                          className={`flex w-full items-start gap-2 rounded px-2 py-1 text-left ${isHover ? 'bg-neutral-50' : 'hover:bg-neutral-50'}`}
                          title={typeof b === 'object' ? JSON.stringify(b) : String(b)}
                        >
                          <span className="flex-1 truncate">
                            {typeof b === 'object'
                              ? Object.keys(b).slice(0,2).map(k => `${k}: ${typeof (b as any)[k] === 'object' ? '[obj]' : String((b as any)[k])}`).join(', ')
                              : String(b)}
                          </span>
                          <span className="text-[9px] text-neutral-400">#{i+1}</span>
                        </button>
                      )
                    })}
                    {!bindingsForHover.length && <div className="px-2 py-1 text-neutral-400">None</div>}
                  </div>
                  {hoveredBindingIndex !== null && bindingsForHover[hoveredBindingIndex] && typeof bindingsForHover[hoveredBindingIndex] === 'object' && (
                    <div className="absolute top-2 left-[-17rem] w-64 max-h-60 overflow-auto rounded-md border bg-white shadow-lg p-2 text-[11px] leading-snug whitespace-pre-wrap font-mono">
                      {(() => {
                        try { return JSON.stringify(bindingsForHover[hoveredBindingIndex], null, 2) } catch { return String(bindingsForHover[hoveredBindingIndex]) }
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}
          {showWorkflowPicker && (
            <div className="absolute inset-x-0 bottom-0 max-h-[55%] bg-white border-t rounded-t-lg shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b text-xs font-medium">
                <span>Select Workflow</span>
                <button type="button" onClick={()=>setShowWorkflowPicker(false)} className="h-7 w-7 inline-flex items-center justify-center rounded border bg-white hover:bg-neutral-50" aria-label="Close picker"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 overflow-auto text-xs">
                {workflows.map(w => (
                  <button
                    key={w.id}
                    className="border rounded p-2 text-left hover:border-emerald-500 hover:shadow-sm bg-white"
                    onClick={async () => {
                      if (!flowServiceUrl || !w.id) return
                      const suffix = Math.random().toString(36).slice(2,5)
                      const caseId = `${w.id}-case-${suffix}`
                      try {
                        const createResp: any = await createCase(flowServiceUrl, { id: caseId, cpnId: w.id, name: `${w.name || w.id}#${suffix}`, description: w.description })
                        const startResp: any = await startCase(flowServiceUrl, caseId)
                        const status = startResp?.data?.status || startResp?.status || createResp?.data?.status || 'RUNNING'
                        setCases(cs => [...cs, { id: caseId, cpnId: w.id, name: `${w.name || w.id}#${suffix}`, description: w.description, enabled: [], status }])
                        setActiveCaseId(caseId)
                        setShowWorkflowPicker(false)
                      } catch {/* ignore */}
                    }}
                  >
                    <div className="font-medium truncate mb-1">{w.name || w.id}</div>
                    <div className="text-[10px] text-neutral-500 line-clamp-3 min-h-[2.4em]">{w.description || 'No description'}</div>
                  </button>
                ))}
                {!workflows.length && <div className="col-span-full text-neutral-400">No workflows</div>}
              </div>
            </div>
          )}
          {formOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white/95 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b px-4 py-2 bg-white/80">
            <h2 className="text-sm font-medium truncate pr-4">{formTitle}</h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <JsonForms
              schema={effectiveSchema || formSchema || { type: 'string' }}
              uischema={(formUiSchema || (() => {
                // Auto-generate responsive grid layout when schema is object
                const s = effectiveSchema || formSchema
                if (s && s.type === 'object' && s.properties) {
                    const elements = Object.keys(s.properties).map(k => {
                      const prop: any = s.properties[k]
                      const isArray = prop?.type === 'array'
                      const isDate = (prop?.type === 'string' && (prop?.format === 'date'))
                      const isObject = prop?.type === 'object'
                      return {
                        type: 'Control',
                        scope: `#/properties/${k}`,
                        options: {
                          ...(isDate ? { date: true } : {}),
                          ...(isArray ? { fullWidth: true } : {}),
                          ...(isObject ? { fullWidth: true, lazyObject: true } : {})
                        }
                      }
                    })
                  return { type: 'VerticalLayout', options: { grid: 'responsive', columns: { sm:1, md:3, lg:5 } }, elements }
                }
                // Fallback: simple control
                if (s && s.type !== 'object') return { type: 'Control', scope: '#' }
                return undefined
              })()) as any}
              data={formData ?? {}}
              // Prefer custom shadcn renderers first, then fallback to vanilla
              renderers={[...shadcnRenderers, ...vanillaRenderers]}
              cells={[...shadcnCells, ...vanillaCells]}
              onChange={(ev: any) => setFormData(ev.data)}
            />
            {!formSchema && !formUiSchema && <p className="mt-4 text-[11px] text-neutral-500">Schema & responsive layout inferred (1 / 3 / 5 columns). Supply layoutSchema to override (options.columns {`{ sm, md, lg }`} or per-element options.span).</p>}
          </div>
          <div className="border-t px-4 py-2 flex justify-end gap-2 bg-white/80">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-3 py-1.5 text-xs rounded border hover:bg-neutral-50"
            >Cancel</button>
            <button
              type="button"
              onClick={async () => {
                if (flowServiceUrl && activeCaseId && formTransitionId != null) {
                  try {
                    const resp = await fireCaseTransition(flowServiceUrl, activeCaseId, formTransitionId, formBindingIndex, formData)
                    const status = resp?.data?.status || resp?.status
                    if (status === 'COMPLETED') {
                      setCases(cs => cs.map(c => c.id === activeCaseId ? { ...c, status: 'COMPLETED', enabled: [] } : c))
                      setEnabled([])
                      setMenuOpen(false)
                    } else {
                      // refresh enabled transitions after fire for quicker UI feedback
                      refresh()
                    }
                  } catch(e){ /* eslint-disable no-console */ console.warn('Fire with formData failed', e) }
                }
                setFormOpen(false)
              }}
              className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-500"
            >Submit</button>
          </div>
        </div>
          )}
        </div>
      </div>
    </div>
  )
}
