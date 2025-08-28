"use client"
import React, { useEffect, useState } from 'react'
import { MessageSquare, MessageSquareDot, X } from 'lucide-react'
import { useMonitor } from '@/hooks/use-monitor'
import { fetchWorkflow } from '@/components/petri/petri-client'
import type { PetriNodeData } from '@/lib/petri-types'
import type { Node } from '@xyflow/react'
import { DEFAULT_SETTINGS } from '@/components/petri/system-settings-context'

// Minimal run view: shows floating button indicating if any transition enabled
export default function RunMain({ workflowId }: { workflowId: string | null }) {
  const [nodes, setNodes] = useState<Node<PetriNodeData>[]>([])
  const [wfTransitions, setWfTransitions] = useState<any[]>([])
  const [jsonSchemas, setJsonSchemas] = useState<{ name: string; schema: any }[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const hideTimerRef = React.useRef<any>(null)
  const [hoverTransitionId, setHoverTransitionId] = useState<string | null>(null)
  const bindingHideTimerRef = React.useRef<any>(null)
  const [hoveredBindingIndex, setHoveredBindingIndex] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formSchema, setFormSchema] = useState<any>(null)
  const [formData, setFormData] = useState<any>(null)
  const [formTitle, setFormTitle] = useState<string>('Manual Task')
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

  const { enabled, refresh } = useMonitor({ workflowId, flowServiceUrl, setNodes })

  // Fetch workflow definition (for transition kind & formSchema + jsonSchemas)
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!workflowId || !flowServiceUrl) return
      try {
        const resp: any = await fetchWorkflow(flowServiceUrl, workflowId)
        const data = resp?.data || resp
        if (!cancelled && data) {
          setWfTransitions(Array.isArray(data.transitions) ? data.transitions : [])
          setJsonSchemas(Array.isArray(data.jsonSchemas) ? data.jsonSchemas : [])
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [workflowId, flowServiceUrl])

  // Auto refresh every 5s when in run mode (light polling)
  useEffect(() => {
    if (!workflowId) return
    refresh()
    const id = setInterval(() => refresh(), 5000)
    return () => clearInterval(id)
  }, [workflowId, refresh])

  const anyEnabled = enabled.length > 0

  function getTransitionDef(t: any) {
    const tid = t.id || t.transitionId
    return wfTransitions.find(x => x.id === tid || x.transitionId === tid)
  }

  function getSchemaForTransition(t: any) {
    const def = getTransitionDef(t)
    const formSchemaName = def?.formSchema || def?.manual?.formSchema
    if (!formSchemaName) return null
    const found = jsonSchemas.find(s => s.name === formSchemaName)
    return found ? { name: formSchemaName, schema: found.schema } : { name: formSchemaName, schema: null }
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
    setFormData(value)
    setFormTitle((transition.name || transition.id || 'Manual Task') + (variableName ? ` – ${variableName}` : ''))
    setFormOpen(true)
    setMenuOpen(false)
    setHoverTransitionId(null)
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Placeholder background */}
      <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm select-none">
        Run Mode (workflow: {workflowId || 'none'})
      </div>
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
          title={anyEnabled ? 'Enabled transitions available – click to refresh' : 'No transitions enabled – click to refresh'}
          className="group inline-flex h-12 w-12 items-center justify-center rounded-full border bg-white shadow-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {anyEnabled ? <MessageSquareDot className="h-6 w-6 text-emerald-600" /> : <MessageSquare className="h-6 w-6 text-neutral-500" />}
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
            {formSchema && formSchema.type === 'object' && formSchema.properties ? (
              <form className="space-y-4 max-w-3xl">
                {Object.entries<any>(formSchema.properties).map(([key, propSchema]: any) => {
                  const value = formData?.[key]
                  const required = Array.isArray(formSchema.required) && formSchema.required.includes(key)
                  const type = propSchema.type
                  const label = propSchema.title || key
                  const desc = propSchema.description
                  const common = 'block w-full rounded border px-2 py-1 text-sm'
                  let inputEl: React.ReactNode
                  if (type === 'string') {
                    inputEl = (
                      <input
                        type="text"
                        className={common}
                        value={value ?? ''}
                        onChange={e => setFormData((d: any) => ({ ...(d||{}), [key]: e.target.value }))}
                      />
                    )
                  } else if (type === 'number' || type === 'integer') {
                    inputEl = (
                      <input
                        type="number"
                        className={common}
                        value={value ?? ''}
                        onChange={e => setFormData((d: any) => ({ ...(d||{}), [key]: e.target.value === '' ? undefined : (type==='integer'? parseInt(e.target.value,10): parseFloat(e.target.value)) }))}
                      />
                    )
                  } else if (type === 'boolean') {
                    inputEl = (
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!value}
                          onChange={e => setFormData((d: any) => ({ ...(d||{}), [key]: e.target.checked }))}
                        />
                        <span>{label}</span>
                      </label>
                    )
                  } else {
                    inputEl = <div className="text-xs text-neutral-500">Unsupported field type: {type}</div>
                  }
                  return (
                    <div key={key} className="space-y-1">
                      {type !== 'boolean' && <label className="text-xs font-medium text-neutral-700 flex items-center gap-1">{label}{required && <span className="text-rose-500">*</span>}</label>}
                      {inputEl}
                      {desc && <p className="text-[11px] text-neutral-500">{desc}</p>}
                    </div>
                  )
                })}
              </form>
            ) : formSchema && (formSchema.type === 'string' || formSchema.type === 'number' || formSchema.type === 'integer' || formSchema.type === 'boolean') ? (
              <form className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700 flex items-center gap-1">{formSchema.title || 'Value'}</label>
                  {formSchema.type === 'string' && (
                    <input
                      type="text"
                      className="block w-full rounded border px-2 py-1 text-sm"
                      value={formData ?? ''}
                      onChange={e => setFormData(e.target.value)}
                    />
                  )}
                  {(formSchema.type === 'number' || formSchema.type === 'integer') && (
                    <input
                      type="number"
                      className="block w-full rounded border px-2 py-1 text-sm"
                      value={formData ?? ''}
                      onChange={e => setFormData(e.target.value === '' ? undefined : (formSchema.type === 'integer' ? parseInt(e.target.value,10) : parseFloat(e.target.value)))}
                    />
                  )}
                  {formSchema.type === 'boolean' && (
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!formData}
                        onChange={e => setFormData(e.target.checked)}
                      />
                      <span>{formSchema.title || 'Value'}</span>
                    </label>
                  )}
                  {formSchema.description && <p className="text-[11px] text-neutral-500">{formSchema.description}</p>}
                </div>
              </form>
            ) : formSchema ? (
              <div className="text-sm text-neutral-500">Schema type not supported in simple renderer.</div>
            ) : (
              <div className="text-sm text-neutral-500">No schema available for this transition.</div>
            )}
          </div>
          <div className="border-t px-4 py-2 flex justify-end gap-2 bg-white/80">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-3 py-1.5 text-xs rounded border hover:bg-neutral-50"
            >Cancel</button>
            <button
              type="button"
              onClick={() => { /* placeholder submit */ setFormOpen(false) }}
              className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-500"
            >Submit</button>
          </div>
        </div>
      )}
    </div>
  )
}
