"use client"
import { useCallback, useRef, useState } from 'react'
import { addEdge, type Connection, type Edge, type Node, type OnConnectEnd, type OnConnectStart } from '@xyflow/react'
import type { PetriEdgeData, PetriNodeData, TransitionType } from '@/lib/petri-types'

export interface UseGraphEditingOptions {
  screenToFlowPosition?: (pos: { x: number; y: number }) => { x: number; y: number }
  setNodes: React.Dispatch<React.SetStateAction<Node<PetriNodeData>[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge<PetriEdgeData>[]>>
}

export function useGraphEditing({ screenToFlowPosition, setNodes, setEdges }: UseGraphEditingOptions) {
  const connectStateRef = useRef<{ start: { nodeId?: string | null; handleType?: 'source' | 'target' | null } | null; inProgress: boolean; completed: boolean; cancel: boolean }>({ start: null, inProgress: false, completed: false, cancel: false })
  const [interactive, setInteractive] = useState(true)

  const addPlace = useCallback(() => {
    const id = `p-${Math.random().toString(36).slice(2, 7)}`
    const pos = screenToFlowPosition ? screenToFlowPosition({ x: 200, y: 150 }) : { x: 200, y: 150 }
  const suffix = ' #' + Math.random().toString(16).slice(2,5)
  setNodes(nds => [...nds, { id, type: 'place', position: pos, data: { kind: 'place', name: 'Place' + suffix, tokens: 0, tokenList: [], colorSet: 'INT' } } as any])
  }, [screenToFlowPosition, setNodes])

  const addTransition = useCallback(() => {
    const id = `t-${Math.random().toString(36).slice(2, 7)}`
    const pos = screenToFlowPosition ? screenToFlowPosition({ x: 420, y: 150 }) : { x: 420, y: 150 }
  const suffix = ' #' + Math.random().toString(16).slice(2,5)
  setNodes(nds => [...nds, { id, type: 'transition', position: pos, guardExpression: 'true', data: { kind: 'transition', name: 'Transition' + suffix, tType: 'Manual', manual: { assignee: '', formSchema: '', layoutSchema: '' } } } as any])
  }, [screenToFlowPosition, setNodes])

  const setTransitionType = useCallback((id: string, tType: TransitionType) => {
    setNodes(nds => nds.map(n => (n.id === id && n.type === 'transition' ? { ...n, data: { ...(n.data as any), tType } } : n)))
  }, [setNodes])

  const deleteNodeById = useCallback((id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id))
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id))
  }, [setNodes, setEdges])

  const onConnect = useCallback((connection: Connection) => {
    connectStateRef.current.completed = true
    connectStateRef.current.inProgress = false
    connectStateRef.current.cancel = false
    connectStateRef.current.start = null
  const suffix = ' #' + Math.random().toString(16).slice(2,5)
  const newEdge: Edge<PetriEdgeData> = { ...connection, id: `e-${connection.source ?? ''}-${connection.sourceHandle ?? ''}-${connection.target ?? ''}-${connection.targetHandle ?? ''}-${Math.random().toString(36).slice(2, 7)}`, type: 'labeled', data: { label: 'arc' + suffix } }
    setEdges(eds => addEdge(newEdge, eds))
  }, [setEdges])

  const isValidConnection = useCallback((conn: Connection | Edge): boolean => {
    // This requires caller to provide current nodes via closure if needed; we'll accept runtime lookup passed from outside if necessary.
    return true // Placeholder; caller can override or extend
  }, [])

  const onConnectStart: OnConnectStart = useCallback((_event, params) => {
    connectStateRef.current.start = { nodeId: params.nodeId, handleType: params.handleType }
    connectStateRef.current.inProgress = true
    connectStateRef.current.completed = false
    connectStateRef.current.cancel = false
  }, [])

  const onConnectEnd: OnConnectEnd = useCallback((event) => {
    const state = connectStateRef.current
    if (!state.inProgress || state.completed || state.cancel || !state.start) {
      connectStateRef.current.inProgress = false
      connectStateRef.current.completed = false
      connectStateRef.current.cancel = false
      connectStateRef.current.start = null
      return
    }
    const pt = 'clientX' in event ? { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY } : { x: (event as TouchEvent).changedTouches[0].clientX, y: (event as TouchEvent).changedTouches[0].clientY }
    const elem = document.elementFromPoint(pt.x, pt.y)
    const droppedOnPane = !!elem && !!(elem as Element).closest('.react-flow__pane')
    if (!droppedOnPane) {
      connectStateRef.current.inProgress = false
      connectStateRef.current.completed = false
      connectStateRef.current.cancel = false
      connectStateRef.current.start = null
      return
    }
    const flowPos = screenToFlowPosition ? screenToFlowPosition(pt) : { x: pt.x, y: pt.y }
    const startNodeId = state.start.nodeId
    if (!startNodeId) {
      connectStateRef.current.inProgress = false
      connectStateRef.current.completed = false
      connectStateRef.current.cancel = false
      connectStateRef.current.start = null
      return
    }
    // Caller still needs access to nodes to determine type; we create opposite node heuristically not available here.
    // For now we simply cancel; advanced logic can be injected later or this hook extended to accept current nodes.
    connectStateRef.current.inProgress = false
    connectStateRef.current.completed = false
    connectStateRef.current.cancel = false
    connectStateRef.current.start = null
  }, [screenToFlowPosition])

  return {
    interactive,
    setInteractive,
    addPlace,
    addTransition,
    deleteNodeById,
    setTransitionType,
    onConnect,
    onConnectStart,
    onConnectEnd,
    isValidConnection,
    connectStateRef,
  }
}
