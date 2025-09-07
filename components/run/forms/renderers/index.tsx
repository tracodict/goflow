"use client"
// Shadcn/Radix/Tailwind based JSON Forms renderers mimicking vanilla set
// Minimal initial set: string, number/integer, boolean, enum(select), multiline(textarea)
// Can be extended later (arrays, objects, categorization, groups)

import React from 'react'
import '@/styles/ag-grid-custom.css'
// @ts-ignore - jsonforms types may not yet be available
import {
  rankWith,
  isStringControl,
  isNumberControl,
  isIntegerControl,
  isBooleanControl,
  isEnumControl,
  and,
  optionIs,
  schemaMatches,
  RankedTester,
  ControlProps
} from '@jsonforms/core'
// @ts-ignore - jsonforms types may not yet be available
import { withJsonFormsControlProps, withJsonFormsLayoutProps, JsonFormsDispatch } from '@jsonforms/react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Calendar as CalendarIcon, Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { ColDef, GridApi } from 'ag-grid-community'
import AgGridWrapper from '@/components/ui/ag-grid-wrapper'

// ---------- Helpers ----------

function errorExtractor(errors?: string | string[]) {
  if (!errors) return undefined
  return Array.isArray(errors) ? errors.filter(Boolean).join(', ') : errors
}

const ControlWrapper: React.FC<React.PropsWithChildren<{ label?: string; required?: boolean; description?: string; errors?: string; hidden?: boolean }>> = ({
  label,
  required,
  description,
  errors,
  hidden,
  children
}) => {
  if (hidden) return null
  return (
    <div className="flex flex-col gap-1 mb-3 text-sm">
      {label && (
        <Label className="text-xs font-medium">
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      {children}
      {description && <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>}
      {errors && <p className="text-[11px] text-destructive leading-snug">{errors}</p>}
    </div>
  )
}

// ---------- Individual Controls ----------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const StringControl: React.FC<ControlProps> = (props) => {
  const { data, handleChange, path, label, required, description, errors, visible, uischema, schema } = props
  // If schema not marked as date but current value matches date format, we render DateControl instead
  if ((schema as any)?.type === 'string' && !schema.format && typeof data === 'string' && ISO_DATE_RE.test(data)) {
    // delegate to DateControl logic by forging format
    const dateSchema = { ...schema, format: 'date' }
    return <DateControl {...props} schema={dateSchema as any} />
  }
  const multi = (uischema as any)?.options?.multi || schema.format === 'multi-line'
  const errorText = errorExtractor(errors)
  const Comp = multi ? Textarea : Input
  return (
    <ControlWrapper label={label} required={required} description={description} errors={errorText} hidden={visible === false}>
      <Comp
        value={data ?? ''}
        onChange={(e: any) => handleChange(path, e.target.value)}
        className={cn(errorText && 'aria-invalid')}
        aria-invalid={!!errorText}
      />
    </ControlWrapper>
  )
}

const NumberControl: React.FC<ControlProps> = (props) => {
  const { data, handleChange, path, label, required, description, errors, visible, schema } = props
  const errorText = errorExtractor(errors)
  return (
    <ControlWrapper label={label} required={required} description={description} errors={errorText} hidden={visible === false}>
      <Input
        type="number"
        value={data ?? ''}
        onChange={(e: any) => {
          const raw = e.target.value
          if (raw === '') return handleChange(path, undefined)
          const v = schema.type === 'integer' ? parseInt(raw, 10) : parseFloat(raw)
          handleChange(path, isNaN(v) ? undefined : v)
        }}
        className={cn(errorText && 'aria-invalid')}
        aria-invalid={!!errorText}
      />
    </ControlWrapper>
  )
}

const BooleanControl: React.FC<ControlProps> = (props) => {
  const { data, handleChange, path, label, required, description, errors, visible } = props
  const errorText = errorExtractor(errors)
  return (
    <ControlWrapper label={label} required={required} description={description} errors={errorText} hidden={visible === false}>
      <div className="flex items-center gap-2">
        <Checkbox checked={!!data} onCheckedChange={(v: any) => handleChange(path, !!v)} />
      </div>
    </ControlWrapper>
  )
}

const EnumControl: React.FC<ControlProps> = (props) => {
  const { data, handleChange, path, label, required, description, errors, visible, schema } = props
  const errorText = errorExtractor(errors)
  const options: any[] = (schema as any)?.enum || []
  return (
    <ControlWrapper label={label} required={required} description={description} errors={errorText} hidden={visible === false}>
      <Select value={data ?? ''} onValueChange={(val) => handleChange(path, val)}>
        <SelectTrigger className={cn('w-full', errorText && 'aria-invalid')} aria-invalid={!!errorText}>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ControlWrapper>
  )
}

// Date Control (string with format 'date' or option date: true) with manual input + calendar picker
const DateControl: React.FC<ControlProps> = (props) => {
  const { data, handleChange, path, label, required, description, errors, visible, schema, uischema, enabled = true } = props
  const errorText = errorExtractor(errors)
  const isDate = schema.format === 'date' || (uischema as any)?.options?.date
  if (!isDate) return null
  const str = typeof data === 'string' ? data : ''
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T00:00:00') : undefined
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  return (
    <ControlWrapper label={label} required={required} description={description} errors={errorText} hidden={visible === false}>
      <div className="flex gap-2 items-start">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              type="button"
              disabled={!enabled}
              className={cn('shrink-0 w-36 justify-start font-normal', !parsed && 'text-muted-foreground', errorText && 'aria-invalid')}
              aria-invalid={!!errorText}
            >
              <CalendarIcon className="mr-2 size-4" />
              {parsed ? fmt(parsed) : 'Pick date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0" align="start">
            <Calendar
              mode="single"
              selected={parsed}
              onSelect={(d: any) => handleChange(path, d ? fmt(d) : undefined)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Input
          type="date"
          value={parsed ? fmt(parsed) : ''}
          onChange={e => {
            const v = e.target.value
            if (!v) return handleChange(path, undefined)
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) handleChange(path, v)
          }}
          disabled={!enabled}
          className={cn('w-full', errorText && 'aria-invalid')}
          aria-invalid={!!errorText}
        />
        {!!str && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!enabled}
            onClick={() => handleChange(path, undefined)}
            className="shrink-0"
            aria-label="Clear date"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </ControlWrapper>
  )
}

// Array Control with ag-grid (full width). Supports primitive and object item schemas.
const ArrayControl: React.FC<ControlProps> = (props) => {
  const { data, handleChange, path, label, required, description, errors, visible, schema } = props
  if (schema.type !== 'array') return null
  const errorText = errorExtractor(errors)
  const itemsSchema: any = schema.items || {}
  const rows: any[] = Array.isArray(data) ? data : []
  const gridRef = React.useRef<{ api: GridApi | null }>({ api: null })

  // Derive column definitions
  let columnDefs: ColDef[]
  if (itemsSchema.type === 'object') {
    const keys = Object.keys(itemsSchema.properties || {})
    columnDefs = keys.map(k => ({ field: k, editable: true, resizable: true, filter: true, sortable: true }))
  } else {
    columnDefs = [{ headerName: 'Value', field: 'value', editable: true, resizable: true }]
  }
  columnDefs.push({
    headerName: '', field: '__actions', width: 60, cellRenderer: (p: any) => {
      return React.createElement('button', {
        type: 'button',
        className: 'text-destructive text-xs underline',
        onClick: () => removeRow(p.rowIndex)
      }, 'Del')
    }
  })

  const setRows = (newRows: any[]) => handleChange(path, newRows)

  const addRow = () => {
    let newItem: any
    if (itemsSchema.type === 'object') {
      newItem = {}
      Object.keys(itemsSchema.properties || {}).forEach(k => { newItem[k] = undefined })
    } else if (itemsSchema.type === 'string') newItem = ''
    else if (itemsSchema.type === 'number' || itemsSchema.type === 'integer') newItem = 0
    else if (itemsSchema.type === 'boolean') newItem = false
    else newItem = null
    setRows([...(rows||[]), newItem])
  }
  const removeRow = (idx: number) => {
    const copy = rows.slice()
    copy.splice(idx,1)
    setRows(copy)
  }
  const onCellValueChanged = (params: any) => {
    const updated = [...rows]
    if (itemsSchema.type === 'object') {
      updated[params.rowIndex] = { ...updated[params.rowIndex], [params.colDef.field]: params.newValue }
    } else {
      updated[params.rowIndex] = params.newValue
    }
    setRows(updated)
  }

  const rowData = React.useMemo(() => {
    if (itemsSchema.type === 'object') return rows
    return rows.map(r => ({ value: r }))
  }, [rows, itemsSchema.type])

  return (
    <div className="col-span-full">
      <ControlWrapper label={label} required={required} description={description} errors={errorText} hidden={visible === false}>
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="size-4" />Add</Button>
          </div>
          <AgGridWrapper
            rowData={rowData}
            columnDefs={columnDefs}
            autoHeight
            containerClassName="w-full min-h-40 border rounded-md overflow-hidden"
            stopEditingWhenCellsLoseFocus
            onCellValueChanged={onCellValueChanged}
            suppressDragLeaveHidesColumns
            reactiveCustomComponents
          />
        </div>
      </ControlWrapper>
    </div>
  )
}

// Lazy collapsible object control (one level deep). Only expands & infers child schema on first open.
const LazyObjectControl: React.FC<ControlProps> = (props) => {
  const { data, handleChange, path, label, required, description, errors, visible, schema, enabled = true, renderers, cells, rootSchema } = props as any
  if (schema.type !== 'object') return null
  const errorText = errorExtractor(errors)
  const [open, setOpen] = React.useState(false)
  const [localSchema, setLocalSchema] = React.useState<any>(schema)
  const initialized = !!localSchema.properties

  const inferProps = React.useCallback(() => {
    if (localSchema.properties) return
    const v = data && typeof data === 'object' ? data : {}
    const props: any = {}
    Object.keys(v).forEach(k => {
      const val = v[k]
      let t: string = Array.isArray(val) ? 'array' : typeof val
      if (val === null || t === 'undefined') t = 'string'
      if (t === 'number' && Number.isInteger(val)) t = 'integer'
      if (t === 'object' && val && !Array.isArray(val)) t = 'object'
      props[k] = { type: t }
    })
    setLocalSchema((s: any) => ({ ...s, properties: props }))
  }, [data, localSchema])

  const toggle = () => {
    setOpen(o => !o)
    if (!initialized) inferProps()
    if (data === undefined) handleChange(path, {})
  }

  const childUi = React.useMemo(() => {
    const props = localSchema.properties || {}
    return {
      type: 'VerticalLayout',
      options: { grid: 'responsive' },
      elements: Object.keys(props).map(k => ({ type: 'Control', scope: `#/properties/${k}` }))
    }
  }, [localSchema.properties])

  return (
    <div className="col-span-full">
      <ControlWrapper label={label} required={required} description={description} errors={errorText} hidden={visible === false}>
        <div className="border rounded-md overflow-hidden">
          <button type="button" onClick={toggle} disabled={!enabled} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm bg-neutral-50 hover:bg-neutral-100 disabled:opacity-50" aria-expanded={open}>
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            <span className="font-medium truncate">{label || path.split('/').slice(-1)[0] || 'Object'}</span>
            {!initialized && <span className="ml-2 text-[10px] text-neutral-500">lazy</span>}
          </button>
          {open && (
            <div className="p-3 pt-2 border-t bg-white">
              <JsonFormsDispatch
                uischema={childUi}
                schema={localSchema}
                path={path}
                renderers={renderers}
                cells={cells}
              />
            </div>
          )}
        </div>
      </ControlWrapper>
    </div>
  )
}

// With HOCs
const ShadcnStringControl = withJsonFormsControlProps(StringControl)
const ShadcnNumberControl = withJsonFormsControlProps(NumberControl)
const ShadcnBooleanControl = withJsonFormsControlProps(BooleanControl)
const ShadcnEnumControl = withJsonFormsControlProps(EnumControl)
const ShadcnDateControl = withJsonFormsControlProps(DateControl)
const ShadcnArrayControl = withJsonFormsControlProps(ArrayControl)
const ShadcnLazyObjectControl = withJsonFormsControlProps(LazyObjectControl)

// ---------- Responsive Grid Layout ----------
// uischema example: { type: 'VerticalLayout', options: { grid: 'responsive', columns: { sm:1, md:3, lg:5 } }, elements:[ ... ] }
// element-specific span: element.options.span = { sm:1, md:2, lg:3 }
// Tailwind classes rely on standard col-span-* utilities.

// @ts-ignore
interface LayoutProps { uischema: any; schema: any; path: string; renderers?: any; cells?: any; visible?: boolean }

const ResponsiveGridLayout: React.FC<LayoutProps> = ({ uischema, schema, path, renderers, cells, visible }) => {
  if (visible === false) return null
  // columns options ignored (fixed 1/3/5 responsive grid); leave code minimal
  // Fixed responsive grid (1 / 3 / 5) for non-fullWidth controls
  const gridCls = 'grid gap-4 grid-cols-1 md:grid-cols-3 lg:grid-cols-5'
  const elements = uischema?.elements || []
  return (
    <div className={gridCls}>
      {elements.map((el: any, i: number) => {
        const span = el?.options?.span || {}
        let fullWidth = el?.options?.fullWidth
        // Heuristic: if not explicitly set, treat object/array scopes as full width
        if (!fullWidth && el?.scope && typeof el.scope === 'string') {
          const match = el.scope.match(/#\/properties\/([^/]+)/)
          if (match && schema?.properties?.[match[1]] && ['object','array'].includes(schema.properties[match[1]].type)) {
            fullWidth = true
          }
        }
        let spanCls = ''
  if (fullWidth) spanCls = 'col-span-full'
        else {
          spanCls = [
            span.sm && `col-span-${span.sm}`,
            span.md && `md:col-span-${span.md}`,
            span.lg && `lg:col-span-${span.lg}`
          ].filter(Boolean).join(' ')
        }
        return (
          <div key={i} className={spanCls}>
            <JsonFormsDispatch
              uischema={el}
              schema={schema}
              path={path}
              renderers={renderers}
              cells={cells}
            />
          </div>
        )
      })}
    </div>
  )
}

const ShadcnResponsiveGridLayout = withJsonFormsLayoutProps(ResponsiveGridLayout)

// ---------- Testers (ranking similar to vanilla) ----------

// string tester (rank 3). Date fields still overridden by dateTester (rank 6).
// Removed optionIs('format', undefined) because it prevented matching plain string controls.
const stringTester: RankedTester = rankWith(3, isStringControl)
const multilineTester: RankedTester = rankWith(4, and(isStringControl, optionIs('multi', true)))
const enumTester: RankedTester = rankWith(5, isEnumControl)
const dateTester: RankedTester = rankWith(6, (uischema: any, schema: any) => (schema?.type === 'string' && schema?.format === 'date') || uischema?.options?.date === true)
// Array tester using schemaMatches so the resolved subschema (not root) is checked
const arrayTester: RankedTester = rankWith(7, schemaMatches((s: any) => (s as any)?.type === 'array'))
const lazyObjectTester: RankedTester = rankWith(6, schemaMatches((s: any) => (s as any)?.type === 'object'))
const numberTester: RankedTester = rankWith(3, isNumberControl)
const integerTester: RankedTester = rankWith(3, isIntegerControl)
const booleanTester: RankedTester = rankWith(3, isBooleanControl)
// When schema.format === 'multi-line'
const formatMultilineTester: RankedTester = rankWith(4, and(isStringControl, schemaMatches((s: any) => (s as any)?.format === 'multi-line')))
// Layout tester (higher rank to win over default vertical layout)
const responsiveLayoutTester: RankedTester = rankWith(10, (uischema: any) => uischema?.type === 'VerticalLayout' && uischema?.options?.grid === 'responsive')

// Export arrays replicating vanilla style API
export const shadcnRenderers = [
  { tester: responsiveLayoutTester, renderer: ShadcnResponsiveGridLayout },
  { tester: lazyObjectTester, renderer: ShadcnLazyObjectControl },
  { tester: arrayTester, renderer: ShadcnArrayControl },
  { tester: dateTester, renderer: ShadcnDateControl },
  { tester: enumTester, renderer: ShadcnEnumControl },
  { tester: multilineTester, renderer: ShadcnStringControl },
  { tester: formatMultilineTester, renderer: ShadcnStringControl },
  { tester: stringTester, renderer: ShadcnStringControl },
  { tester: numberTester, renderer: ShadcnNumberControl },
  { tester: integerTester, renderer: ShadcnNumberControl },
  { tester: booleanTester, renderer: ShadcnBooleanControl },
]

// Cells (fallback: use same controls). Keeping minimal for now.
export const shadcnCells = []

export default {
  shadcnRenderers,
  shadcnCells
}
