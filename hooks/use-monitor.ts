"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchMarking, fetchTransitionsStatus, fireTransition, simulationStep, resetWorkflow } from '@/components/petri/petri-client'
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
  const delayTimer = useRef<any>(null)

  const normalizeTokensOntoNodes = useCallback((mk: any) => {
    if (!mk || typeof mk !== 'object') return
    setNodes(nds => nds.map(n => {
      if (n.type !== 'place') return n
      const placeName = (n.data as any)?.name
      const rawTokens: any[] = placeName && Array.isArray(mk[placeName]) ? mk[placeName] : []
      const norm = rawTokens.map((tok, idx) => {
        const timestamp = typeof tok?.timestamp === 'number' ? tok.timestamp : (typeof tok?.timestamp === 'string' ? Date.parse(tok.timestamp) : Date.now())
        return {
          id: tok.id || `srv-${placeName}-${idx}`,
          data: tok.data !== undefined ? tok.data : tok.value,
          createdAt: timestamp,
          serverTimestamp: tok.timestamp,
          __server: true,
        }
      })
      return { ...n, data: { ...(n.data as any), tokens: norm.length, tokenList: norm } }
    }))
  }, [setNodes])

  const refresh = useCallback(async () => {
    if (!workflowId || !flowServiceUrl) return
    setLoading(true)
    try {
      const [mk, trans] = await Promise.all([
        fetchMarking(flowServiceUrl, workflowId),
        fetchTransitionsStatus(flowServiceUrl, workflowId),
      ])
      setMarking(mk)
      setTransitions(trans.data || [])
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
      await fireTransition(flowServiceUrl, workflowId, transitionId, bindingIndex)
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
    try { await simulationStep(flowServiceUrl, workflowId) } finally { await refresh(); setLoading(false) }
  }, [workflowId, flowServiceUrl, refresh])

  const reset = useCallback(async () => {
    if (!workflowId || !flowServiceUrl) return
    setLoading(true)
    try { await resetWorkflow(flowServiceUrl, workflowId) } catch(e){ console.warn('Reset failed', e) } finally { await refresh(); setLoading(false) }
  }, [workflowId, flowServiceUrl, refresh])

  // Auto refresh when workflow changes (caller can gate by tab state)
  useEffect(() => { return () => { if (delayTimer.current) clearTimeout(delayTimer.current) } }, [])

  const enabled = useMemo(() => transitions.filter(t => t.enabled), [transitions])

  return {
    marking,
    transitions,
    enabled,
    loading,
    refresh,
    fire,
    step,
    reset,
  }
}
