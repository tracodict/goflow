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
  const endSet = new Set(sw.endPlaces || [])
  sw.places.forEach(p => {
    nodes.push({
      id: p.id,
      type: 'place',
      position: p.position || { x: 80 + Math.random()*400, y: 120 + Math.random()*160 },
      data: { kind: 'place', name: p.name, colorSet: p.colorSet || '', tokens: 0, tokenList: [], isEnd: endSet.has(p.name) }
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
      const list = tokens.map(t => ({ id: `tok-${Math.random().toString(36).slice(2,8)}`, data: t.value, createdAt: typeof t.timestamp === 'number' ? t.timestamp : 0 }))
      ;(placeNode.data as any).tokenList = list
      ;(placeNode.data as any).tokens = list.length
    }
  })
  return { id: sw.id, graph: { nodes, edges }, colorSets: sw.colorSets || [], initialMarking: marking }
}

// graph -> server
export function graphToServer(
  current: ServerWorkflow | undefined,
  id: string,
  name: string,
  graph: { nodes: Node<PetriNodeData>[]; edges: Edge<PetriEdgeData>[] },
  colorSets: string[],
  description?: string,
  declarations?: { batchOrdering?: string[]; globref?: string[]; color?: string[]; var?: string[]; lua?: string[] }
): ServerWorkflow {
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
  initialMarking[(n.data as any).name || n.id] = list.map((tok: any) => ({ value: tok.data, timestamp: typeof tok.createdAt === 'number' ? tok.createdAt : 0 }))
    }
  })
  // Derive endPlaces from graph (places marked isEnd true). Use place name (or id fallback)
  const endPlaces = graph.nodes.filter(n => n.type==='place' && (n.data as any).isEnd).map(n => (n.data as any).name || n.id)
  // Build server colorSets: ONLY full declaration lines (exclude derived short names)
  const isColsetLine = (s: string) => typeof s === 'string' && /^\s*colset\s+/i.test(s)
  const mergedSet: string[] = []
  // 1. Take declaration color lines first
  if (declarations?.color && declarations.color.length) {
    for (const line of declarations.color) {
      if (isColsetLine(line)) {
        const trimmed = line.trim()
        if (!mergedSet.includes(trimmed)) mergedSet.push(trimmed)
      }
    }
  }
  // 2. Include any existing colorSets entries that are already full lines (legacy compatibility)
  if (colorSets && colorSets.length) {
    for (const c of colorSets) {
      if (isColsetLine(c)) {
        const trimmed = c.trim()
        if (!mergedSet.includes(trimmed)) mergedSet.push(trimmed)
      }
    }
  }
  const mergedColorSets = mergedSet
  return {
    id,
    name,
    description: description || current?.description || '',
    colorSets: mergedColorSets,
    places,
    transitions,
    arcs,
    endPlaces,
    initialMarking,
    subWorkflows: current?.subWorkflows || [],
  }
}
