// Shared utilities for manual transition dynamic form handling (Run & Simulation)
// Centralizes: safe JSON parse, schema inference from sample data, binding extraction,
// effective schema resolution (embedded -> pre-supported fetch -> inference), and
// optional sample derivation from incoming place tokens (simulation fallback).

import { fetchPreSupportedSchema } from '@/components/petri/pre-supported-schemas'

export type SchemaInfo = { name?: string; schema: any; ui?: any }

export function safeParseJSON(txt: string | null | undefined): any {
  if (!txt || typeof txt !== 'string') return null
  try { return JSON.parse(txt) } catch { return null }
}

// Heuristic JSON Schema inference from a sample value.
export function inferSchemaFromSample(sample: any): any {
  if (sample == null) return { type: 'string' }
  if (typeof sample === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(sample)) return { type: 'string', format: 'date' }
    return { type: 'string' }
  }
  if (typeof sample === 'number') return { type: Number.isInteger(sample) ? 'integer' : 'number' }
  if (typeof sample === 'boolean') return { type: 'boolean' }
  if (Array.isArray(sample)) {
    const first = sample[0]
    return { type: 'array', items: inferSchemaFromSample(first) }
  }
  if (typeof sample === 'object') {
    const props: Record<string, any> = {}
    Object.entries(sample).forEach(([k,v]) => { props[k] = inferSchemaFromSample(v) })
    return { type: 'object', properties: props }
  }
  return { type: 'string' }
}

// Extract binding value & optional variable name when binding is shape { varName: value }
export function extractBindingValue(binding: any): { value: any; variableName?: string } {
  if (binding && typeof binding === 'object' && !Array.isArray(binding)) {
    const keys = Object.keys(binding)
    if (keys.length === 1) {
      const k = keys[0]
      return { value: (binding as any)[k], variableName: k }
    }
  }
  return { value: binding }
}

// Resolve effective schema priority chain:
// 1) Embedded schema body (schemaInfo.schema)
// 2) Pre-supported schema fetched by name (dictionary service)
// 3) Inferred from sample value
export async function computeEffectiveSchema(schemaInfo: SchemaInfo, sampleValue: any, dictionaryUrl: string): Promise<any> {
  let eff = schemaInfo?.schema
  const name = schemaInfo?.name
  if (!eff && name) {
    try {
      const fetched = await fetchPreSupportedSchema(name, dictionaryUrl)
      if (fetched) eff = fetched
    } catch { /* ignore fetch errors – fall back to inference */ }
  }
  if (!eff) eff = inferSchemaFromSample(sampleValue)
  return eff
}

// Simulation-only helper: derive a sample value from first token of first incoming place
// if no binding was supplied.
export function deriveSampleFromIncomingPlaces(transition: any, nodes: any[], edges: any[]): any {
  try {
    const tid = transition.id || transition.transitionId
    const incomingPlaceIds = edges.filter((e: any) => e.target === tid).map((e: any) => e.source)
    for (const pid of incomingPlaceIds) {
      const placeNode = nodes.find(n => n.id === pid && n.type === 'place') as any
      if (placeNode && Array.isArray(placeNode.data?.tokenList) && placeNode.data.tokenList.length) {
        const t0 = placeNode.data.tokenList[0]
        return t0?.data ?? t0?.value ?? t0
      }
    }
  } catch {/* ignore */}
  return null
}
