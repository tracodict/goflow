"use client"
import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { usePreSupportedSchemas } from '@/components/petri/pre-supported-schemas'

const PRE_BUILT = ['INT','REAL','STRING','BOOL','UNIT']

export interface TokenColorSelectProps {
  definedColors: string[]
  onSelect: (color: string) => void
  selected?: string | null
}

export const ViaTokensPanel: React.FC<TokenColorSelectProps> = ({ definedColors, onSelect, selected }) => {
  const { names: preSupportedNames, load, loaded } = usePreSupportedSchemas()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    prebuilt: false,
    defined: false,
    presupported: true, // expanded by default per requirement
  })
  const [query, setQuery] = useState('')

  React.useEffect(()=>{ if (!loaded) load() }, [loaded, load])

  const defined = useMemo(()=>Array.from(new Set(definedColors.filter(c => !PRE_BUILT.includes(c)))), [definedColors])
  const q = query.trim().toLowerCase()
  const filterList = (list: string[]) => q ? list.filter(n => n.toLowerCase().includes(q)) : list
  const preBuiltFiltered = filterList(PRE_BUILT)
  const definedFiltered = filterList(defined)
  // Pre-supported: remove any that are already classified as prebuilt or defined to prevent duplicate entries across groups
  const preSupportedUnique = useMemo(() => {
    const seen = new Set<string>([...PRE_BUILT, ...defined])
    const out: string[] = []
    preSupportedNames.forEach(n => { if (!seen.has(n)) { seen.add(n); out.push(n) } })
    return out
  }, [preSupportedNames, defined])
  const preSupportedFiltered = filterList(preSupportedUnique)

  function toggle(k: string){ setOpenGroups(g => ({ ...g, [k]: !g[k] })) }

  function renderGroup(key: string, label: string, items: string[]) {
    return (
      <div key={key} className="border rounded mb-2 overflow-hidden">
        <button type="button" onClick={()=>toggle(key)} className="w-full flex items-center gap-1 px-2 py-1 text-left text-[11px] bg-neutral-50 hover:bg-neutral-100">
          {openGroups[key] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="font-medium uppercase tracking-wide">{label}</span>
          <span className="ml-auto text-[10px] text-neutral-500">{items.length}</span>
        </button>
        {openGroups[key] && (
          <div className="overflow-auto divide-y">
            {Array.from(new Set(items)).map(name => (
              <button
                key={`${key}-${name}`}
                className={`w-full text-left px-2 py-1 text-[11px] hover:bg-neutral-50 ${selected===name ? 'bg-emerald-50 text-emerald-700 font-medium' : ''}`}
                onClick={()=>onSelect(name)}
              >{name}</button>
            ))}
            {!items.length && <div className="px-2 py-2 text-[10px] text-neutral-400">None</div>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-2 text-xs">
      <div className="relative mb-2">
        <input
          type="text"
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Search colors..."
          className="w-full h-7 px-2 pr-6 rounded border text-[11px] outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {query && (
          <button
            type="button"
            className="absolute right-1 top-1 h-5 w-5 inline-flex items-center justify-center rounded hover:bg-neutral-100"
            onClick={()=>setQuery('')}
            aria-label="Clear search"
          ><X className="h-3 w-3" /></button>
        )}
      </div>
      <div className="flex-1 overflow-auto pb-1">
        {renderGroup('prebuilt','Pre-built', preBuiltFiltered)}
        {renderGroup('defined','Defined', definedFiltered)}
        {renderGroup('presupported','Pre-supported', preSupportedFiltered)}
      </div>
    </div>
  )
}
