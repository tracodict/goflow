export type TransitionType = "manual" | "auto" | "message" | "dmn" | "llm"

export type Token = {
  id: string
  data: any
  createdAt: number
  updatedAt?: number
}

export type TransitionData = {
  kind: "transition"
  name: string
  tType: TransitionType
  guard?: string
  // Optional time trigger: either cron expression or seconds delay (numeric string/number)
  time?: { cron?: string; delaySec?: number }
  manual?: { assignee?: string; formSchemaId?: string }
  auto?: { script?: string }
  message?: { channel?: string }
  dmnDefinition?: any
  llm?: {
    system?: string
    user?: string
    extras?: string[]
    jsonOutput?: boolean
    jsonSchema?: string
    retryOnError?: boolean
    maxRetries?: number
    retryIntervalSec?: number
  }
}

export type PlaceData = {
  kind: "place"
  name: string
  tokens: number
  tokenList?: Token[]
}

export type PetriNodeData = PlaceData | TransitionData

export type PetriEdgeData = { label?: string }

import type { Edge, Node } from "@xyflow/react"

export function isPlace(n: Node<PetriNodeData>) {
  return n.type === "place"
}
export function isTransition(n: Node<PetriNodeData>) {
  return n.type === "transition"
}

export function getIncomingPlaces(transitionId: string, nodes: Node<PetriNodeData>[], edges: Edge<PetriEdgeData>[]) {
  const tInEdges = edges.filter((e) => e.target === transitionId)
  const places: Node<PetriNodeData>[] = []
  for (const e of tInEdges) {
    const src = nodes.find((n) => n.id === e.source)
    if (src && isPlace(src)) places.push(src)
  }
  return places
}

export function getOutgoingPlaces(transitionId: string, nodes: Node<PetriNodeData>[], edges: Edge<PetriEdgeData>[]) {
  const tOutEdges = edges.filter((e) => e.source === transitionId)
  const places: Node<PetriNodeData>[] = []
  for (const e of tOutEdges) {
    const dst = nodes.find((n) => n.id === e.target)
    if (dst && isPlace(dst)) places.push(dst)
  }
  return places
}

export function isEnabled(transitionId: string, nodes: Node<PetriNodeData>[], edges: Edge<PetriEdgeData>[]) {
  const inputs = getIncomingPlaces(transitionId, nodes, edges)
  if (inputs.length === 0) return false
  return inputs.every((p) => (p.data as any).tokens > 0)
}

export function getEnabledTransitions(nodes: Node<PetriNodeData>[], edges: Edge<PetriEdgeData>[]) {
  return nodes.filter((n) => isTransition(n) && isEnabled(n.id, nodes, edges))
}

export function anyEnabledTransitions(nodes: Node<PetriNodeData>[], edges: Edge<PetriEdgeData>[]) {
  return getEnabledTransitions(nodes, edges)
}

function rid(prefix = "tok") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function removeOneToken(place: Node<PetriNodeData>): { place: Node<PetriNodeData>; tokenData: any } {
  if (!isPlace(place)) return { place, tokenData: {} }
  const pd = place.data as PlaceData
  const list = [...(pd.tokenList || [])]
  const removed = list.length > 0 ? list.shift() : undefined
  const tokens = Math.max(0, (pd.tokens ?? 0) - 1)
  const next: Node<PetriNodeData> = { ...place, data: { ...pd, tokens, tokenList: list } }
  return { place: next, tokenData: removed?.data ?? {} }
}

function addOneToken(place: Node<PetriNodeData>, data: any): Node<PetriNodeData> {
  if (!isPlace(place)) return place
  const pd = place.data as PlaceData
  const list = [...(pd.tokenList || [])]
  list.push({ id: rid(), data, createdAt: Date.now() })
  const tokens = (pd.tokens ?? 0) + 1
  return { ...place, data: { ...pd, tokens, tokenList: list } }
}

export function fireTransition(
  transitionId: string,
  nodes: Node<PetriNodeData>[],
  edges: Edge<PetriEdgeData>[],
): { nodes: Node<PetriNodeData>[] } {
  if (!isEnabled(transitionId, nodes, edges)) return { nodes }
  const inputs = getIncomingPlaces(transitionId, nodes, edges)
  const outputs = getOutgoingPlaces(transitionId, nodes, edges)

  // Consume one token from each input; take data from the first input (if any)
  let tokenPayload: any = {}
  let workingNodes = nodes.map((n) => {
    if (isPlace(n) && inputs.some((p) => p.id === n.id)) {
      const { place: nextPlace, tokenData } = removeOneToken(n)
      if (tokenPayload == null || Object.keys(tokenPayload).length === 0) {
        tokenPayload = tokenData || {}
      }
      return nextPlace
    }
    return n
  })

  // Produce one token in each output place, carrying forward the payload
  workingNodes = workingNodes.map((n) => {
    if (isPlace(n) && outputs.some((p) => p.id === n.id)) {
      return addOneToken(n, tokenPayload || {})
    }
    return n
  })

  return { nodes: workingNodes }
}

export const initialSampleNet: {
  nodes: Node<PetriNodeData>[]
  edges: Edge<PetriEdgeData>[]
} = {
  nodes: [
    {
      id: "p-start",
      type: "place",
      position: { x: 80, y: 160 },
      data: {
        kind: "place",
        name: "Start",
        tokens: 1,
        tokenList: [{ id: "tok-aaaaaa", data: { docId: "INV-1001", amount: 250 }, createdAt: Date.now() }],
      },
    },
    {
      id: "t-approve",
      type: "transition",
      position: { x: 300, y: 148 },
      data: {
        kind: "transition",
        name: "Approve",
        tType: "manual",
        manual: { assignee: "", formSchemaId: "" },
  guard: "",
      },
    },
    {
      id: "p-review",
      type: "place",
      position: { x: 540, y: 90 },
      data: { kind: "place", name: "Under Review", tokens: 0, tokenList: [] },
    },
    {
      id: "p-done",
      type: "place",
      position: { x: 540, y: 210 },
      data: { kind: "place", name: "Done", tokens: 0, tokenList: [] },
    },
    {
      id: "t-auto-archive",
      type: "transition",
      position: { x: 760, y: 90 },
  data: { kind: "transition", name: "Auto Archive", tType: "auto", auto: { script: "" }, guard: "" },
    },
    {
      id: "p-archived",
      type: "place",
      position: { x: 980, y: 90 },
      data: { kind: "place", name: "Archived", tokens: 0, tokenList: [] },
    },
  ],
  edges: [
    { id: "e1", source: "p-start", target: "t-approve", type: "labeled", data: { label: "submit" } },
    { id: "e2", source: "t-approve", target: "p-review", type: "labeled", data: { label: "approved" } },
    { id: "e3", source: "t-approve", target: "p-done", type: "labeled", data: { label: "fast-track" } },
    { id: "e4", source: "p-review", target: "t-auto-archive", type: "labeled", data: { label: "reviewed" } },
    { id: "e5", source: "t-auto-archive", target: "p-archived", type: "labeled", data: { label: "archived" } },
  ],
}
