"use client"
import React, { useState, useMemo, useEffect, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json as jsonLang } from '@codemirror/lang-json'
import { Button } from '@/components/ui/button'
import { Trash2, MoveUp, MoveDown, SquarePen, X, Wand2 } from 'lucide-react'
// Import the visual schema editor (pure builder) from jsonjoy-builder
// Adjust path if a different entrypoint is preferred later.
import SchemaVisualEditor from '@/jsonjoy-builder/src/components/SchemaEditor/SchemaVisualEditor'
import { SchemaInferencer } from '@/jsonjoy-builder/src/components/features/SchemaInferencer'
import type { JSONSchema } from '@/jsonjoy-builder/src/types/jsonSchema'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export interface DeclarationsValue {
  globref?: string[]
  color?: string[]
  lua?: string[]
  jsonSchemas?: { name: string; schema: any }[]
  // NOTE: batchOrdering / var removed from active use & emission (legacy fields retired)
}

interface DeclarationsPanelProps {
  value?: DeclarationsValue
  onApply: (next: DeclarationsValue) => void
  builtInColorSets: string[]
  disabled?: boolean
}

// Order: place jsonSchemas immediately after color per UX request
const CATEGORIES: { key: keyof DeclarationsValue; label: string; placeholder: string }[] = [
  { key: 'globref', label: 'Globref', placeholder: 'refVar = value' },
  { key: 'color', label: 'Color', placeholder: 'colset MYCOLOR = ...;' },
  { key: 'jsonSchemas', label: 'jsonSchema', placeholder: 'NewSchemaName' },
  { key: 'lua', label: 'Lua', placeholder: 'function f(x) return x end' },
]

export function DeclarationsPanel({ value, onApply, builtInColorSets, disabled }: DeclarationsPanelProps) {
  const [category, setCategory] = useState<keyof DeclarationsValue>('globref')
  const [filter, setFilter] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [lines, setLines] = useState<DeclarationsValue>(() => ({
    globref: value?.globref ? [...value.globref] : [],
    color: value?.color ? [...value.color] : [],
    lua: value?.lua ? [...value.lua] : [],
    jsonSchemas: value?.jsonSchemas ? value.jsonSchemas.map(js => ({ ...js })) : [],
  }))
  const [luaDraft, setLuaDraft] = useState('')
  const [showLuaEditor, setShowLuaEditor] = useState(false)
  // Per-schema JSON parse errors (index keyed)
  const [schemaErrors, setSchemaErrors] = useState<Record<number, string | undefined>>({})
  // Visual schema editor modal state
  const [schemaEditorIndex, setSchemaEditorIndex] = useState<number | null>(null)
  const [schemaDraft, setSchemaDraft] = useState<JSONSchema | null>(null)
  const [showInferencer, setShowInferencer] = useState(false)
  const [flashIndex, setFlashIndex] = useState<number | null>(null)
  const applyImmediateRef = useRef(false)
  const preserveEditRef = useRef(false)

  const currentList = category === 'jsonSchemas' ? (lines.jsonSchemas || []).map(js => js.name) : (lines[category] || [])
  // Preserve original indices even when values duplicate (e.g., empty new entries) so operations map correctly
  const filtered = useMemo(() => {
    const base = currentList.map((v, i) => ({ v, i }))
    if (filter.trim() === '') return base
    const lower = filter.toLowerCase()
    return base.filter(item => ('' + item.v).toLowerCase().includes(lower))
  }, [currentList, filter])

  function updateDraft(idx: number, text: string) {
    if (category === 'jsonSchemas') {
      preserveEditRef.current = true
      setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).map((js,i)=> i===idx? { ...js, name: text }: js) }))
    } else {
      preserveEditRef.current = true
      setLines(prev => ({ ...prev, [category]: (prev as any)[category]?.map((l: any, i: number) => i===idx ? text : l) }))
    }
  }
  function finishEdit() { setEditingIndex(null) }

  // Helper shallow equality compare to avoid unnecessary focus loss
  function eqArray(a?: any[], b?: any[]) {
    if (a===b) return true
    if (!a || !b) return (!a || a.length===0) && (!b || b.length===0)
    if (a.length !== b.length) return false
    for (let i=0;i<a.length;i++) if (a[i]!==b[i]) return false
    return true
  }
  function eqSchemas(a?: {name:string; schema:any}[], b?: {name:string; schema:any}[]) {
    if (a===b) return true
    if (!a || !b) return (!a || a.length===0) && (!b || b.length===0)
    if (a.length !== b.length) return false
    for (let i=0;i<a.length;i++) {
      if (a[i].name !== b[i].name) return false
      // schema reference compare first; fallback to JSON if needed
      if (a[i].schema !== b[i].schema) {
        try { if (JSON.stringify(a[i].schema) !== JSON.stringify(b[i].schema)) return false } catch { return false }
      }
    }
    return true
  }
  // Sync with external value when parent changes; preserve current edit if local mutation in progress
  useEffect(() => {
    const next = {
      globref: value?.globref ? [...value.globref] : [],
      color: value?.color ? [...value.color] : [],
      lua: value?.lua ? [...value.lua] : [],
      jsonSchemas: value?.jsonSchemas ? value.jsonSchemas.map(js => ({ ...js })) : [],
    }
    setLines(prev => {
      if (eqArray(prev.globref, next.globref) && eqArray(prev.color, next.color) && eqArray(prev.lua, next.lua) && eqSchemas(prev.jsonSchemas, next.jsonSchemas)) {
        return prev
      }
      return next
    })
    if (!preserveEditRef.current) {
      setEditingIndex(null)
    }
    preserveEditRef.current = false
  }, [value?.globref?.join('\n'), value?.color?.join('\n'), value?.lua?.join('\n'), value?.jsonSchemas?.length])

  // Auto-apply (debounced) after any lines mutation
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const push = () => {
      const cleaned: DeclarationsValue = {
        globref: [...(lines.globref||[])],
        color: [...(lines.color||[])],
        lua: [...(lines.lua||[])],
        jsonSchemas: (lines.jsonSchemas||[]).map(js => ({ ...js })),
      }
      onApply(cleaned)
    }
    if (applyImmediateRef.current) {
      applyImmediateRef.current = false
      push()
      return
    }
    const handle = setTimeout(push, 280)
    return () => clearTimeout(handle)
  }, [lines, onApply])

  // Clear flash highlight after short delay
  useEffect(() => {
    if (flashIndex==null) return
    const t = setTimeout(()=> setFlashIndex(null), 900)
    return () => clearTimeout(t)
  }, [flashIndex])
  function addLine() {
    if (category === 'jsonSchemas') {
      preserveEditRef.current = true
      setLines(prev => ({ ...prev, jsonSchemas: [...(prev.jsonSchemas||[]), { name: 'NewSchema', schema: { type: 'object' } }] }))
      setEditingIndex(currentList.length)
    } else {
      preserveEditRef.current = true
      setLines(prev => ({ ...prev, [category]: [...((prev as any)[category]||[]), ''] }))
      setEditingIndex(currentList.length)
    }
  }
  function deleteSelected(idxOverride?: number) {
    const idx = idxOverride ?? editingIndex
    if (idx==null) return
    if (category === 'jsonSchemas') {
      preserveEditRef.current = true
      setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).filter((_,i)=>i!==idx) }))
    } else {
      preserveEditRef.current = true
      setLines(prev => ({ ...prev, [category]: ((prev as any)[category]||[]).filter((_: any,i: number)=>i!==idx) }))
    }
    setFlashIndex(idx)
    if (editingIndex === idx) setEditingIndex(null)
    applyImmediateRef.current = true
  }
  function move(delta: number, idxOverride?: number) {
    const idx = idxOverride ?? editingIndex
    if (idx==null) return
    const arr = [...(category==='jsonSchemas' ? (lines.jsonSchemas||[]).map(js=>js.name) : (lines as any)[category]||[])]
    const target = idx + delta
    if (target < 0 || target >= arr.length) return
    const tmp = arr[idx]; arr[idx] = arr[target]; arr[target] = tmp
    if (category === 'jsonSchemas') {
      preserveEditRef.current = true
      setLines(prev => ({ ...prev, jsonSchemas: arr.map(name => (prev.jsonSchemas||[]).find(js=>js.name===name)!).filter(Boolean) }))
    } else {
      preserveEditRef.current = true
      setLines(prev => ({ ...prev, [category]: arr }))
    }
    setEditingIndex(target)
    setFlashIndex(target)
    applyImmediateRef.current = true
  }
  // apply() removed – changes are auto-applied

  function updateSchema(idx: number, text: string) {
    try {
      const parsed = JSON.parse(text)
      preserveEditRef.current = true
      setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).map((js,i)=> i===idx ? { ...js, schema: parsed } : js) }))
      setSchemaErrors(prev => { const next = { ...prev }; delete next[idx]; return next })
    } catch(e:any) {
      setSchemaErrors(prev => ({ ...prev, [idx]: e.message }))
    }
  }

  function deleteSchema(idx: number) {
    preserveEditRef.current = true
    setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).filter((_,i)=>i!==idx) }))
    setFlashIndex(idx)
    setSchemaErrors(prev => {
      const next = { ...prev }
      // Re-index errors after removal
      const reordered: Record<number, string | undefined> = {}
      Object.entries(next).forEach(([k,v]) => {
        const n = parseInt(k,10)
        if (n < idx) reordered[n] = v
        else if (n > idx) reordered[n-1] = v
      })
      return reordered
    })
    applyImmediateRef.current = true
  }

  function reorderSchema(from: number, to: number) {
    if (to < 0) return
    setLines(prev => {
      const arr = [...(prev.jsonSchemas||[])]
      if (to >= arr.length) return prev
      const [item] = arr.splice(from,1)
      arr.splice(to,0,item)
      preserveEditRef.current = true
      return { ...prev, jsonSchemas: arr }
    })
    setFlashIndex(to)
    setSchemaErrors(prev => {
      // best-effort move error association
      const next: Record<number,string|undefined> = {}
      Object.entries(prev).forEach(([k,v]) => {
        const n = parseInt(k,10)
        if (n === from) next[to] = v
        else if (from < to && n > from && n <= to) next[n-1] = v
        else if (from > to && n >= to && n < from) next[n+1] = v
        else next[n] = v
      })
      return next
    })
    applyImmediateRef.current = true
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <Button key={c.key} size="sm" variant={category===c.key? 'default':'outline'} onClick={() => { setCategory(c.key); setEditingIndex(null) }}>{c.label}</Button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={addLine} disabled={disabled}>+ New</Button>
          {category !== 'jsonSchemas' && (
            <>
              <Button size="icon" variant="ghost" aria-label="Delete" onMouseDown={(e)=>{ e.preventDefault(); deleteSelected(editingIndex!=null? editingIndex: undefined) }} disabled={disabled || editingIndex==null} className="h-7 w-7 text-red-600 disabled:opacity-40">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Move up" onMouseDown={(e)=>{ e.preventDefault(); move(-1, editingIndex!=null? editingIndex: undefined) }} disabled={disabled || editingIndex==null} className="h-7 w-7 disabled:opacity-40">
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Move down" onMouseDown={(e)=>{ e.preventDefault(); move(1, editingIndex!=null? editingIndex: undefined) }} disabled={disabled || editingIndex==null} className="h-7 w-7 disabled:opacity-40">
                <MoveDown className="h-4 w-4" />
              </Button>
            </>
          )}
          {category==='lua' && (
            <Button size="sm" variant="outline" onClick={() => { setLuaDraft(editingIndex!=null ? (currentList[editingIndex]||'') : ''); setShowLuaEditor(true) }}>Lua Editor</Button>
          )}
          {/* Apply button removed: auto-save in effect */}
        </div>
      </div>
      {category !== 'jsonSchemas' && (
        <>
          <div className="flex items-center gap-2">
            <Input placeholder="Filter..." value={filter} onChange={e=>setFilter(e.target.value)} className="h-8" />
            <span className="text-xs text-neutral-500">{filtered.length}/{currentList.length}</span>
          </div>
          <div className="rounded border divide-y max-h-72 overflow-auto" role="listbox">
            {filtered.length===0 && (
              <div className="p-2 text-xs text-neutral-400">No entries</div>
            )}
            {filtered.map(({ v: line, i: realIdx }) => {
              const isEditing = editingIndex === realIdx
              return (
                <div
                  key={realIdx}
                  role="option"
                  aria-selected={isEditing}
                  className={cn(
                    "px-2 py-1 text-xs cursor-pointer hover:bg-neutral-50 transition-colors",
                    isEditing && 'bg-emerald-50',
                    flashIndex===realIdx && 'bg-amber-50'
                  )}
                  onClick={() => setEditingIndex(realIdx)}
                >
                  {isEditing ? (
                    category === 'lua' ? (
                      <Textarea
                        autoFocus
                        rows={2}
                        className="text-xs"
                        value={line as any}
                        placeholder={CATEGORIES.find(c => c.key === category)?.placeholder}
                        onChange={e => updateDraft(realIdx, e.target.value)}
                        onBlur={finishEdit}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { finishEdit() } }}
                      />
                    ) : (
                      <Input
                        autoFocus
                        className="h-6 text-xs"
                        value={line as any}
                        placeholder={CATEGORIES.find(c => c.key === category)?.placeholder}
                        onChange={e => updateDraft(realIdx, e.target.value)}
                        onBlur={finishEdit}
                        onKeyDown={e => { if (e.key === 'Enter') finishEdit(); if (e.key === 'Escape') finishEdit() }}
                      />
                    )
                  ) : (
                    <span className="whitespace-pre-wrap break-words">{line || <span className="text-neutral-300 italic">(empty)</span>}</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
      {category === 'jsonSchemas' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input placeholder="Filter schemas..." value={filter} onChange={e=>setFilter(e.target.value)} className="h-8" />
            <span className="text-xs text-neutral-500">{(lines.jsonSchemas||[]).filter(s=>s.name.toLowerCase().includes(filter.toLowerCase())).length}/{lines.jsonSchemas?.length||0}</span>
          </div>
          {(lines.jsonSchemas||[]).filter(s=>s.name.toLowerCase().includes(filter.toLowerCase())).length===0 && (
            <div className="text-xs text-neutral-400">No schemas</div>
          )}
          {(lines.jsonSchemas||[]).filter(s=>s.name.toLowerCase().includes(filter.toLowerCase())).map((js, i, arr) => (
            <div key={i} className={cn("border rounded p-2 space-y-2 bg-neutral-50 transition-colors", flashIndex===i && 'ring-2 ring-amber-300')}> 
              <div className="flex items-center gap-2">
                <Input
                  className="h-7 text-xs w-48"
                  value={js.name}
                  onChange={e=> setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).map((o,idx)=> idx===i? { ...o, name: e.target.value }: o) }))}
                  placeholder="Schema name"
                />
                <Button size="icon" variant="ghost" onClick={()=>deleteSchema(i)} aria-label="Delete schema" className="h-7 w-7 text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={i===0} onClick={()=>reorderSchema(i, i-1)} aria-label="Move schema up" className="h-7 w-7">
                  <MoveUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={i===arr.length-1} onClick={()=>reorderSchema(i, i+1)} aria-label="Move schema down" className="h-7 w-7">
                  <MoveDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Edit schema visually" className="h-7 w-7" onClick={()=>{
                  setSchemaEditorIndex(i)
                  try {
                    setSchemaDraft(js.schema as JSONSchema)
                  } catch {
                    setSchemaDraft({})
                  }
                }}>
                  <SquarePen className="h-4 w-4" />
                </Button>
              </div>
              <CodeMirror
                value={JSON.stringify(js.schema, null, 2)}
                height="200px"
                extensions={[jsonLang()]}
                onChange={val=> updateSchema(i, val)}
              />
              {schemaErrors[i] && <div className="text-xs text-red-600">{schemaErrors[i]}</div>}
              {!schemaErrors[i] && <div className="text-[10px] text-neutral-500">Valid JSON</div>}
            </div>
          ))}
        </div>
      )}
      {showLuaEditor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="w-[560px] max-h-[80vh] rounded-md border bg-white shadow-lg flex flex-col">
            <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">Lua Entry Editor
              <Button size="sm" variant="ghost" onClick={()=>setShowLuaEditor(false)}>Close</Button>
            </div>
            <div className="p-3 space-y-2 overflow-auto">
              <Textarea rows={14} value={luaDraft} onChange={e=>setLuaDraft(e.target.value)} className="text-xs font-mono" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => {
                  if (editingIndex!=null) {
                    updateDraft(editingIndex, luaDraft)
                    finishEdit()
                  } else {
                    setLines(prev => ({ ...prev, lua: [...(prev.lua||[]), luaDraft] }))
                  }
                  setShowLuaEditor(false)
                }}>Apply</Button>
                <Button size="sm" variant="outline" onClick={()=>setShowLuaEditor(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {category==='color' && (
        <div className="text-[10px] text-neutral-500">Built-ins: {builtInColorSets.join(', ')} (not persisted)</div>
      )}
      {schemaEditorIndex!=null && schemaDraft && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40">
          <div className="w-[780px] max-h-[85vh] rounded-md border bg-white shadow-lg flex flex-col">
            <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
              <div className="flex items-center gap-3">
                <span>Edit Schema: {(lines.jsonSchemas||[])[schemaEditorIndex]?.name || 'Unnamed'}</span>
                <Button size="sm" variant="outline" onClick={()=> setShowInferencer(true)} className="flex items-center gap-1" aria-label="Infer from JSON sample">
                  <Wand2 className="h-4 w-4" /> Infer
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={()=>{ setSchemaEditorIndex(null); setSchemaDraft(null); setShowInferencer(false) }}>Cancel</Button>
                <Button size="sm" onClick={()=>{
                  setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).map((o,i)=> i===schemaEditorIndex ? { ...o, schema: schemaDraft }: o) }))
                  setSchemaEditorIndex(null); setSchemaDraft(null); setShowInferencer(false)
                  applyImmediateRef.current = true
                }}>Apply</Button>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={()=>{ setSchemaEditorIndex(null); setSchemaDraft(null); setShowInferencer(false) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <SchemaVisualEditor schema={schemaDraft as any} onChange={(next)=> setSchemaDraft(next as any)} />
            </div>
          </div>
        </div>
      )}
      {showInferencer && schemaEditorIndex!=null && (
        <SchemaInferencer
          open={showInferencer}
            onOpenChange={(open)=> setShowInferencer(open)}
            onSchemaInferred={(s)=> {
              setSchemaDraft(s as any)
            }}
        />
      )}
      <Separator />
      <div className="text-[10px] text-neutral-400 leading-relaxed">
        Changes are auto-applied locally. Use the main Save Workflow button to persist to the server.
      </div>
    </div>
  )
}
