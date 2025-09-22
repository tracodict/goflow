import { useCallback, useEffect, useRef, useState } from 'react'

// Ensure auth cookie (lz_sess) is sent; without credentials we get 401 from /api/sim/*
function fetchWithAuth(input: string, init: RequestInit = {}) {
  return fetch(input, { credentials: 'include', ...init })
}

export interface SimulationCase {
  caseId: string
  cpnId: string
  name?: string
  description?: string
  status?: string
  mode?: 'sim'
  currentStep?: number
  marking?: any
  enabledTransitions?: any[]
  createdAt?: string
}

interface UseSimulationOptions {
  flowServiceUrl?: string
  workflowId: string | null
}

// Hook to manage simulation cases using the unified /api/sim/* endpoints.
// It mirrors a subset of useMonitor API shape but supports multiple simulation instances.
export function useSimulation({ flowServiceUrl, workflowId }: UseSimulationOptions) {
  const [sims, setSims] = useState<SimulationCase[]>([])
  const [activeSimId, setActiveSimId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refreshTimerRef = useRef<any>(null)

  const activeSim = sims.find(s => s.caseId === activeSimId) || null

  const fetchSim = useCallback(async (caseId: string) => {
    if (!flowServiceUrl) return null
  const resp = await fetchWithAuth(`${flowServiceUrl}/api/sim/get?caseId=${encodeURIComponent(caseId)}`)
    if (!resp.ok) throw new Error(`get failed ${resp.status}`)
    const json = await resp.json()
    return json?.data || json
  }, [flowServiceUrl])

  const refreshActive = useCallback(async () => {
    if (!activeSimId) return
    try {
      const data = await fetchSim(activeSimId)
      if (data) {
  setSims(prev => prev.map(s => s.caseId === activeSimId ? { ...s, ...data, enabledTransitions: data.enabledTransitions } : s))
      }
    } catch (e:any) {
      // swallow transient errors
    }
  }, [activeSimId, fetchSim])

  // Periodic refresh
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    if (!activeSimId) return
    refreshTimerRef.current = setInterval(() => { refreshActive() }, 4000)
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current) }
  }, [activeSimId, refreshActive])

  const start = useCallback(async (opts?: { name?: string; description?: string; variables?: any }) => {
    if (!flowServiceUrl || !workflowId) return
    setLoading(true); setError(null)
    try {
      const body = { cpnId: workflowId, ...(opts?.name ? { name: opts.name } : {}), ...(opts?.description ? { description: opts.description } : {}), ...(opts?.variables ? { variables: opts.variables } : {}) }
  const resp = await fetchWithAuth(`${flowServiceUrl}/api/sim/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (resp.status === 401) throw new Error('Unauthorized (401) – please log in')
  if (!resp.ok) throw new Error(`start failed ${resp.status}`)
      const json = await resp.json()
      const data = json?.data || json
  const sim: SimulationCase = { caseId: data.caseId, cpnId: data.cpnId, name: data.name || data.caseId, description: data.description, status: data.status, currentStep: data.currentStep, marking: data.marking, enabledTransitions: data.enabledTransitions, mode: data.mode }
      setSims(prev => [sim, ...prev])
      setActiveSimId(sim.caseId)
    } catch (e:any) {
      setError(e?.message || 'Failed to start simulation')
    } finally {
      setLoading(false)
    }
  }, [flowServiceUrl, workflowId])

  const step = useCallback(async () => {
    if (!flowServiceUrl || !activeSimId) return
    setLoading(true)
    try {
      // Only auto-fire manual transitions here. Other types (message, llm, tools, retriever) are left to server logic or interactive handling.
      const sim = sims.find(s => s.caseId === activeSimId)
      const manual = sim?.enabledTransitions?.find((t: any) => (t.kind || t.type || t.tType || '').toLowerCase() === 'manual')
      if (manual) {
        const body = { caseId: activeSimId, transitionId: manual.id, bindingIndex: 0 }
        const resp = await fetchWithAuth(`${flowServiceUrl}/api/sim/fire`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (resp.status === 401) throw new Error('Unauthorized (401) – please log in')
        if (!resp.ok) throw new Error(`fire failed ${resp.status}`)
        const json = await resp.json(); const data = json?.data || json
        setSims(prev => prev.map(s => s.caseId === activeSimId ? { ...s, ...data, enabledTransitions: data.enabledTransitions } : s))
      } else {
        // No manual transitions: perform an automatic layer step
        const resp = await fetchWithAuth(`${flowServiceUrl}/api/sim/step`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: activeSimId }) })
        if (resp.status === 401) throw new Error('Unauthorized (401) – please log in')
        if (!resp.ok) throw new Error(`step failed ${resp.status}`)
        const json = await resp.json(); const data = json?.data || json
        setSims(prev => prev.map(s => s.caseId === activeSimId ? { ...s, ...data, enabledTransitions: data.enabledTransitions } : s))
      }
    } catch (e:any) { setError(e?.message || 'Failed to step') } finally { setLoading(false) }
  }, [flowServiceUrl, activeSimId, sims])

  // Interactive variant: if a manual transition is enabled, DO NOT fire – instead return it so caller can collect form data.
  // If only auto transitions are enabled, perform a normal step and return { autoStepped: true }.
  const stepInteractive = useCallback(async (): Promise<{ manualTransition?: any; autoStepped?: boolean }> => {
    if (!flowServiceUrl || !activeSimId) return {}
    const sim = sims.find(s => s.caseId === activeSimId)
    if (!sim) return {}
    const enabled = sim.enabledTransitions || []
    const manual = enabled.find((t: any) => (t.kind || t.type || t.tType || '').toLowerCase() === 'manual')
    if (manual) {
      // Let caller open form & gather data
      return { manualTransition: manual }
    }
    // If there are other non-auto transitions (e.g., message, llm, tools, retriever) fire first automatically.
    const other = enabled.find((t: any) => {
      const k = (t.kind || t.type || t.tType || '').toLowerCase()
      return k && k !== 'auto'
    })
    if (other) {
      setLoading(true)
      try {
        const body = { caseId: activeSimId, transitionId: other.id, bindingIndex: 0 }
        const resp = await fetchWithAuth(`${flowServiceUrl}/api/sim/fire`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (resp.status === 401) throw new Error('Unauthorized (401) – please log in')
        if (!resp.ok) throw new Error(`fire failed ${resp.status}`)
        const json = await resp.json(); const data = json?.data || json
        setSims(prev => prev.map(s => s.caseId === activeSimId ? { ...s, ...data, enabledTransitions: data.enabledTransitions } : s))
      } catch (e:any) { setError(e?.message || 'Failed to fire transition') } finally { setLoading(false) }
      return {}
    }
    // Otherwise perform automatic step
    setLoading(true)
    try {
      const resp = await fetchWithAuth(`${flowServiceUrl}/api/sim/step`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: activeSimId }) })
      if (resp.status === 401) throw new Error('Unauthorized (401) – please log in')
      if (!resp.ok) throw new Error(`step failed ${resp.status}`)
      const json = await resp.json(); const data = json?.data || json
      setSims(prev => prev.map(s => s.caseId === activeSimId ? { ...s, ...data, enabledTransitions: data.enabledTransitions } : s))
      return { autoStepped: true }
    } catch (e:any) { setError(e?.message || 'Failed to step') } finally { setLoading(false) }
    return {}
  }, [flowServiceUrl, activeSimId, sims])

  const fire = useCallback(async (transitionId: string, bindingIndex = 0, formData?: any) => {
    if (!flowServiceUrl || !activeSimId) return
    setLoading(true)
    try {
      const body: any = { caseId: activeSimId, transitionId, bindingIndex }
      if (formData) body.formData = formData
      const resp = await fetchWithAuth(`${flowServiceUrl}/api/sim/fire`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (resp.status === 401) throw new Error('Unauthorized (401) – please log in')
      if (!resp.ok) throw new Error(`fire failed ${resp.status}`)
      const json = await resp.json(); const data = json?.data || json
      setSims(prev => prev.map(s => s.caseId === activeSimId ? { ...s, ...data, enabledTransitions: data.enabledTransitions } : s))
    } catch (e:any) { setError(e?.message || 'Failed to fire transition') } finally { setLoading(false) }
  }, [flowServiceUrl, activeSimId])

  const run = useCallback(async (stepLimit?: number) => {
    if (!flowServiceUrl || !activeSimId) return
    setRunning(true); setError(null)
    try {
  const resp = await fetchWithAuth(`${flowServiceUrl}/api/sim/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: activeSimId, ...(stepLimit ? { stepLimit } : {}) }) })
  if (resp.status === 401) throw new Error('Unauthorized (401) – please log in')
  if (!resp.ok) throw new Error(`run failed ${resp.status}`)
  const json = await resp.json(); const data = json?.data || json
  setSims(prev => prev.map(s => s.caseId === activeSimId ? { ...s, ...data, enabledTransitions: data.enabledTransitions } : s))
    } catch (e:any) { setError(e?.message || 'Failed to run simulation') } finally { setRunning(false) }
  }, [flowServiceUrl, activeSimId])

  const remove = useCallback(async (caseId: string) => {
    if (!flowServiceUrl) return
    try {
  const resp = await fetchWithAuth(`${flowServiceUrl}/api/sim/delete?caseId=${encodeURIComponent(caseId)}`, { method: 'DELETE' })
  if (resp.status === 401) throw new Error('Unauthorized (401) – please log in')
  if (!resp.ok) throw new Error(`delete failed ${resp.status}`)
      setSims(prev => prev.filter(s => s.caseId !== caseId))
      if (activeSimId === caseId) setActiveSimId(null)
    } catch (e:any) {
      setError(e?.message || 'Failed to delete simulation')
    }
  }, [flowServiceUrl, activeSimId])

  const select = useCallback((caseId: string | null) => { setActiveSimId(caseId) }, [])

  return {
    sims,
    activeSimId,
    activeSim,
    loading,
    running,
    error,
    start,
  step,
  stepInteractive,
  fire,
    run,
    remove,
    select,
    refreshActive
  }
}
