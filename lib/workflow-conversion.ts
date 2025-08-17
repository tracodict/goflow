// Conversion utilities between server workflow schema (go-petri-flow) and client graph (React Flow)
import type { Node, Edge } from '@xyflow/react'
import type { PetriNodeData, PetriEdgeData } from './petri-types'

// Server schema (minimal fields used by client)
export interface ServerWorkflow {
  id: string
  name: string
  description?: string
  colorSets?: string[]
  places: { id: string; name: string; colorSet?: string; position?: { x: number; y: number } }[]
  transitions: { id: string; name: string; kind?: string; guardExpression?: string; position?: { x: number; y: number } }[]
  arcs: { id: string; sourceId: string; targetId: string; expression?: string }[]
  initialMarking?: Record<string, { value: any; timestamp: number }[]>
  endPlaces?: string[]
  subWorkflows?: string[]
}

export interface GraphWorkflow {
  id: string
  graph: { nodes: Node<PetriNodeData>[]; edges: Edge<PetriEdgeData>[] }
  colorSets: string[]
  initialMarking: Record<string, { value: any; timestamp: number }[]>
}

// server -> graph
export function serverToGraph(sw: ServerWorkflow): GraphWorkflow {
  const nodes: Node<PetriNodeData>[] = []
  const edges: Edge<PetriEdgeData>[] = []
  sw.places.forEach(p => {
    nodes.push({
      id: p.id,
      type: 'place',
      position: p.position || { x: 80 + Math.random()*400, y: 120 + Math.random()*160 },
      data: { kind: 'place', name: p.name, colorSet: p.colorSet || '', tokens: 0, tokenList: [] }
    })
  })
  sw.transitions.forEach(t => {
    nodes.push({
      id: t.id,
      type: 'transition',
      position: t.position || { x: 80 + Math.random()*400, y: 360 + Math.random()*160 },
      data: { kind: 'transition', name: t.name, tType: (t.kind as any) || 'Manual', guardExpression: t.guardExpression }
    })
  })
  sw.arcs.forEach(a => {
    if (nodes.find(n => n.id === a.sourceId) && nodes.find(n => n.id === a.targetId)) {
      edges.push({ id: a.id, source: a.sourceId, target: a.targetId, type: 'labeled', data: { label: 'arc', expression: a.expression } })
    }
  })
  // apply initial marking
  const marking = sw.initialMarking || {}
  Object.entries(marking).forEach(([placeName, tokens]) => {
    const placeNode = nodes.find(n => n.type === 'place' && (n.data as any).name === placeName)
    if (placeNode) {
      const list = tokens.map(t => ({ id: `tok-${Math.random().toString(36).slice(2,8)}`, data: t.value, createdAt: t.timestamp }))
      ;(placeNode.data as any).tokenList = list
      ;(placeNode.data as any).tokens = list.length
    }
  })
  return { id: sw.id, graph: { nodes, edges }, colorSets: sw.colorSets || [], initialMarking: marking }
}

// graph -> server
export function graphToServer(current: ServerWorkflow | undefined, id: string, name: string, graph: { nodes: Node<PetriNodeData>[]; edges: Edge<PetriEdgeData>[] }, colorSets: string[], description?: string): ServerWorkflow {
  const places = graph.nodes.filter(n => n.type === 'place').map(n => ({ id: n.id, name: (n.data as any).name || n.id, colorSet: (n.data as any).colorSet || '', position: n.position }))
  const transitions = graph.nodes.filter(n => n.type === 'transition').map(n => ({ id: n.id, name: (n.data as any).name || n.id, kind: (n.data as any).tType, guardExpression: (n.data as any).guardExpression, position: n.position }))
  const arcs = graph.edges.map(e => {
    const sourceNode = graph.nodes.find(n => n.id === e.source)
    const targetNode = graph.nodes.find(n => n.id === e.target)
    // Determine direction: place -> transition = IN, transition -> place = OUT
    let direction = ''
    if (sourceNode?.type === 'place' && targetNode?.type === 'transition') direction = 'IN'
    else if (sourceNode?.type === 'transition' && targetNode?.type === 'place') direction = 'OUT'
    // If invalid (place->place or transition->transition) leave empty; server likely rejects
    return { id: e.id, sourceId: e.source, targetId: e.target, expression: (e.data as any)?.expression || '', direction }
  })
  // derive marking
  const initialMarking: Record<string, { value: any; timestamp: number }[]> = {}
  graph.nodes.filter(n => n.type === 'place').forEach(n => {
    const list = (n.data as any).tokenList || []
    if (list.length > 0) {
      initialMarking[(n.data as any).name || n.id] = list.map((tok: any) => ({ value: tok.data, timestamp: tok.createdAt }))
    }
  })
  return {
    id,
    name,
    description: description || current?.description || '',
    colorSets,
    places,
    transitions,
    arcs,
    endPlaces: current?.endPlaces || [],
    initialMarking,
    subWorkflows: current?.subWorkflows || []
  }
}
