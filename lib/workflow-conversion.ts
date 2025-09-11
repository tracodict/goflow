// Conversion utilities between server workflow schema (go-petri-flow) and client graph (React Flow)
import type { Node, Edge } from '@xyflow/react'
import type { PetriNodeData, PetriEdgeData } from './petri-types'

// Server schema (minimal fields used by client)
export interface ServerWorkflow {
  id: string
  name: string
  description?: string
  colorSets?: string[]
  jsonSchemas?: { name: string; schema: any }[]
  places: { id: string; name: string; colorSet?: string; position?: { x: number; y: number } }[]
  transitions: { id: string; name: string; kind?: string; guardExpression?: string; actionExpression?: string; transitionDelay?: number; position?: { x: number; y: number }; formSchema?: string; layoutSchema?: string }[]
  arcs: { id: string; sourceId: string; targetId: string; expression?: string }[]
  initialMarking?: Record<string, { value: any; timestamp: number }[]>
  endPlaces?: string[]
  // Hierarchical sub workflows: array of objects with at minimum callTransitionId & cpnId
  subWorkflows?: { id?: string; cpnId?: string; callTransitionId?: string; autoStart?: boolean; propagateOnComplete?: boolean; inputMapping?: Record<string,any>; outputMapping?: Record<string,any> }[]
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
    // Prefer ID matching; fallback to name match for backward compatibility with older saved workflows.
    const isEnd = endSet.has(p.id) || endSet.has(p.name)
    nodes.push({
      id: p.id,
      type: 'place',
      position: p.position || { x: 80 + Math.random()*400, y: 120 + Math.random()*160 },
      data: { kind: 'place', name: p.name, colorSet: p.colorSet || '', tokens: 0, tokenList: [], isEnd }
    })
  })
  const allowed: any[] = ['Manual','Auto','Message','LLM']
  sw.transitions.forEach(t => {
    let tType: any = (t.kind as any) || 'Manual'
    if (!allowed.includes(tType)) tType = 'Manual'
    const manual = tType === 'Manual' ? { formSchema: (t as any).formSchema, layoutSchema: (t as any).layoutSchema } : undefined
    nodes.push({
      id: t.id,
      type: 'transition',
      position: t.position || { x: 80 + Math.random()*400, y: 360 + Math.random()*160 },
      data: {
        kind: 'transition',
        name: t.name,
        tType,
        guardExpression: t.guardExpression,
        actionExpression: t.actionExpression,
        transitionDelay: (t as any).transitionDelay,
        // Map LLM fields (backend may send these when kind == LLM)
        ...(tType === 'LLM' ? {
          llm: {
            ...(typeof (t as any).LlmTemplate === 'string'
              ? { template: (t as any).LlmTemplate }
              : ( (t as any).LlmTemplate && typeof (t as any).LlmTemplate === 'object' && Array.isArray((t as any).LlmTemplate.messages)
                  ? { templateObj: { messages: (t as any).LlmTemplate.messages } }
                  : {})),
            vars: (t as any).LlmVars || {},
            stream: !!(t as any).Stream,
            options: (t as any).LlmOptions || {},
          }
        } : {}),
        ...(manual ? { manual } : {})
      } as any,
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
  // Attach subPage configs from server subWorkflows
  if (Array.isArray(sw.subWorkflows)) {
    for (const link of sw.subWorkflows) {
      if (!link || typeof link !== 'object') continue
      const tNode = nodes.find(n => n.id === (link as any).callTransitionId)
      if (tNode && tNode.type === 'transition') {
        ;(tNode.data as any).subPage = {
          enabled: true,
          id: (link as any).id,
            cpnId: (link as any).cpnId,
          autoStart: (link as any).autoStart,
          propagateOnComplete: (link as any).propagateOnComplete,
          inputMapping: (link as any).inputMapping,
          outputMapping: (link as any).outputMapping,
        }
      }
    }
  }
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
  const transitions = graph.nodes
    .filter(n => n.type === 'transition')
    .map(n => {
      const base: any = {
        id: n.id,
        name: (n.data as any).name || n.id,
        kind: (n.data as any).tType,
        guardExpression: (n.data as any).guardExpression,
        actionExpression: (n.data as any).actionExpression,
        transitionDelay: (n.data as any).transitionDelay,
        position: n.position,
      }
      if ((n.data as any).tType === 'Manual') {
        const manual = (n.data as any).manual || {}
        if (manual.formSchema) base.formSchema = manual.formSchema
        if (manual.layoutSchema) base.layoutSchema = manual.layoutSchema
      }
      if ((n.data as any).tType === 'LLM') {
        const llm = (n.data as any).llm || {}
  if (llm.templateObj && Array.isArray(llm.templateObj.messages)) base.LlmTemplate = { messages: llm.templateObj.messages }
  else if (llm.template) base.LlmTemplate = llm.template
        if (llm.vars && typeof llm.vars === 'object') base.LlmVars = llm.vars
        if (llm.options && typeof llm.options === 'object') base.LlmOptions = llm.options
        if (llm.stream !== undefined) base.Stream = !!llm.stream
      }
      return base
    })
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
  // derive marking using first occurrence per place name (avoid merging duplicates with same name)
  const initialMarking: Record<string, { value: any; timestamp: number }[]> = {}
  const seenPlaceName = new Set<string>()
  graph.nodes.filter(n => n.type === 'place').forEach(n => {
    const placeName = (n.data as any).name || n.id
    if (seenPlaceName.has(placeName)) return
    seenPlaceName.add(placeName)
    const list = (n.data as any).tokenList || []
    if (list.length > 0) {
      initialMarking[placeName] = list.map((tok: any) => ({ value: tok.data, timestamp: typeof tok.createdAt === 'number' ? tok.createdAt : 0 }))
    }
  })
  // Derive endPlaces from graph (places marked isEnd true) using place IDs.
  const endPlaces = graph.nodes.filter(n => n.type==='place' && (n.data as any).isEnd).map(n => n.id)
  // Build server colorSets: ONLY full declaration lines (exclude derived short names)
  const isColsetLine = (s: string) => typeof s === 'string' && /^\s*colset\s+/i.test(s)
  const mergedSet: string[] = []
  // 1. Take declaration color lines first
  if (declarations?.color && declarations.color.length) {
    for (let line of declarations.color) {
      if (isColsetLine(line)) {
        // Normalize deprecated 'map' type to 'json'
        line = line.replace(/(=)\s*map\s*;/i, '$1 json;')
        const trimmed = line.trim()
        if (!mergedSet.includes(trimmed)) mergedSet.push(trimmed)
      }
    }
  }
  // 2. Include any existing colorSets entries that are already full lines (legacy compatibility)
  if (colorSets && colorSets.length) {
    for (let c of colorSets) {
      if (isColsetLine(c)) {
        c = c.replace(/(=)\s*map\s*;/i, '$1 json;')
        const trimmed = c.trim()
        if (!mergedSet.includes(trimmed)) mergedSet.push(trimmed)
      }
    }
  }
  const mergedColorSets = mergedSet
  // Build subWorkflows from transitions with subPage.enabled
  const prevLinks = Array.isArray(current?.subWorkflows) ? current!.subWorkflows! : []
  const subWorkflows = graph.nodes
    .filter(n => n.type === 'transition' && (n.data as any).subPage?.enabled)
    .map(n => {
      const cfg = (n.data as any).subPage || {}
      // Try to reuse previous id if exists for same transition
      const prev = prevLinks.find(l => (l as any).callTransitionId === n.id)
      const idExisting = cfg.id || prev?.id || `sw_${n.id}`
      return {
        id: idExisting,
        cpnId: cfg.cpnId,
        callTransitionId: n.id,
        autoStart: cfg.autoStart ?? true,
        propagateOnComplete: cfg.propagateOnComplete ?? true,
        inputMapping: cfg.inputMapping || {},
        outputMapping: cfg.outputMapping || {},
      }
    })
  return {
    id,
    name,
    description: description || current?.description || '',
    colorSets: mergedColorSets,
    jsonSchemas: (declarations as any)?.jsonSchemas || current?.jsonSchemas || [],
    places,
    transitions,
    arcs,
    endPlaces,
    initialMarking,
    subWorkflows,
  }
}
