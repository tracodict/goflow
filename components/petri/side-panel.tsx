"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import ExplorerPanel from "./explorer-panel"
import { DeclarationsPanel, type DeclarationsValue } from "./declarations-panel"
// Built-in color sets (not persisted) reused for declarations info UI
const DEFAULT_COLOR_SETS = ['INT','REAL','STRING','BOOL','UNIT']
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { Edge, Node } from "@xyflow/react"
import type { PetriEdgeData, PetriNodeData, TransitionType, Token, PlaceData } from "@/lib/petri-types"
import { GripVertical, Minimize2, Maximize2, PanelRightOpen, ChevronsUpDown, Check, Plus, Trash2 } from "lucide-react"
// Removed static FORM_SCHEMAS; dynamic list comes from workflow declarations jsonSchemas
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import CodeMirror from '@uiw/react-codemirror'
import { LlmMessagesEditor } from './llm-messages-editor'
import { useSystemSettings } from './system-settings-context'
import { listMcpTools, listRegisteredMcpTools } from './petri-client'
import { StreamLanguage } from '@codemirror/language'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { EditorView } from '@codemirror/view'
import { json } from '@codemirror/lang-json'
import { usePreSupportedSchemas } from './pre-supported-schemas'

type SelectedResolved = { type: "node"; node: Node<PetriNodeData> } | { type: "edge"; edge: Edge<PetriEdgeData> } | null

export function SidePanel({
  open,
  width = 360,
  onResizeStart,
  selected,
  onUpdateNode,
  onUpdateEdge,
  onRenamePlaceId,
  onRenameTransitionId,
  onRenameEdgeId,
  tokensOpenForPlaceId,
  guardOpenForTransitionId,
  tab,
  setTab,
  explorerWorkflows,
  onExplorerSelect,
  onCreateWorkflow,
  onDeleteWorkflow,
  onRenameWorkflow,
  workflowMeta,
  activeWorkflowId,
  explorerNodes,
  explorerEdges,
  onAddPlace,
  onRenamePlace,
  onDeletePlace,
  onAddTransition,
  onRenameTransition,
  onDeleteTransition,
  onAddArc,
  onDeleteArc,
  onColorSetsChange,
  onSelectEntity,
  selectedEntity,
  onRefreshWorkflows,
  onDeclarationsApply,
}: {
  open: boolean
  width?: number
  onResizeStart: () => void
  selected: SelectedResolved
  onUpdateNode: (id: string, patch: Partial<PetriNodeData>) => void
  onUpdateEdge: (id: string, patch: Partial<PetriEdgeData>) => void
  // onModeChange removed; panel is always rendered inline/resizable when mounted
  onRenamePlaceId?: (oldId: string, nextId: string) => { ok: boolean; reason?: string }
  onRenameTransitionId?: (oldId: string, nextId: string) => { ok: boolean; reason?: string }
  onRenameEdgeId?: (oldId: string, nextId: string) => { ok: boolean; reason?: string }
  tokensOpenForPlaceId?: string
  guardOpenForTransitionId?: string
  tab: 'property' | 'explorer'
  setTab: (tab: 'property' | 'explorer') => void
  explorerWorkflows?: any[]
  onExplorerSelect?: (workflowId: string) => void
  onCreateWorkflow?: () => void
  onDeleteWorkflow?: (id: string) => void
  onRenameWorkflow?: (id: string, name: string) => void
  workflowMeta?: Record<string, { name: string; description?: string; colorSets: string[]; declarations?: DeclarationsValue & { jsonSchemas?: { name: string; schema: any }[] } }>
  activeWorkflowId?: string | null
  explorerNodes?: any[]
  explorerEdges?: any[]
  onAddPlace?: () => void
  onRenamePlace?: (id: string, name: string) => void
  onDeletePlace?: (id: string) => void
  onAddTransition?: () => void
  onRenameTransition?: (id: string, name: string) => void
  onDeleteTransition?: (id: string) => void
  onAddArc?: () => void
  onDeleteArc?: (id: string) => void
  onColorSetsChange?: (next: string[]) => void
  onSelectEntity?: (kind: 'place'|'transition'|'arc'|'declarations', id: string) => void
  selectedEntity?: { kind: 'place'|'transition'|'arc'|'declarations'; id: string } | null
  onRefreshWorkflows?: () => void
  onDeclarationsApply?: (next: DeclarationsValue) => void
}) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [, forceRerender] = useState(0)
  const [externalSelection, setExternalSelection] = useState<{ kind: 'place'|'transition'|'arc'; id: string } | null>(null)
  // Emit current workflow meta (jsonSchemas) so ManualEditor can seed available form schemas
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!activeWorkflowId) return
    const meta: any = (workflowMeta as any)?.[activeWorkflowId]
    const jsonSchemas = meta?.declarations?.jsonSchemas || []
  // Cache latest meta so late-mounted listeners (ManualEditor) can read synchronously
  ;(window as any).__goflowLastWorkflowMeta = { jsonSchemas }
    const ev = new CustomEvent('goflow-workflowMeta', { detail: { jsonSchemas } })
    window.dispatchEvent(ev)
  }, [activeWorkflowId, workflowMeta && activeWorkflowId ? JSON.stringify((workflowMeta as any)[activeWorkflowId]?.declarations?.jsonSchemas?.map((s: any)=>s.name)||[]) : null])
  

  if (!open) {
    return null
  }

  // When used inside the `RightPanel`, SidePanel should render as an inline
  // element sized by its parent rather than a fixed-position drawer. For the
  // 'full' mode we still render a full-size overlay-like container, but by
  // default (mode === 'normal') we render an inline aside that fills the
  // available height/width of the parent `RightPanel` container.

  const inlineStyle: React.CSSProperties = { position: "relative", width: '100%', zIndex: 50, height: '100%', boxSizing: 'border-box', flex: `0 0 ${typeof width === 'number' ? `${width}px` : width}`, maxWidth: '100vw' }

  return (
    <aside
      className="flex flex-col border-l bg-white shadow-none overflow-x-visible h-full w-full"
      style={{ ...inlineStyle}}
      // keep role for accessibility but remove modal semantics when inline
      role="region"
      aria-label="Side Panel"
    >


      <div className="flex-1 flex flex-col overflow-hidden" style={{ width: '100%' }}>
        {/* Explorer migrated to left panel; removed inline explorer section and splitter */}
        {/* Property section */}
        <div ref={contentRef} className="flex-1 overflow-y-auto overflow-x-visible p-3" style={{ width: '100%' }}>
          {(() => {
            // If colorSets pseudo-entity selected, render its editor immediately
            if (selectedEntity?.kind === 'declarations' && activeWorkflowId) {
              const meta: any = (workflowMeta as any)?.[activeWorkflowId]
              const value: DeclarationsValue | undefined = meta?.declarations
              return (
                <DeclarationsPanel
                  value={value}
                  builtInColorSets={DEFAULT_COLOR_SETS}
                  onApply={(next) => {
                    const ev = new CustomEvent('updateDeclarationsInternal', { detail: { next } })
                    window.dispatchEvent(ev)
                    onDeclarationsApply?.(next)
                  }}
                />
              )
            }
            // Prefer canvas selection; fallback to externalSelection if nothing selected (colorSets handled above)
            const effectiveSelected = selected || (externalSelection ? { type: externalSelection.kind === 'arc' ? 'edge' : 'node', ...(externalSelection.kind === 'arc' ? { edge: { id: externalSelection.id } as any } : { node: { id: externalSelection.id, type: externalSelection.kind === 'place' ? 'place':'transition', data: {} } as any }) } as SelectedResolved : null)
            if (!effectiveSelected) return <div className="text-xs text-neutral-500">Select an element in the explorer or canvas.</div>
            if (effectiveSelected.type === 'node') {
              const node = effectiveSelected.node
              if (node.type === 'place') {
                return <PlaceEditor node={node} onUpdate={onUpdateNode} onRenameId={onRenamePlaceId} forceOpenTokens={tokensOpenForPlaceId === node.id} scrollContainerRef={contentRef} />
              }
              return <TransitionEditor node={node} onUpdate={onUpdateNode} onRenameId={onRenameTransitionId} focusGuard={guardOpenForTransitionId === node.id} scrollContainerRef={contentRef} />
            }
            return <EdgeEditor edge={effectiveSelected.edge} onUpdate={onUpdateEdge} onRenameId={onRenameEdgeId} />
          })()}
        </div>
      </div>
    </aside>
  )
}

// Removed ColorSetsEditor (colorSets editing deprecated in favor of declarations)

function PlaceEditor({
  node,
  onUpdate,
  onRenameId,
  forceOpenTokens,
  scrollContainerRef,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
  onRenameId?: (oldId: string, nextId: string) => { ok: boolean; reason?: string }
  forceOpenTokens?: boolean
  scrollContainerRef: React.RefObject<HTMLElement | null>
}) {
  const place = node.data as PlaceData
  const [section, setSection] = useState<"tokens" | "details">(forceOpenTokens ? "tokens" : "details")
  // Extract workflow colorSets from global meta via window event (fallback to parsing explorer) – simple approach: read from a data attribute if set externally later.
  const [availableColorSets, setAvailableColorSets] = useState<string[]>([])
  useEffect(() => {
    const handler = (e: any) => {
      if (Array.isArray(e.detail?.colorSets)) setAvailableColorSets(e.detail.colorSets)
    }
    window.addEventListener('goflow-colorSets', handler as EventListener)
    return () => window.removeEventListener('goflow-colorSets', handler as EventListener)
  }, [])

  useEffect(() => {
    if (forceOpenTokens) setSection("tokens")
  }, [forceOpenTokens])

  const [idDraft, setIdDraft] = useState<string>(node.id)
  useEffect(() => { setIdDraft(node.id) }, [node.id])
  const [idError, setIdError] = useState<string>("")
  const isValidIdent = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s)

  const tokenList = useMemo<Token[]>(() => place.tokenList || [], [place.tokenList])

  // Controlled open state for token accordions so first token auto-expands
  const [openTokenItems, setOpenTokenItems] = useState<string[]>([])
  // When switching to tokens section or token list changes, auto-open first if none open
  useEffect(() => {
    if (section === 'tokens' && tokenList.length > 0) {
      // If currently none of the existing token ids are open, open the first
      const ids = openTokenItems.filter(id => tokenList.some(t => (t.id || '').toString() === id))
      if (ids.length === 0) {
        const firstId = (tokenList[0].id || `tok-0`).toString()
        setOpenTokenItems([firstId])
      }
    }
  }, [section, tokenList])

  const syncCount = () => onUpdate(node.id, { tokens: tokenList.length })

  const addToken = () => {
    const list = [
      ...tokenList,
      { id: `tok-${Math.random().toString(36).slice(2, 8)}`, data: {}, createdAt: 0 }, // simulation step starts at 0
    ]
    onUpdate(node.id, { tokenList: list as any, tokens: list.length } as any)
  }

  const removeToken = (tokId: string) => {
    const list = tokenList.filter((t) => t.id !== tokId)
    onUpdate(node.id, { tokenList: list as any, tokens: list.length } as any)
  }

  const updateTokenData = (tokId: string, nextData: any) => {
    const list = tokenList.map((t) => (t.id === tokId ? { ...t, data: nextData, updatedAt: Date.now() } : t))
    onUpdate(node.id, { tokenList: list as any } as any)
  }

  return (
    <div className="mt-2 space-y-6">
      <div className="flex items-center gap-2">
        <Button size="sm" variant={section === "details" ? "default" : "outline"} onClick={() => setSection("details")}>
          Details
        </Button>
        <Button size="sm" variant={section === "tokens" ? "default" : "outline"} onClick={() => setSection("tokens")}>
          Tokens ({place.tokens ?? 0})
        </Button>
      </div>

      {section === "details" ? (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="p-id">ID</Label>
            <Input
              id="p-id"
              value={idDraft}
              onChange={(e)=>{ setIdDraft(e.target.value); setIdError("") }}
              onBlur={()=>{
                if (!onRenameId) return
                const next = idDraft.trim()
                if (!next || next === node.id) return
                if (!isValidIdent(next)) { setIdError('ID must be a valid Lua identifier'); setIdDraft(node.id); return }
                const result = onRenameId(node.id, next)
                if (!result?.ok) { setIdError(result?.reason || 'Rename failed'); setIdDraft(node.id) }
              }}
              placeholder="place identifier"
            />
            {idError ? <div className="text-xs text-red-600">{idError}</div> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={place.name || ""}
              onChange={(e) => onUpdate(node.id, { name: e.target.value })}
              placeholder="Place name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-colorset">Color Set</Label>
            <select
              id="p-colorset"
              className="rounded border px-2 py-1 text-sm bg-white"
              value={place.colorSet || ''}
              onChange={(e) => onUpdate(node.id, { colorSet: e.target.value })}
            >
              <option value="">(none)</option>
              {availableColorSets.map(cs => <option key={cs} value={cs}>{cs}</option>)}
            </select>
            <p className="text-xs text-neutral-500">Assign a declared color set to this place.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-tokens">Tokens (count)</Label>
            <Input
              id="p-tokens"
              type="number"
              min={0}
              value={place.tokens ?? 0}
              onChange={(e) => onUpdate(node.id, { tokens: Math.max(0, Number(e.target.value || 0)) })}
              onBlur={syncCount}
              placeholder="0"
            />
            <p className="text-xs text-neutral-500">
              Count is kept in sync with the token list. Blur this field to auto-sync.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={!!place.isEnd}
                onChange={e => onUpdate(node.id, { isEnd: e.target.checked })}
              />
              End Place
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Tokens</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={syncCount} title="Sync count with list">
                Sync Count
              </Button>
              <Button size="sm" onClick={addToken}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          {tokenList.length === 0 ? (
            <div className="rounded border bg-neutral-50 p-3 text-xs text-neutral-500">No tokens in this place.</div>
          ) : (
            <Accordion
              type="multiple"
              className="w-full"
              value={openTokenItems}
              onValueChange={(vals) => setOpenTokenItems(vals as string[])}
            >
              {tokenList.map((tok, idx) => {
                // Robust date handling: accept numeric (ms) or ISO string; fallback to '-'
                let createdLabel = '-'
                const raw = (tok as any).createdAt
                if (raw !== undefined && raw !== null) {
                  const ts = typeof raw === 'number' ? raw : (typeof raw === 'string' ? Date.parse(raw) : NaN)
                  if (!Number.isNaN(ts) && ts > 0) {
                    try { createdLabel = new Date(ts).toLocaleString() } catch { createdLabel = '-' }
                  }
                }
                const previewValue = (() => {
                  try {
                    const val = (tok as any).data
                    if (val === undefined) return ''
                    const json = typeof val === 'string' ? val : JSON.stringify(val)
                    if (!json) return ''
                    return json.length > 15 ? json.slice(0, 12) + '...' : json
                  } catch { return '' }
                })()
                return (
                  <AccordionItem key={tok.id || idx} value={tok.id || `tok-${idx}`} className="border rounded mb-2">
                    <AccordionTrigger className="px-3 py-2 text-sm no-underline hover:no-underline">
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate" title={String((tok as any).data)}>
                          #{idx + 1} — {tok.id}
                          {previewValue ? <span className="ml-1 text-emerald-600">({previewValue})</span> : null}
                        </span>
                        <span className="text-xs text-neutral-500">{createdLabel}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <TokenEditor
                        token={tok}
                        onChange={(data) => updateTokenData(tok.id, data)}
                        onRemove={() => removeToken(tok.id)}
                        scrollContainerRef={scrollContainerRef}
                      />
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </div>
      )}
    </div>
  )
}

function TokenEditor({
  token,
  onChange,
  onRemove,
  scrollContainerRef,
}: {
  token: Token
  onChange: (data: any) => void
  onRemove: () => void
  scrollContainerRef: React.RefObject<HTMLElement | null>
}) {
  const [text, setText] = useState<string>(() => { try { return JSON.stringify(token.data ?? {}, null, 2) } catch { return "{}" } })
  const [error, setError] = useState<string | null>(null)
  const [editorHeight, setEditorHeight] = useState<number>(180)
  const dragState = useRef<{ startY: number; startH: number; dragging: boolean }>({ startY:0, startH:180, dragging:false })
  const lastLocalEditRef = useRef<number>(0)
  const lastIncomingRef = useRef<string>(text)

  useEffect(() => {
    function onMove(e: MouseEvent){
      if(!dragState.current.dragging) return
      const dy = e.clientY - dragState.current.startY
      const next = Math.min(Math.max(100, dragState.current.startH + dy), 600)
      setEditorHeight(next)
    }
    function onUp(){ dragState.current.dragging = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => {
    const recentlyEdited = Date.now() - lastLocalEditRef.current < 1500
    let newText = "{}"
    try { newText = JSON.stringify(token.data ?? {}, null, 2) } catch { /* ignore */ }
    if (!recentlyEdited && newText !== lastIncomingRef.current) {
      setText(prev => prev !== newText ? newText : prev)
      lastIncomingRef.current = newText
      setError(null)
    }
  }, [token.data])

  const tryApply = () => {
    try {
      const parsed = text.trim() === "" ? {} : JSON.parse(text)
      onChange(parsed)
      lastLocalEditRef.current = 0
      setError(null)
    } catch (e: any) {
      setError(e?.message || "Invalid JSON")
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Data (JSON)</Label>
      <div className="relative rounded border bg-white" style={{ height: editorHeight }}>
        <CodeMirror
          value={text}
          height={`${editorHeight - 8}px`}
          theme="light"
          extensions={[EditorView.lineWrapping, json()]}
          onChange={(val: string) => { lastLocalEditRef.current = Date.now(); setText(val) }}
          basicSetup={{
            lineNumbers: true,
            bracketMatching: true,
            closeBrackets: true,
            highlightActiveLine: true,
            indentOnInput: true,
            defaultKeymap: true,
          }}
        />
        <div
          onMouseDown={(e) => { dragState.current = { startY: e.clientY, startH: editorHeight, dragging: true } }}
          className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-gradient-to-b from-transparent to-neutral-200"
          aria-label="Resize token JSON editor"
        />
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
      <div className="flex items-center justify-between">
        <Button size="sm" variant="secondary" onClick={tryApply}>
          Apply
        </Button>
        <Button size="sm" variant="outline" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" /> Remove
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {token.updatedAt ? (
          <div className="grid gap-1">
            <Label className="text-xs">Updated</Label>
            {(() => {
              const raw = (token as any).updatedAt
              let label = '-'
              if (raw !== undefined && raw !== null) {
                const ts = typeof raw === 'number' ? raw : (typeof raw === 'string' ? Date.parse(raw) : NaN)
                if (!Number.isNaN(ts) && ts > 0) {
                  try { label = new Date(ts).toLocaleString() } catch { label = '-' }
                }
              }
              return <Input value={label} readOnly />
            })()}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TransitionEditor({
  node,
  onUpdate,
  onRenameId,
  focusGuard,
  scrollContainerRef,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
  onRenameId?: (oldId: string, nextId: string) => { ok: boolean; reason?: string }
  focusGuard?: boolean
  scrollContainerRef: React.RefObject<HTMLElement | null>
}) {
  const tType = ((node.data as any).tType || "manual") as TransitionType
  const inscRef = useRef<HTMLDivElement | null>(null)
  const resizeRef = useRef<HTMLDivElement | null>(null)
  const [editorHeight, setEditorHeight] = useState<number>(160)
  const dragState = useRef<{ startY: number; startH: number; dragging: boolean }>({ startY:0, startH:160, dragging:false })
  useEffect(() => {
    function onMove(e: MouseEvent){
      if(!dragState.current.dragging) return
      const dy = e.clientY - dragState.current.startY
      const next = Math.min(Math.max(80, dragState.current.startH + dy), 480)
      setEditorHeight(next)
    }
    function onUp(){ dragState.current.dragging = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => {
    if (focusGuard && inscRef.current) {
      inscRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [focusGuard])

  const [idDraft, setIdDraft] = useState<string>(node.id)
  useEffect(() => { setIdDraft(node.id) }, [node.id])
  const [idError, setIdError] = useState<string>("")
  const isValidIdent = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s)

  // --- Guard Expression FIX ---
  const lastLocalEditRef = useRef<number>(0)
  const [guardText, setGuardText] = useState<string>(() => (node as any).guardExpression || (node.data as any).guardExpression || "")
  // Only update from props if node id changes or not recently edited locally
  useEffect(() => {
    const incoming = (node as any).guardExpression || (node.data as any).guardExpression || ""
    // Always update if node id changes
    setGuardText(incoming)
    lastLocalEditRef.current = 0
  }, [node.id])

  useEffect(() => {
    const incoming = (node as any).guardExpression || (node.data as any).guardExpression || ""
    const now = Date.now()
    const recentlyEdited = now - lastLocalEditRef.current < 1200
    // Only update from props if not recently edited locally and value is different
    if (!recentlyEdited && guardText !== incoming) {
      setGuardText(incoming)
    }
    // If recently edited, ignore prop churn
  }, [(node as any).guardExpression, (node.data as any).guardExpression])

  const handleGuardChange = (val: string) => {
    lastLocalEditRef.current = Date.now()
    setGuardText(val)
  }

  useEffect(() => {
    const h = window.setTimeout(() => {
      onUpdate(node.id, { guardExpression: guardText } as any)
    }, 150)
    return () => window.clearTimeout(h)
  }, [guardText, node.id, onUpdate])

  return (
    <div className="mt-2 space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="t-id">ID</Label>
        <Input id="t-id" value={idDraft} onChange={(e)=>{ setIdDraft(e.target.value); setIdError("") }} onBlur={()=>{
          if (!onRenameId) return
          const next = idDraft.trim()
          if (!next || next === node.id) return
          if (!isValidIdent(next)) { setIdError('ID must be a valid Lua identifier'); setIdDraft(node.id); return }
          const result = onRenameId(node.id, next)
          if (!result?.ok) { setIdError(result?.reason || 'Rename failed'); setIdDraft(node.id) }
        }} />
        {idError ? <div className="text-xs text-red-600">{idError}</div> : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="t-name">Name</Label>
        <Input
          id="t-name"
          value={(node.data as any).name || ""}
          onChange={(e) => onUpdate(node.id, { name: e.target.value })}
          placeholder="Transition name"
        />
      </div>

      {tType !== 'Tools' && (
        <div ref={inscRef} className="space-y-2">
          <Label className="text-sm">Guard Expression</Label>
          <div className="relative rounded border bg-white" style={{ height: editorHeight }}>
            <CodeMirror
              value={guardText}
              height={`${editorHeight - 8}px`}
              theme="light"
              extensions={[EditorView.lineWrapping, StreamLanguage.define(lua)]}
              onChange={(val) => setGuardText(val)}
              basicSetup={{
                lineNumbers: true,
                bracketMatching: true,
                closeBrackets: true,
                highlightActiveLine: true,
                indentOnInput: true,
                defaultKeymap: true,
              }}
            />
            <div
              ref={resizeRef}
              onMouseDown={(e) => { dragState.current = { startY: e.clientY, startH: editorHeight, dragging: true } }}
              className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-gradient-to-b from-transparent to-neutral-200"
              aria-label="Resize guard editor"
            />
          </div>
          <p className="text-xs text-neutral-500">
            Lua-like guard expression. Example: <code>if amount &gt; 1000 then return "review" else return "auto" end</code>
          </p>
        </div>
      )}

      <div className="rounded border bg-neutral-50 px-2 py-1 text-xs text-neutral-600">
        Type: <span className="font-medium capitalize">{tType}</span> (right-click the node to change)
      </div>

  <TypeSpecificEditor node={node} tType={tType} onUpdate={onUpdate} />
  {tType !== 'Tools' && (
    <>
      <SubPageSection node={node} onUpdate={onUpdate} />
      <ActionFunctionEditor node={node} onUpdate={onUpdate} />
      <ActionOutputsEditor node={node} onUpdate={onUpdate} />
      <div className="mt-6 space-y-2">
        <Label htmlFor="t-delay" className="text-sm">Transition Delay</Label>
        <Input
          id="t-delay"
          type="number"
          min={0}
          value={(node.data as any).transitionDelay ?? 0}
          onChange={(e) => onUpdate(node.id, { transitionDelay: Math.max(0, Number(e.target.value || 0)) } as any)}
          placeholder="0"
        />
        <p className="text-xs text-neutral-500">Delay advances global clock when this transition fires (timed nets).</p>
      </div>
    </>
  )}
    </div>
  )
}

function TypeSpecificEditor({
  node,
  tType,
  onUpdate,
}: {
  node: Node<PetriNodeData>
  tType: TransitionType
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
}) {
  switch (tType) {
    case "Manual":
      return <ManualEditor node={node} onUpdate={onUpdate} />
    case "Auto":
      return null
    case "Message":
      return <MessageEditor node={node} onUpdate={onUpdate} />
    case "LLM":
      return <LLMEditor node={node} onUpdate={onUpdate} />
    case "Tools":
      return <ToolsEditor node={node} onUpdate={onUpdate} />
    case "Retriever":
      return <RetrieverEditor node={node} onUpdate={onUpdate} />
    default:
      return null
  }
}
function RetrieverEditor({ node, onUpdate }: { node: Node<PetriNodeData>; onUpdate: (id: string, patch: Partial<PetriNodeData>) => void }) {
  const provider: string = (node.data as any).RetrieverProvider || ''
  const queryVar: string = (node.data as any).RetrieverQueryVar || ''
  const options: Record<string,string> = (node.data as any).RetrieverOptions || {}
  const [optText, setOptText] = useState<string>(() => {
    try { return JSON.stringify(options, null, 2) } catch { return '{\n  "topK": "5"\n}' }
  })
  const [optError, setOptError] = useState<string>('')

  const applyOptions = () => {
    try {
      const parsed = JSON.parse(optText)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // coerce all values to string (backend contract)
        const coerced: Record<string,string> = {}
        Object.entries(parsed).forEach(([k,v]) => { if (v!=null) coerced[k] = String(v) })
        onUpdate(node.id, { RetrieverOptions: coerced } as any)
        setOptError('')
      } else {
        setOptError('Options must be a JSON object')
      }
    } catch(e:any) {
      setOptError(e?.message || 'Invalid JSON')
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-1">
        <Label className="text-xs">Provider</Label>
        <select
          className="border rounded px-2 py-1 text-xs"
          value={provider}
          onChange={(e)=> onUpdate(node.id, { RetrieverProvider: e.target.value || undefined } as any)}
        >
          <option value="">(select provider)</option>
          <option value="dify">dify</option>
        </select>
        <p className="text-[11px] text-neutral-500">Provider implementation (currently only dify).</p>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Query Variable</Label>
        <Input
          className="text-xs"
          placeholder="e.g. query"
          value={queryVar}
          onChange={(e)=> onUpdate(node.id, { RetrieverQueryVar: e.target.value } as any)}
        />
        <p className="text-[11px] text-neutral-500">Name of input arc bound variable containing the query text. If empty defaults to first IN arc variable.</p>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Options (JSON)</Label>
        <Textarea
          rows={5}
          value={optText}
          onChange={(e)=> setOptText(e.target.value)}
          className="font-mono text-[12px]"
          placeholder={`{\n  "topK": "5"\n}`}
        />
        {optError && <div className="text-[11px] text-red-600">{optError}</div>}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={applyOptions}>Apply</Button>
          <Button size="sm" variant="ghost" onClick={()=> { try { setOptText(JSON.stringify((node.data as any).RetrieverOptions||{}, null, 2)); setOptError('') } catch { /* ignore */ } }}>Reset</Button>
        </div>
        <p className="text-[11px] text-neutral-500">Editable provider options (all values coerced to string). Common: topK.</p>
      </div>
      <div className="rounded border bg-neutral-50 p-2 text-[11px] text-neutral-600">
        Outputs variable <code>retrieved</code> (array of documents) is available to OUT arc expressions.
      </div>
    </div>
  )
}
function ToolsEditor({ node, onUpdate }: { node: Node<PetriNodeData>; onUpdate: (id: string, patch: Partial<PetriNodeData>) => void }) {
  const tools = ((node.data as any).tools || []) as Array<{ name: string; config?: any }>
  const [mcpEndpoints, setMcpEndpoints] = useState<string[]>([])
  const [mcpToolsByEndpoint, setMcpToolsByEndpoint] = useState<Record<string, { name: string; enabled?: boolean }[]>>({})
  const builtins = ["duckduckgo", "wikipedia"]
  const { settings } = useSystemSettings()

  // Load enabled MCP tools grouped by endpoint
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!settings.flowServiceUrl) return
      try {
        const list = await listRegisteredMcpTools(settings.flowServiceUrl)
        // Group by baseUrl
        const grouped: Record<string, { name: string; enabled?: boolean }[]> = {}
        for (const t of list) {
          if (!grouped[t.baseUrl]) grouped[t.baseUrl] = []
          grouped[t.baseUrl].push({ name: t.name, enabled: true })
        }
        if (!cancelled) {
          setMcpEndpoints(Object.keys(grouped))
          setMcpToolsByEndpoint(grouped)
        }
      } catch {/* ignore */}
    }
    load()
    return () => { cancelled = true }
  }, [settings.flowServiceUrl])

  const updateTools = (next: Array<{ name: string; config?: any }>) => onUpdate(node.id, { tools: next } as any)

  const addTool = () => updateTools([...(tools||[]), { name: '', config: {} }])
  const removeTool = (i: number) => updateTools(tools.filter((_,idx)=> idx!==i))
  const setTool = (i: number, patch: Partial<{ name: string; config?: any }>) => {
    const next = tools.slice()
    next[i] = { ...next[i], ...patch }
    updateTools(next)
  }

  const mcpOptions = mcpEndpoints.flatMap(ep => (mcpToolsByEndpoint[ep]||[]).filter(t=> t.enabled !== false).map(t => `mcp:${ep}:${t.name}`))
  const allOptions = [...builtins, ...mcpOptions]

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Tools</Label>
        <Button size="sm" variant="outline" onClick={addTool}>Add Tool</Button>
      </div>
      <div className="space-y-2">
        {tools.length === 0 && (
          <div className="text-xs text-neutral-500">No tools. Click Add Tool.</div>
        )}
        {tools.map((tool, i) => (
          <details key={i} className="rounded border overflow-hidden">
            <summary className="cursor-pointer px-2 py-1 bg-neutral-50 flex items-center justify-between">
              <span className="text-xs">{tool.name || 'New Tool'}</span>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={(e)=>{ e.preventDefault(); removeTool(i) }}>Remove</Button>
            </summary>
            <div className="p-2 space-y-2">
              <div className="grid gap-1">
                <Label className="text-xs">Name</Label>
                <select className="border rounded px-2 py-1 text-xs" value={tool.name} onChange={(e)=> setTool(i, { name: e.target.value })}>
                  <optgroup label="Built-in">
                    {builtins.map(b => (<option key={b} value={b}>{b}</option>))}
                  </optgroup>
                  <optgroup label="MCP">
                    {mcpOptions.map(m => (<option key={m} value={m}>{m}</option>))}
                  </optgroup>
                </select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Config (JSON)</Label>
                <Textarea rows={4} className="font-mono text-[12px]" value={JSON.stringify(tool.config||{}, null, 2)} onChange={(e)=>{
                  try { setTool(i, { config: JSON.parse(e.target.value) }) } catch { /* ignore until valid */ }
                }} />
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

function ManualEditor({
  node,
  onUpdate,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
}) {
  const manual = ((node.data as any).manual || {}) as { assignee?: string; formSchema?: string; layoutSchema?: string }
  const [open, setOpen] = useState(false)
  // Raw categorized sources
  const [jsonSchemaNames, setJsonSchemaNames] = useState<string[]>([])
  const [declaredColorNames, setDeclaredColorNames] = useState<string[]>([])
  // Legacy flattened union (kept for backward compatibility / selected value presence)
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([])
  const [colorSets, setColorSets] = useState<string[]>([])
  const BUILT_IN_PRIMITIVES = ['INT','REAL','STRING','BOOL','UNIT']
  // Pre-supported schemas (lazy from CDN dictionaryUrl)
  const { names: preSupportedNames, loaded: preSupportedLoaded, load: loadPreSupported } = usePreSupportedSchemas()

  // Listen for declarations updates dispatched from DeclarationsPanel apply
  useEffect(() => {
    function sync(e: any) {
      const jsonList: string[] = (e.detail?.next?.jsonSchemas || []).map((s: any) => s.name).filter(Boolean)
      const colorLines: string[] = Array.isArray(e.detail?.next?.color) ? e.detail.next.color : []
      const nameRegex = /\bcolset\s+([A-Za-z_][A-Za-z0-9_]*)/i
      const declColorNames = colorLines.map(l => { const m = l.match(nameRegex); return m? m[1] : undefined }).filter(Boolean) as string[]
      setJsonSchemaNames(jsonList)
      setDeclaredColorNames(declColorNames)
    }
    window.addEventListener('updateDeclarationsInternal', sync as EventListener)
    return () => window.removeEventListener('updateDeclarationsInternal', sync as EventListener)
  }, [])

  // Seed from workflow meta broadcast (fired when selecting workflow) so schemas appear even before editing declarations.
  useEffect(() => {
    function seedMeta(e: any) {
      const jsonList: string[] = (e.detail?.jsonSchemas || []).map((s: any) => s.name).filter(Boolean)
      if (jsonList.length) setJsonSchemaNames(jsonList)
    }
    window.addEventListener('goflow-workflowMeta', seedMeta as EventListener)
    try {
      const cached = (window as any).__goflowLastWorkflowMeta
      if (cached?.jsonSchemas) {
        const list: string[] = cached.jsonSchemas.map((s: any)=> s.name).filter(Boolean)
        if (list.length) setJsonSchemaNames(list)
      }
    } catch {/* ignore */}
    return () => window.removeEventListener('goflow-workflowMeta', seedMeta as EventListener)
  }, [])

  // Listen for merged color sets (includes declarations-derived colset names)
  useEffect(() => {
    function handleColors(e: any) {
      const next: string[] = e.detail?.colorSets || []
      setColorSets(next.filter(Boolean))
    }
    window.addEventListener('goflow-colorSets', handleColors as EventListener)
    // Attempt immediate seed from cached global if present
    try {
      const cached = (window as any).__goflowLastColorSets
      if (Array.isArray(cached)) setColorSets(cached.filter(Boolean))
    } catch {/* ignore */}
    return () => window.removeEventListener('goflow-colorSets', handleColors as EventListener)
  }, [])

  // Initial load: try read from current workflow meta via global event (emitted elsewhere when workflow selected)
  useEffect(() => {
    function seed(e: any) {
      const list: string[] = (e.detail?.jsonSchemas || []).map((s: any) => s.name).filter(Boolean)
      if (list.length) setAvailableSchemas(list)
    }
    window.addEventListener('goflow-workflowMeta', seed as EventListener)
    // Immediate seed from cached global if present (event may have fired before mount)
    try {
      const cached = (window as any).__goflowLastWorkflowMeta
      if (cached?.jsonSchemas) {
        const list: string[] = cached.jsonSchemas.map((s: any)=> s.name).filter(Boolean)
        if (list.length) setAvailableSchemas(list)
      }
    } catch {/* ignore */}
    return () => window.removeEventListener('goflow-workflowMeta', seed as EventListener)
  }, [])

  // Accept server-provided formSchema even if not yet in availableSchemas (will be merged later)
  const selectedName = manual.formSchema ? manual.formSchema : undefined

  // Merge logic: built-in color sets + workflow jsonSchemas + pre-supported (once loaded) de-duplicated
  useEffect(() => {
    const merged = new Set<string>()
    jsonSchemaNames.forEach(s => merged.add(s))
    declaredColorNames.forEach(c => merged.add(c))
    colorSets.forEach(c => merged.add(c))
    BUILT_IN_PRIMITIVES.forEach(p => merged.add(p))
    if (preSupportedLoaded) preSupportedNames.forEach(n => merged.add(n))
    setAvailableSchemas(Array.from(merged))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonSchemaNames.join('|'), declaredColorNames.join('|'), preSupportedLoaded, preSupportedNames.join('|'), colorSets.join('|')])

  // When popover first opens, trigger load if not yet
  useEffect(() => {
    if (open) {
      loadPreSupported()
    }
  }, [open, loadPreSupported])

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="manual-assignee">Assignee</Label>
        <Input
          id="manual-assignee"
          value={manual.assignee || ""}
          onChange={(e) => onUpdate(node.id, { manual: { ...manual, assignee: e.target.value } as any })}
          placeholder="user id or role"
        />
      </div>

      <div className="grid gap-2">
        <Label>Form Schema</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between bg-transparent"
            >
              {selectedName || "Select a form schema..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0">
            <Command>
              <CommandInput placeholder="Search form schemas..." />
              <CommandList>
                <CommandEmpty>No schema found.</CommandEmpty>
                {/* JSON Schemas Group */}
                {jsonSchemaNames.length > 0 && (
                  <CommandGroup heading="JSON Schemas">
                    {jsonSchemaNames.map(name => (
                      <CommandItem
                        key={'js-'+name}
                        value={name}
                        onSelect={() => { onUpdate(node.id, { manual: { ...manual, formSchema: name } as any }); setOpen(false) }}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1">
                          {name}
                        </span>
                        {name === manual.formSchema && <Check className="h-4 w-4 text-emerald-600" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {/* Declared Colors Group */}
                {declaredColorNames.filter(c => !jsonSchemaNames.includes(c)).length > 0 && (
                  <CommandGroup heading="Declared Colors">
                    {declaredColorNames.filter(c => !jsonSchemaNames.includes(c)).map(name => (
                      <CommandItem
                        key={'color-'+name}
                        value={name}
                        onSelect={() => { onUpdate(node.id, { manual: { ...manual, formSchema: name } as any }); setOpen(false) }}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                          {name}
                          <span className="ml-1 rounded bg-amber-100 text-amber-700 px-1 py-px text-[10px] font-medium">color</span>
                        </span>
                        {name === manual.formSchema && <Check className="h-4 w-4 text-emerald-600" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {/* Primitives Group */}
                {BUILT_IN_PRIMITIVES.filter(n => !jsonSchemaNames.includes(n) && !declaredColorNames.includes(n)).length > 0 && (
                  <CommandGroup heading="Primitives">
                    {BUILT_IN_PRIMITIVES.filter(n => !jsonSchemaNames.includes(n) && !declaredColorNames.includes(n)).map(name => (
                      <CommandItem
                        key={'prim-'+name}
                        value={name}
                        onSelect={() => { onUpdate(node.id, { manual: { ...manual, formSchema: name } as any }); setOpen(false) }}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
                          {name}
                          <span className="ml-1 rounded bg-indigo-100 text-indigo-700 px-1 py-px text-[10px] font-medium">primitive</span>
                        </span>
                        {name === manual.formSchema && <Check className="h-4 w-4 text-emerald-600" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {/* Pre-Supported Group */}
                {preSupportedLoaded && preSupportedNames.filter(n => !jsonSchemaNames.includes(n) && !declaredColorNames.includes(n)).length > 0 && (
                  <CommandGroup heading="Pre-Supported">
                    {preSupportedNames.filter(n => !jsonSchemaNames.includes(n) && !declaredColorNames.includes(n)).map(name => (
                      <CommandItem
                        key={'pre-'+name}
                        value={name}
                        onSelect={() => { onUpdate(node.id, { manual: { ...manual, formSchema: name } as any }); setOpen(false) }}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1">
                          {name}
                          <span className="ml-1 rounded bg-neutral-100 text-neutral-600 px-1 py-px text-[10px] font-medium">remote</span>
                        </span>
                        {name === manual.formSchema && <Check className="h-4 w-4 text-emerald-600" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {!preSupportedLoaded && (
                  <div className="px-2 py-1 text-xs text-neutral-500">Loading pre-supported schemas...</div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="manual-layout-schema">Layout Schema (optional)</Label>
        <Textarea
          id="manual-layout-schema"
          rows={3}
          value={manual.layoutSchema || ""}
          onChange={(e) => onUpdate(node.id, { manual: { ...manual, layoutSchema: e.target.value } as any })}
          placeholder="layout schema name or JSON"
        />
      </div>
    </div>
  )
}

function ActionFunctionEditor({ node, onUpdate }: { node: Node<PetriNodeData>; onUpdate: (id: string, patch: Partial<PetriNodeData>) => void }) {
  const actionFunction = (node.data as any).actionFunction || ""
  const [editorHeight, setEditorHeight] = useState<number>(160)
  const resizeRef = useRef<HTMLDivElement | null>(null)
  const dragState = useRef<{ startY: number; startH: number; dragging: boolean }>({ startY:0, startH:160, dragging:false })
  useEffect(() => {
    function onMove(e: MouseEvent){
      if(!dragState.current.dragging) return
      const dy = e.clientY - dragState.current.startY
      const next = Math.min(Math.max(80, dragState.current.startH + dy), 480)
      setEditorHeight(next)
    }
    function onUp(){ dragState.current.dragging = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])
  return (
    <div className="space-y-2 mt-6">
      <Label htmlFor="transition-action-function">Action Function</Label>
      <div className="relative rounded border bg-white" style={{ height: editorHeight }}>
        <CodeMirror
          value={actionFunction}
          height={`${editorHeight - 8}px`}
          theme="light"
          extensions={[EditorView.lineWrapping, StreamLanguage.define(lua)]}
          onChange={(val) => onUpdate(node.id, { actionFunction: val } as any)}
          basicSetup={{
            lineNumbers: true,
            bracketMatching: true,
            closeBrackets: true,
            highlightActiveLine: true,
            indentOnInput: true,
            defaultKeymap: true,
          }}
        />
        <div
          ref={resizeRef}
          onMouseDown={(e) => { dragState.current = { startY: e.clientY, startH: editorHeight, dragging: true } }}
          className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-gradient-to-b from-transparent to-neutral-200"
          aria-label="Resize action function editor"
        />
      </div>
      <p className="text-xs text-neutral-500">Define a Lua function named <code>{`${node.id}_action`}</code>. Example: <code>{`function ${node.id}_action(a,b) return a+b end`}</code></p>
    </div>
  )
}

function ActionOutputsEditor({ node, onUpdate }: { node: Node<PetriNodeData>; onUpdate: (id: string, patch: Partial<PetriNodeData>) => void }) {
  const outputs: string[] = Array.isArray((node.data as any).actionFunctionOutput) ? (node.data as any).actionFunctionOutput : []
  const [draft, setDraft] = useState<string>("")
  const add = () => {
    const name = draft.trim()
    if (!name) return
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return
    const next = outputs.concat(name)
    onUpdate(node.id, { actionFunctionOutput: next } as any)
    setDraft("")
  }
  const remove = (i: number) => {
    const next = outputs.filter((_, idx) => idx !== i)
    onUpdate(node.id, { actionFunctionOutput: next } as any)
  }
  return (
    <div className="space-y-2 mt-4">
      <Label className="text-sm">Action Outputs</Label>
      <div className="flex flex-wrap gap-1">
        {outputs.map((o, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-xs">
            {o}
            <button className="text-red-600" onClick={(e)=>{ e.preventDefault(); remove(i) }} aria-label={`Remove ${o}`}>
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input value={draft} onChange={e=> setDraft(e.target.value)} placeholder="add output name" />
        <Button size="sm" onClick={add}>Add</Button>
      </div>
      <p className="text-xs text-neutral-500">Ordered variables that receive the multiple return values of the action.</p>
    </div>
  )
}

// Inline time trigger editor (cron or delay seconds)

function MessageEditor({
  node,
  onUpdate,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
}) {
  const channel = (node.data as any).message?.channel || ""
  return (
    <div className="space-y-2">
      <Label htmlFor="msg-channel">Message Channel</Label>
      <Input
        id="msg-channel"
        value={channel}
        onChange={(e) =>
          onUpdate(node.id, { message: { ...((node.data as any).message || {}), channel: e.target.value } as any })
        }
        placeholder="topic or endpoint"
      />
    </div>
  )
}

// Generic subpage (hierarchical call) section now independent of transition type.
function SubPageSection({ node, onUpdate }: { node: Node<PetriNodeData>; onUpdate: (id: string, patch: Partial<PetriNodeData>) => void }) {
  const cfg = ((node.data as any).subPage || {}) as any
  const enabled = !!cfg.enabled
  const [expanded, setExpanded] = useState<boolean>(enabled)
  const [inputMap, setInputMap] = useState(() => JSON.stringify(cfg.inputMapping || {}, null, 2))
  const [outputMap, setOutputMap] = useState(() => JSON.stringify(cfg.outputMapping || {}, null, 2))
  const safeParse = (txt: string) => { try { const o = JSON.parse(txt); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {} } catch { return {} } }
  const toggle = (checked: boolean) => {
    onUpdate(node.id, { subPage: { ...cfg, enabled: checked } as any })
    setExpanded(checked)
  }
  return (
    <div className="mt-6 rounded border bg-neutral-50">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
        onClick={() => { if (!enabled) toggle(true); else setExpanded(e => !e) }}
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => toggle(e.target.checked)}
            aria-label="Enable sub workflow call"
            className="h-4 w-4"
          />
          <span>subpage</span>
        </span>
        <span className="text-xs text-neutral-500">{expanded ? 'Collapse' : 'Expand'}</span>
      </button>
      {expanded && enabled && (
        <div className="space-y-3 border-t px-3 py-3">
          <div className="grid gap-1">
            <Label htmlFor="subpage-cpn">Child Workflow ID</Label>
            <Input id="subpage-cpn" value={cfg.cpnId || ''} placeholder="child-cpn-1" onChange={e => onUpdate(node.id, { subPage: { ...cfg, cpnId: e.target.value } as any })} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={!!cfg.autoStart} onChange={e => onUpdate(node.id, { subPage: { ...cfg, autoStart: e.target.checked } as any })} /> Auto Start</label>
            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={!!cfg.propagateOnComplete} onChange={e => onUpdate(node.id, { subPage: { ...cfg, propagateOnComplete: e.target.checked } as any })} /> Propagate On Complete</label>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="subpage-input-map">Input Mapping JSON</Label>
            <Textarea id="subpage-input-map" rows={4} value={inputMap} onChange={e => setInputMap(e.target.value)} onBlur={() => onUpdate(node.id, { subPage: { ...cfg, inputMapping: safeParse(inputMap) } as any })} />
          </div>
            <div className="grid gap-1">
            <Label htmlFor="subpage-output-map">Output Mapping JSON</Label>
            <Textarea id="subpage-output-map" rows={4} value={outputMap} onChange={e => setOutputMap(e.target.value)} onBlur={() => onUpdate(node.id, { subPage: { ...cfg, outputMapping: safeParse(outputMap) } as any })} />
          </div>
          <p className="text-[11px] text-neutral-500">Hierarchical call: maps parent variables to child variables (input) and child back to parent (output).</p>
        </div>
      )}
    </div>
  )
}

// DmnEditor removed (DMN support deprecated). SubPageEditor replaced by generic section.

function LLMEditor({
  node,
  onUpdate,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
}) {
  const llm = ((node.data as any).llm || {
    templateObj: { messages: [] },
    vars: {},
    stream: false,
    options: {},
  }) as any

  const update = (patch: Partial<typeof llm>) => onUpdate(node.id, { llm: { ...llm, ...patch } as any })

  // Keep a text version of vars for simple editing
  const [varsText, setVarsText] = React.useState<string>(() => {
    try { return JSON.stringify(llm.vars || {}, null, 2) } catch { return "{}" }
  })
  React.useEffect(() => {
    // When node changes externally, sync the editor text
    try {
      const next = JSON.stringify(((node.data as any).llm?.vars) || {}, null, 2)
      setVarsText(next)
    } catch {}
  }, [node.id, (node.data as any).llm?.vars])

  const [editorHeight, setEditorHeight] = React.useState<number>(260)

  return (
    <div className="space-y-4">
      <div className="grid gap-1">
        <Label className="text-sm">Messages (Jinja-enabled)</Label>
  <div className="relative rounded border bg-white p-2" style={{ height: editorHeight, overflow: 'auto' }}>
          <LlmMessagesEditor
            value={llm.templateObj || { messages: [] }}
            onChange={(v)=> update({ templateObj: v })}
          />
        </div>
        <p className="text-xs text-neutral-500 mt-1">Compose the prompt as a list of messages. Use Jinja placeholders like <code>{"{{ vars.name }}"}</code> or <code>{"{{ input.q }}"}</code>.</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="llm-vars">Template Vars (JSON, optional)</Label>
        <Textarea
          id="llm-vars"
          rows={4}
          value={varsText}
          onChange={(e) => setVarsText(e.target.value)}
          onBlur={() => { try { const v = JSON.parse(varsText); update({ vars: v }) } catch { /* ignore parse errors */ } }}
          placeholder='e.g. {"tone":"brief"}'
        />
        <p className="text-xs text-neutral-500">These variables are available to the Jinja template as <code>vars.&lt;name&gt;</code> in addition to input bindings.</p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="llm-stream" checked={!!llm.stream} onCheckedChange={(v) => update({ stream: !!v })} />
        <Label htmlFor="llm-stream">Stream responses</Label>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="llm-model">Model override (optional)</Label>
        <Input id="llm-model" placeholder="provider/model" value={((llm.options||{}).model)||""} onChange={(e)=> update({ options: { ...(llm.options||{}), model: e.target.value } })} />
      </div>
    </div>
  )
}

function EdgeEditor({
  edge,
  onUpdate,
  onRenameId,
}: {
  edge: Edge<PetriEdgeData>
  onUpdate: (id: string, patch: Partial<PetriEdgeData>) => void
  onRenameId?: (oldId: string, nextId: string) => { ok: boolean; reason?: string }
}) {
  const [expr, setExpr] = React.useState<string>(() => (edge.data as any)?.expression || "");
  React.useEffect(() => {
    setExpr((edge.data as any)?.expression || "");
  }, [edge.id, (edge.data as any)?.expression]);
  const [idDraft, setIdDraft] = React.useState<string>(edge.id)
  React.useEffect(() => { setIdDraft(edge.id) }, [edge.id])
  const [idError, setIdError] = React.useState<string>("")
  const isValidIdent = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s)
  return (
    <div className="grid gap-2">
      <Label htmlFor="e-id">Arc ID</Label>
      <Input id="e-id" value={idDraft} onChange={(e)=>{ setIdDraft(e.target.value); setIdError("") }} onBlur={()=>{
        if (!onRenameId) return
        const next = idDraft.trim()
        if (!next || next === edge.id) return
        if (!isValidIdent(next)) { setIdError('ID must be a valid Lua identifier'); setIdDraft(edge.id); return }
        const res = onRenameId(edge.id, next)
        if (!res?.ok) { setIdError(res?.reason || 'Rename failed'); setIdDraft(edge.id) }
      }} />
      {idError ? <div className="text-xs text-red-600">{idError}</div> : null}
      <Label htmlFor="e-label">Arc Label</Label>
      <Input
        id="e-label"
        value={(edge.data as any)?.label || ""}
        onChange={(e) => onUpdate(edge.id, { label: e.target.value })}
        placeholder="e.g., guard or weight"
      />
      <Label className="text-sm mt-2">Arc Expression</Label>
      <CodeMirror
        value={expr}
        height="80px"
        extensions={[
          StreamLanguage.define(lua),
          EditorView.lineWrapping,
        ]}
        onChange={v => {
          setExpr(v);
          onUpdate(edge.id, { expression: v } as any);
        }}
        theme="light"
        basicSetup={{ lineNumbers: true }}
        placeholder="Lua expression for arc (e.g., amount > 0)"
      />
      <div className="text-xs text-neutral-500 mt-1">Lua-like arc expression. Example: <code>amount &gt; 0</code></div>
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => onUpdate(edge.id, { readonly: !(edge.data as any)?.readonly } as any)}
          className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${ (edge.data as any)?.readonly ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white'}`}
        >
          <span className="inline-flex items-center gap-1">
            {/* PenOff icon inline to avoid new import churn; could import from lucide-react if already present */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/><path d="m15 5 3 3"/><path d="m2 2 20 20"/></svg>
            ReadOnly
          </span>
          <input type="checkbox" className="hidden" checked={!!(edge.data as any)?.readonly} readOnly />
        </button>
        <span className="text-[10px] text-neutral-500">{(edge.data as any)?.readonly ? 'Will not consume tokens (read arc).' : 'Mark to prevent token consumption.'}</span>
      </div>
    </div>
  )
}
