"use client"
import React, { useState, useMemo, useEffect } from 'react'
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
}

interface DeclarationsPanelProps {
  value?: DeclarationsValue
  onApply: (next: DeclarationsValue) => void
  builtInColorSets: string[]
  disabled?: boolean
}

const CATEGORIES: { key: keyof DeclarationsValue; label: string; placeholder: string }[] = [
  { key: 'batchOrdering', label: 'BatchOrdering', placeholder: 'batch rule...' },
  { key: 'globref', label: 'Globref', placeholder: 'refVar = value' },
  { key: 'color', label: 'Color', placeholder: 'colset MYCOLOR = ...;' },
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
  }))
  const [luaDraft, setLuaDraft] = useState('')
  const [showLuaEditor, setShowLuaEditor] = useState(false)

  const currentList = lines[category] || []
  const filtered = useMemo(() => filter.trim() === '' ? currentList : currentList.filter(l => l.toLowerCase().includes(filter.toLowerCase())), [currentList, filter])

  function updateDraft(idx: number, text: string) {
    setLines(prev => ({ ...prev, [category]: prev[category]?.map((l, i) => i===idx ? text : l) }))
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
    })
    setEditingIndex(null)
  }, [value?.batchOrdering?.join('\n'), value?.globref?.join('\n'), value?.color?.join('\n'), value?.var?.join('\n'), value?.lua?.join('\n')])
  function addLine() {
    setLines(prev => ({ ...prev, [category]: [...(prev[category]||[]), ''] }))
    setEditingIndex((currentList.length))
  }
  function deleteSelected() {
    if (editingIndex==null) return
    setLines(prev => ({ ...prev, [category]: (prev[category]||[]).filter((_,i)=>i!==editingIndex) }))
    setEditingIndex(null)
  }
  function move(delta: number) {
    if (editingIndex==null) return
    const idx = editingIndex
    const arr = [...(lines[category]||[])]
    const target = idx + delta
    if (target < 0 || target >= arr.length) return
    const tmp = arr[idx]; arr[idx] = arr[target]; arr[target] = tmp
    setLines(prev => ({ ...prev, [category]: arr }))
    setEditingIndex(target)
  }
  function apply() {
    onApply(lines)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <Button key={c.key} size="sm" variant={category===c.key? 'default':'outline'} onClick={() => { setCategory(c.key); setEditingIndex(null) }}>{c.label}</Button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={addLine} disabled={disabled}>+ New</Button>
          <Button size="sm" variant="outline" onClick={deleteSelected} disabled={disabled || editingIndex==null}>- Delete</Button>
          <Button size="sm" variant="outline" onClick={()=>move(-1)} disabled={disabled || editingIndex==null}>Up</Button>
          <Button size="sm" variant="outline" onClick={()=>move(1)} disabled={disabled || editingIndex==null}>Down</Button>
          {category==='lua' && (
            <Button size="sm" variant="outline" onClick={() => { setLuaDraft(editingIndex!=null ? (currentList[editingIndex]||'') : ''); setShowLuaEditor(true) }}>Lua Editor</Button>
          )}
          <Button size="sm" onClick={apply} disabled={disabled}>Apply</Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input placeholder="Filter..." value={filter} onChange={e=>setFilter(e.target.value)} className="h-8" />
        <span className="text-xs text-neutral-500">{filtered.length}/{currentList.length}</span>
      </div>
      <div className="rounded border divide-y max-h-72 overflow-auto" role="listbox">
        {filtered.length===0 && (
          <div className="p-2 text-xs text-neutral-400">No entries</div>
        )}
        {filtered.map((line, visualIdx) => {
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
