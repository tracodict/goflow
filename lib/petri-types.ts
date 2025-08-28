// Petri net core types (client-side representation)
export type TransitionType = "Manual" | "Auto" | "Message" | "Dmn" | "Llm"

export type Token = {
  id: string
  data: any
  createdAt: number
  updatedAt?: number
  count?: number // multiplicity for multiset markings
}

export type TransitionData = {
  kind: "transition"
  name: string
  tType: TransitionType
  guardExpression?: string
  transitionDelay?: number // delay (time units) before firing completes (advances global clock)
  time?: { cron?: string; delaySec?: number }
  manual?: { assignee?: string; formSchema?: string; layoutSchema?: string }
  actionExpression?: string
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
  colorSet: string
  tokens: number
  tokenList?: Token[]
  isStart?: boolean
  isEnd?: boolean
}

export type PetriNodeData = PlaceData | TransitionData
export type PetriEdgeData = { label?: string; expression?: string }

import type { Node } from "@xyflow/react"
export function isPlace(n: Node<PetriNodeData>) { return n.type === 'place' }
export function isTransition(n: Node<PetriNodeData>) { return n.type === 'transition' }
