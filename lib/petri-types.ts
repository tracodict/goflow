// Petri net core types (client-side representation)
// Transition types no longer include a dedicated SubPage kind; any transition can act as a subpage caller.
export type TransitionType = "Manual" | "Auto" | "Message" | "LLM" | "Tools" | "Retriever"

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
  scriptLanguage?: string
  transitionDelay?: number // delay (time units) before firing completes (advances global clock)
  time?: { cron?: string; delaySec?: number }
  manual?: { assignee?: string; formSchema?: string; layoutSchema?: string }
  // Legacy inline action expression (deprecated in UI; kept for compatibility)
  actionExpression?: string
  // New CPN-style action function and explicit output variables
  actionFunction?: string
  actionFunctionOutput?: string[]
  message?: { channel?: string }
  // Generic sub-workflow (hierarchical) call configuration; applies when `subPage?.enabled` (UI flag) is true.
  subPage?: {
    enabled?: boolean
    id?: string
    cpnId?: string
    autoStart?: boolean
    propagateOnComplete?: boolean
    inputMapping?: Record<string,string>
    outputMapping?: Record<string,string>
  }
  llm?: {
  // New templated messages model (preferred)
  templateObj?: { messages: Array<{ type: 'system'|'user'|'assistant'|'tool'|'placeholder'; text?: string; key?: string; append?: boolean }> }
  // Legacy single-string template (JSON array string with optional Jinja) — still accepted
  template?: string
  vars?: Record<string, any>
  stream?: boolean
  options?: Record<string, any>
  // Legacy fields kept optional for compatibility (no longer used by editor)
  system?: string
  user?: string
  extras?: string[]
  jsonOutput?: boolean
  jsonSchema?: string
  retryOnError?: boolean
  maxRetries?: number
  retryIntervalSec?: number
  }
  // Tools transition (built-in or MCP)
  tools?: Array<{ name: string; config?: any }>
  // Retriever transition
  RetrieverProvider?: string
  RetrieverOptions?: Record<string,string>
  RetrieverQueryVar?: string
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
export type PetriEdgeData = { label?: string; expression?: string; readonly?: boolean; scriptLanguage?: string }

import type { Node } from "@xyflow/react"
export function isPlace(n: Node<PetriNodeData>) { return n.type === 'place' }
export function isTransition(n: Node<PetriNodeData>) { return n.type === 'transition' }
