"use client"
import React, { useState, useMemo, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json as jsonLang } from '@codemirror/lang-json'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export interface DeclarationsValue {
  batchOrdering?: string[]
  globref?: string[]
  color?: string[]
  var?: string[]
  lua?: string[]
  jsonSchemas?: { name: string; schema: any }[]
}

interface DeclarationsPanelProps {
  value?: DeclarationsValue
  onApply: (next: DeclarationsValue) => void
  builtInColorSets: string[]
  disabled?: boolean
}

// Order: place jsonSchemas immediately after color per UX request
const CATEGORIES: { key: keyof DeclarationsValue; label: string; placeholder: string }[] = [
  { key: 'batchOrdering', label: 'BatchOrdering', placeholder: 'batch rule...' },
  { key: 'globref', label: 'Globref', placeholder: 'refVar = value' },
  { key: 'color', label: 'Color', placeholder: 'colset MYCOLOR = ...;' },
  { key: 'jsonSchemas', label: 'jsonSchema', placeholder: 'NewSchemaName' },
  { key: 'var', label: 'Var', placeholder: 'x' },
  { key: 'lua', label: 'Lua', placeholder: 'function f(x) return x end' },
]

export function DeclarationsPanel({ value, onApply, builtInColorSets, disabled }: DeclarationsPanelProps) {
  const [category, setCategory] = useState<keyof DeclarationsValue>('batchOrdering')
  const [filter, setFilter] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [lines, setLines] = useState<DeclarationsValue>(() => ({
    batchOrdering: value?.batchOrdering ? [...value.batchOrdering] : [],
    globref: value?.globref ? [...value.globref] : [],
    color: value?.color ? [...value.color] : [],
    var: value?.var ? [...value.var] : [],
  lua: value?.lua ? [...value.lua] : [],
  jsonSchemas: value?.jsonSchemas ? value.jsonSchemas.map(js => ({ ...js })) : [],
  }))
  const [luaDraft, setLuaDraft] = useState('')
  const [showLuaEditor, setShowLuaEditor] = useState(false)
  // Per-schema JSON parse errors (index keyed)
  const [schemaErrors, setSchemaErrors] = useState<Record<number, string | undefined>>({})

  const currentList = category === 'jsonSchemas' ? (lines.jsonSchemas || []).map(js => js.name) : (lines[category] || [])
  const filtered = useMemo(() => filter.trim() === '' ? currentList : currentList.filter((l: any) => (''+l).toLowerCase().includes(filter.toLowerCase())), [currentList, filter])

  function updateDraft(idx: number, text: string) {
    if (category === 'jsonSchemas') {
      setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).map((js,i)=> i===idx? { ...js, name: text }: js) }))
    } else {
      setLines(prev => ({ ...prev, [category]: (prev as any)[category]?.map((l: any, i: number) => i===idx ? text : l) }))
    }
  }
  function finishEdit() { setEditingIndex(null) }

  // Sync with external value when it changes (e.g., reopening panel or workflow change)
  useEffect(() => {
    setLines({
      batchOrdering: value?.batchOrdering ? [...value.batchOrdering] : [],
      globref: value?.globref ? [...value.globref] : [],
      color: value?.color ? [...value.color] : [],
      var: value?.var ? [...value.var] : [],
      lua: value?.lua ? [...value.lua] : [],
      jsonSchemas: value?.jsonSchemas ? value.jsonSchemas.map(js => ({ ...js })) : [],
    })
    setEditingIndex(null)
  }, [value?.batchOrdering?.join('\n'), value?.globref?.join('\n'), value?.color?.join('\n'), value?.var?.join('\n'), value?.lua?.join('\n')])
  function addLine() {
    if (category === 'jsonSchemas') {
      setLines(prev => ({ ...prev, jsonSchemas: [...(prev.jsonSchemas||[]), { name: 'NewSchema', schema: { type: 'object' } }] }))
      setEditingIndex(currentList.length)
    } else {
      setLines(prev => ({ ...prev, [category]: [...((prev as any)[category]||[]), ''] }))
      setEditingIndex(currentList.length)
    }
  }
  function deleteSelected() {
    if (editingIndex==null) return
    if (category === 'jsonSchemas') {
      setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).filter((_,i)=>i!==editingIndex) }))
    } else {
      setLines(prev => ({ ...prev, [category]: ((prev as any)[category]||[]).filter((_: any,i: number)=>i!==editingIndex) }))
    }
    setEditingIndex(null)
  }
  function move(delta: number) {
    if (editingIndex==null) return
    const idx = editingIndex
  const arr = [...(category==='jsonSchemas' ? (lines.jsonSchemas||[]).map(js=>js.name) : (lines as any)[category]||[])]
    const target = idx + delta
    if (target < 0 || target >= arr.length) return
    const tmp = arr[idx]; arr[idx] = arr[target]; arr[target] = tmp
    if (category === 'jsonSchemas') {
      setLines(prev => ({ ...prev, jsonSchemas: arr.map(name => (prev.jsonSchemas||[]).find(js=>js.name===name)!).filter(Boolean) }))
    } else {
      setLines(prev => ({ ...prev, [category]: arr }))
    }
    setEditingIndex(target)
  }
  function apply() {
    onApply(lines)
  }

  function updateSchema(idx: number, text: string) {
    try {
      const parsed = JSON.parse(text)
      setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).map((js,i)=> i===idx ? { ...js, schema: parsed } : js) }))
      setSchemaErrors(prev => { const next = { ...prev }; delete next[idx]; return next })
    } catch(e:any) {
      setSchemaErrors(prev => ({ ...prev, [idx]: e.message }))
    }
  }

  function deleteSchema(idx: number) {
    setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).filter((_,i)=>i!==idx) }))
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
  }

  function reorderSchema(from: number, to: number) {
    if (to < 0) return
    setLines(prev => {
      const arr = [...(prev.jsonSchemas||[])]
      if (to >= arr.length) return prev
      const [item] = arr.splice(from,1)
      arr.splice(to,0,item)
      return { ...prev, jsonSchemas: arr }
    })
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
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <Button key={c.key} size="sm" variant={category===c.key? 'default':'outline'} onClick={() => { setCategory(c.key); setEditingIndex(null) }}>{c.label}</Button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={addLine} disabled={disabled}>+ New</Button>
          {category !== 'jsonSchemas' && (<>
            <Button size="sm" variant="outline" onClick={deleteSelected} disabled={disabled || editingIndex==null}>- Delete</Button>
            <Button size="sm" variant="outline" onClick={()=>move(-1)} disabled={disabled || editingIndex==null}>Up</Button>
            <Button size="sm" variant="outline" onClick={()=>move(1)} disabled={disabled || editingIndex==null}>Down</Button>
          </>)}
          {category==='lua' && (
            <Button size="sm" variant="outline" onClick={() => { setLuaDraft(editingIndex!=null ? (currentList[editingIndex]||'') : ''); setShowLuaEditor(true) }}>Lua Editor</Button>
          )}
          <Button size="sm" onClick={apply} disabled={disabled}>Apply</Button>
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
            {filtered.map((line: any) => {
              const realIdx = currentList.indexOf(line)
              const isEditing = editingIndex===realIdx
              return (
                <div key={realIdx} role="option" aria-selected={isEditing} className={cn("px-2 py-1 text-xs cursor-pointer hover:bg-neutral-50", isEditing && 'bg-emerald-50')} onClick={() => setEditingIndex(realIdx)}>
                  {isEditing ? (
                    category==='lua' ? (
                      <Textarea
                        autoFocus
                        rows={2}
                        className="text-xs"
                        value={line}
                        placeholder={CATEGORIES.find(c=>c.key===category)?.placeholder}
                        onChange={e=>updateDraft(realIdx, e.target.value)}
                        onBlur={finishEdit}
                        onKeyDown={e=>{ if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) { finishEdit() } }}
                      />
                    ) : (
                      <Input
                        autoFocus
                        className="h-6 text-xs"
                        value={line}
                        placeholder={CATEGORIES.find(c=>c.key===category)?.placeholder}
                        onChange={e=>updateDraft(realIdx, e.target.value)}
                        onBlur={finishEdit}
                        onKeyDown={e=>{ if (e.key==='Enter') finishEdit(); if (e.key==='Escape') finishEdit() }}
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
            <div key={i} className="border rounded p-2 space-y-2 bg-neutral-50">
              <div className="flex items-center gap-2">
                <Input
                  className="h-7 text-xs w-48"
                  value={js.name}
                  onChange={e=> setLines(prev => ({ ...prev, jsonSchemas: (prev.jsonSchemas||[]).map((o,idx)=> idx===i? { ...o, name: e.target.value }: o) }))}
                  placeholder="Schema name"
                />
                <Button size="sm" variant="outline" onClick={()=>deleteSchema(i)}>Delete</Button>
                <Button size="sm" variant="outline" disabled={i===0} onClick={()=>reorderSchema(i, i-1)}>Up</Button>
                <Button size="sm" variant="outline" disabled={i===arr.length-1} onClick={()=>reorderSchema(i, i+1)}>Down</Button>
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
      <Separator />
      <div className="text-[10px] text-neutral-400 leading-relaxed">
        Tip: Use Apply to stage changes locally. Use existing Save Workflow button to persist to server.
      </div>
    </div>
  )
}
