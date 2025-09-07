"use client"
import React, { useMemo } from 'react'
import { JsonForms } from '@jsonforms/react'
// @ts-ignore
import { vanillaRenderers, vanillaCells } from '@jsonforms/vanilla-renderers'
import { shadcnRenderers, shadcnCells } from '@/components/run/forms/renderers'

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

export const DynamicForm: React.FC<DynamicFormProps> = ({ schema, data, onChange, uiSchema, readOnly }) => {
  const effectiveUi = useMemo(() => uiSchema || buildAutoUiSchema(schema, readOnly), [uiSchema, schema, readOnly])
  return (
    <JsonForms
      schema={schema || { type: 'object', properties: {} }}
      uischema={effectiveUi as any}
      data={data}
      renderers={[...shadcnRenderers, ...vanillaRenderers]}
      cells={[...shadcnCells, ...vanillaCells]}
      onChange={(ev: any) => onChange(ev.data)}
    />
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
