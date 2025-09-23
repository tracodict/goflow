"use client"
import React, { useMemo } from 'react'
import { JsonForms } from '@jsonforms/react'
// @ts-ignore
import { vanillaRenderers, vanillaCells } from '@jsonforms/vanilla-renderers'
import { shadcnRenderers, shadcnCells } from '@/components/run/forms/renderers'
import Ajv from 'ajv'
// Ajv does not automatically register draft-07 under the https variant; load and add explicitly.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - json import
import draft7MetaSchema from 'ajv/dist/refs/json-schema-draft-07.json'

export interface DynamicFormProps {
  schema: any
  data: any
  onChange: (data: any) => void
  uiSchema?: any
  readOnly?: boolean
}

function buildAutoUiSchema(schema: any, readOnly?: boolean) {
  if (!schema) return undefined
  if (schema.type === 'object' && schema.properties) {
    const elements = Object.keys(schema.properties).map(k => {
      const prop: any = schema.properties[k]
      const t = prop?.type
      const isArray = t === 'array'
      const isDate = (t === 'string' && (prop?.format === 'date' || prop?.format === 'date-time'))
      const isObject = t === 'object'
      return {
        type: 'Control',
        scope: `#/properties/${k}`,
        options: {
          ...(isDate ? { date: true } : {}),
          ...(isArray ? { fullWidth: true } : {}),
            ...(isObject ? { fullWidth: true, lazyObject: true } : {}),
            ...(readOnly ? { readonly: true } : {})
        }
      }
    })
    return { type: 'VerticalLayout', options: { grid: 'responsive', columns: { sm: 1, md: 3, lg: 5 } }, elements }
  }
  if (schema.type && schema.type !== 'object') {
    return { type: 'Control', scope: '#', options: readOnly ? { readonly: true } : undefined }
  }
  return undefined
}

// Singleton AJV instance to avoid repeated meta-schema registrations.
let sharedAjv: Ajv | null = null
function getAjv() {
  if (sharedAjv) return sharedAjv
  const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true })
  // Register draft-07 meta-schema with both http/https ids to satisfy schemas using either.
  const ids = [
    'http://json-schema.org/draft-07/schema',
    'http://json-schema.org/draft-07/schema#',
    'https://json-schema.org/draft-07/schema',
    'https://json-schema.org/draft-07/schema#'
  ]
  const already = ajv.getSchema(ids[0]) || ajv.getSchema(ids[2])
  if (!already) {
    try {
      ajv.addMetaSchema(draft7MetaSchema as any)
      ids.forEach(id => {
        if (!ajv.getSchema(id)) ajv.addSchema(draft7MetaSchema as any, id)
      })
    } catch (_e) {
      // ignore if already added or incompatible; schemas without $schema will still work
    }
  }
  sharedAjv = ajv
  return ajv
}

function normalizeSchema(schema: any): any {
  if (!schema) return schema
  if (typeof schema !== 'object') return schema
  // Shallow clone first to avoid mutating caller's object
  const cloned: any = Array.isArray(schema) ? schema.map(s => normalizeSchema(s)) : { ...schema }
  // Always strip $schema to avoid external meta lookups; AJV already has draft-07 registered.
  if (cloned.$schema) delete cloned.$schema
  // Ensure object schemas have properties to make UI generation predictable
  if (cloned.type === 'object' && cloned.properties == null) {
    cloned.properties = {}
  }
  if (cloned.definitions) {
    const defs: any = {}
    Object.entries(cloned.definitions).forEach(([k, v]) => { defs[k] = normalizeSchema(v) })
    cloned.definitions = defs
  }
  if (cloned.properties) {
    const props: any = {}
    Object.entries(cloned.properties).forEach(([k, v]) => { props[k] = normalizeSchema(v) })
    cloned.properties = props
  }
  if (cloned.items) cloned.items = normalizeSchema(cloned.items)
  return cloned
}

// Simple error boundary so schema problems don't cascade into opaque React internal errors
class SimpleBoundary extends React.Component<{ children: any }, { err: any }> {
  constructor(props:any){ super(props); this.state = { err: null } }
  static getDerivedStateFromError(err:any){ return { err } }
  render(){
    if (this.state.err) {
      return <div className="text-xs text-red-600 border rounded p-2 bg-red-50">Schema render error: {String(this.state.err?.message||this.state.err)}</div>
    }
    return this.props.children
  }
}

export const DynamicForm: React.FC<DynamicFormProps> = ({ schema, data, onChange, uiSchema, readOnly }) => {
  const ajv = useMemo(() => getAjv(), [])
  const preparedSchema = useMemo(() => normalizeSchema(schema) || { type: 'object', properties: {} }, [schema])
  const effectiveUi = useMemo(() => uiSchema || buildAutoUiSchema(preparedSchema, readOnly), [uiSchema, preparedSchema, readOnly])
  return (
    <SimpleBoundary>
      <JsonForms
        schema={preparedSchema}
        uischema={effectiveUi as any}
        data={data}
        renderers={[...shadcnRenderers, ...vanillaRenderers]}
        cells={[...shadcnCells, ...vanillaCells]}
        onChange={(ev: any) => onChange(ev.data)}
        ajv={ajv as any}
      />
    </SimpleBoundary>
  )
}

export function inferPrimitiveSchema(value: any): any {
  if (value == null) return { type: 'string' }
  if (Array.isArray(value)) return { type: 'array' }
  const t = typeof value
  if (t === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number' }
  if (t === 'boolean') return { type: 'boolean' }
  if (t === 'object') {
    const props: any = {}
    Object.keys(value).forEach(k => {
      const vt = typeof value[k]
      if (value[k] !== null && typeof value[k] === 'object' && !Array.isArray(value[k])) {
        props[k] = { type: 'object' }
      } else if (Array.isArray(value[k])) props[k] = { type: 'array' }
      else if (vt === 'number') props[k] = { type: Number.isInteger(value[k]) ? 'integer' : 'number' }
      else if (vt === 'boolean') props[k] = { type: 'boolean' }
      else props[k] = { type: 'string' }
    })
    return { type: 'object', properties: props }
  }
  return { type: 'string' }
}
