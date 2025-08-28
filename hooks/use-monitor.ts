"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchMarking, fetchTransitionsStatus, fireTransition, simulationStep, simulationSteps, resetWorkflow, withApiErrorToast, fetchWorkflow } from '@/components/petri/petri-client'
import { toast } from '@/hooks/use-toast'
import type { Node } from '@xyflow/react'
import type { PetriNodeData } from '@/lib/petri-types'

interface UseMonitorOptions {
  workflowId: string | null
  flowServiceUrl: string | undefined
  setNodes: React.Dispatch<React.SetStateAction<Node<PetriNodeData>[]>>
  fireRefreshDelayMs?: number
}

export function useMonitor({ workflowId, flowServiceUrl, setNodes, fireRefreshDelayMs = 1000 }: UseMonitorOptions) {
  const [marking, setMarking] = useState<any>(null)
  const [transitions, setTransitions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fastForwarding, setFastForwarding] = useState(false)
  const [globalClock, setGlobalClock] = useState<number>(0)
  const [currentStep, setCurrentStep] = useState<number>(0)
  const delayTimer = useRef<any>(null)

  const lastDuplicateWarningRef = useRef<string>('')
  const normalizeTokensOntoNodes = useCallback((mk: any) => {
    if (!mk || typeof mk !== 'object') return
    // Build first-id map for each place name
    const firstIdForName: Record<string, string> = {}
    const nameCounts: Record<string, number> = {}
    setNodes(nds => {
      nds.forEach(n => {
        if (n.type === 'place') {
          const nm = (n.data as any)?.name
          if (!nm) return
          nameCounts[nm] = (nameCounts[nm] || 0) + 1
          if (!firstIdForName[nm]) firstIdForName[nm] = n.id
        }
      })
      return nds.map(n => {
        if (n.type !== 'place') return n
        const placeName = (n.data as any)?.name
        if (!placeName) return { ...n, data: { ...(n.data as any), tokens: 0, tokenList: [] } }
        // Only assign marking tokens to the first id for a given name to avoid sharing across duplicates
        if (firstIdForName[placeName] !== n.id) {
          return n // leave its existing local tokens untouched
        }
  // Prefer server marking keyed by place id (primary key); fallback to name for backward compatibility
  const rawSrc = mk[n.id] !== undefined ? mk[n.id] : mk[placeName]
  const rawTokens: any[] = Array.isArray(rawSrc) ? rawSrc : []
    const norm = rawTokens.map((tok, idx) => {
          const timestamp = typeof tok?.timestamp === 'number' ? tok.timestamp : (typeof tok?.timestamp === 'string' ? Date.parse(tok.timestamp) : Date.now())
          return {
            id: tok.id || `srv-${n.id}-${idx}`,
            data: tok.data !== undefined ? tok.data : tok.value,
            createdAt: timestamp,
            serverTimestamp: tok.timestamp,
            __server: true,
      ...(typeof tok.count === 'number' ? { count: tok.count } : {}),
          }
        })
        return { ...n, data: { ...(n.data as any), tokens: norm.length, tokenList: norm } }
      })
    })
    // Warn once per duplicate set if duplicates detected
    const duplicates = Object.entries(nameCounts).filter(([, c]) => c > 1).map(([n]) => n)
    if (duplicates.length) {
      const key = duplicates.sort().join(',')
      if (key !== lastDuplicateWarningRef.current) {
        lastDuplicateWarningRef.current = key
        toast({ title: 'Duplicate place names', description: `Tokens applied only to first occurrence: ${duplicates.join(', ')}`, variant: 'destructive' })
      }
    }
  }, [setNodes])

  const refresh = useCallback(async () => {
    if (!workflowId || !flowServiceUrl) return
    setLoading(true)
    try {
  const [mk, trans, wf] = await Promise.all([
        withApiErrorToast(fetchMarking(flowServiceUrl, workflowId), toast, 'Fetch marking'),
        withApiErrorToast(fetchTransitionsStatus(flowServiceUrl, workflowId), toast, 'Fetch transitions'),
        withApiErrorToast(fetchWorkflow(flowServiceUrl, workflowId), toast, 'Fetch workflow'),
      ])
      setMarking(mk)
  // New enabled endpoint returns only enabled transitions under data
  const rawData = trans?.data
  const transList: any[] = Array.isArray(rawData) ? rawData : []
  setTransitions(transList)
      // Global clock: prefer transitions response, fall back to workflow
      let clock = (rawData?.globalClock ?? trans.globalClock ?? rawData?.clock ?? trans.clock) as number | undefined
      if (clock === undefined) {
        const wfClock = (wf?.data?.globalClock ?? wf?.globalClock) as number | undefined
        if (typeof wfClock === 'number') clock = wfClock
      }
      if (typeof clock === 'number') setGlobalClock(clock)

      // Current step: use network(workflow) authoritative value, ignore transitions' step counters
      const wfStep = (wf?.data?.currentStep ?? wf?.currentStep) as number | undefined
      if (typeof wfStep === 'number') setCurrentStep(wfStep)
      normalizeTokensOntoNodes(mk)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Monitor refresh failed', e)
    } finally {
      setLoading(false)
    }
  }, [workflowId, flowServiceUrl, normalizeTokensOntoNodes])

  const fire = useCallback(async (transitionId: string, bindingIndex = 0) => {
    if (!workflowId || !flowServiceUrl) return
    setLoading(true)
    try {
      const res: any = await withApiErrorToast(fireTransition(flowServiceUrl, workflowId, transitionId, bindingIndex), toast, 'Fire transition')
      const clock = res?.data?.globalClock ?? res?.globalClock
      if (typeof clock === 'number') setGlobalClock(clock)
      // currentStep will be sourced from workflow in subsequent refresh
    } catch (e) {
      console.warn('Fire transition failed', e)
    } finally {
      setLoading(false)
      if (delayTimer.current) clearTimeout(delayTimer.current)
      delayTimer.current = setTimeout(() => refresh(), fireRefreshDelayMs)
    }
  }, [workflowId, flowServiceUrl, refresh, fireRefreshDelayMs])

  const step = useCallback(async () => {
    if (!workflowId || !flowServiceUrl) return
    setLoading(true)
    try {
      const res: any = await withApiErrorToast(simulationStep(flowServiceUrl, workflowId), toast, 'Simulation step')
      const clock = res?.data?.globalClock ?? res?.globalClock
      if (typeof clock === 'number') setGlobalClock(clock)
    } finally { await refresh(); setLoading(false) }
  }, [workflowId, flowServiceUrl, refresh])

  const fastForward = useCallback(async (steps: number) => {
    if (!workflowId || !flowServiceUrl) return
    setFastForwarding(true)
    try {
      const res: any = await withApiErrorToast(simulationSteps(flowServiceUrl, workflowId, steps), toast, 'Fast forward')
      const clock = res?.data?.globalClock ?? res?.globalClock
      if (typeof clock === 'number') setGlobalClock(clock)
    } finally {
      await refresh();
      setFastForwarding(false)
    }
  }, [workflowId, flowServiceUrl, refresh])

  const forwardToEnd = useCallback(async () => {
    if (!workflowId || !flowServiceUrl) return
    setFastForwarding(true)
    try {
      for (let i=0;i<1000;i++) {
        const trans = await fetchTransitionsStatus(flowServiceUrl, workflowId)
        const list = (trans?.data || trans)?.transitions || trans?.transitions || []
        const anyEnabled = list.some((t: any) => t.enabled)
        if (!anyEnabled) break
        const r: any = await simulationStep(flowServiceUrl, workflowId)
        const clock = r?.data?.globalClock ?? r?.globalClock
        if (typeof clock === 'number') setGlobalClock(clock)
      }
    } finally {
      await refresh();
      setFastForwarding(false)
    }
  }, [workflowId, flowServiceUrl, refresh])

  const rollback = useCallback(async () => {
    toast({ title: 'Rollback not supported', description: 'No rollback API available', variant: 'destructive' })
  }, [])

  const reset = useCallback(async () => {
    if (!workflowId || !flowServiceUrl) return
    setLoading(true)
  try { await withApiErrorToast(resetWorkflow(flowServiceUrl, workflowId), toast, 'Reset workflow') } catch(e){ /* handled */ } finally { await refresh(); setLoading(false) }
  }, [workflowId, flowServiceUrl, refresh])

  // Auto refresh when workflow changes (caller can gate by tab state)
  useEffect(() => { return () => { if (delayTimer.current) clearTimeout(delayTimer.current) } }, [])

  // Endpoint already returns only enabled transitions
  const enabled = transitions

  return {
    marking,
    transitions,
    enabled,
  loading,
  fastForwarding,
  globalClock,
  currentStep,
    refresh,
    fire,
    step,
  fastForward,
  forwardToEnd,
  rollback,
    reset,
  }
}
