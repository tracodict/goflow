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
import { StreamLanguage } from '@codemirror/language'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { EditorView } from '@codemirror/view'
import { json } from '@codemirror/lang-json'
import { usePreSupportedSchemas } from './pre-supported-schemas'

type SelectedResolved = { type: "node"; node: Node<PetriNodeData> } | { type: "edge"; edge: Edge<PetriEdgeData> } | null
type PanelMode = "mini" | "normal" | "full"

export function SidePanel({
  open,
  mode,
  width = 360,
  onResizeStart,
  selected,
  onUpdateNode,
  onUpdateEdge,
  onModeChange,
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
  mode: PanelMode
  width?: number
  onResizeStart: () => void
  selected: SelectedResolved
  onUpdateNode: (id: string, patch: Partial<PetriNodeData>) => void
  onUpdateEdge: (id: string, patch: Partial<PetriEdgeData>) => void
  onModeChange: (m: PanelMode) => void
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
  // New: split state between explorer (top) and property (bottom)
  // Start with a fixed value for SSR to avoid hydration mismatch; hydrate actual saved height after mount
  const [explorerHeight, setExplorerHeight] = useState<number>(240)
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('goflow.explorerHeight') : null
      if (saved) {
        const num = parseInt(saved, 10)
        if (!isNaN(num) && num !== explorerHeight) setExplorerHeight(num)
      }
    } catch {/* ignore */}
  // run once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const splitterRef = useRef<HTMLDivElement | null>(null)
  const dragState = useRef<{ startY: number; startHeight: number; dragging: boolean }>({ startY:0, startHeight:0, dragging:false })
  const [, forceRerender] = useState(0)
  const [externalSelection, setExternalSelection] = useState<{ kind: 'place'|'transition'|'arc'; id: string } | null>(null)

  // Drag handlers for vertical splitter
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragState.current.dragging) return
      const dy = e.clientY - dragState.current.startY
      const next = Math.min(Math.max(120, dragState.current.startHeight + dy), 600)
  setExplorerHeight(next)
    }
    function onUp() { dragState.current.dragging = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Persist splitter height
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('goflow.explorerHeight', String(explorerHeight))
    }
  }, [explorerHeight])
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
  

  if (!open || mode === "mini") {
    return null
  }

  const baseStyle: React.CSSProperties =
    mode === "full"
      ? { position: "fixed", inset: 0, zIndex: 50 }
      : { position: "fixed", right: 0, top: 0, bottom: 0, width, zIndex: 50 }

  return (
    <aside
      className="flex flex-col border-l bg-white shadow-lg transform-none overflow-x-visible"
      style={baseStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Side Panel"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-sm font-semibold">Explorer / Properties</div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Mini mode" onClick={() => onModeChange("mini")}> 
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Normal mode" onClick={() => onModeChange("normal")}> 
            <PanelRightOpen className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Full mode" onClick={() => onModeChange("full")}> 
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {mode === "normal" && (
        <div
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize"
          className="absolute left-[-6px] top-0 z-50 h-full w-2 cursor-col-resize"
          onMouseDown={onResizeStart}
        >
          <div className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-neutral-200 p-0.5">
            <GripVertical className="h-3 w-3 text-neutral-500" />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Explorer section */}
        <div style={{ height: explorerHeight }} className="overflow-auto border-b">
          <ExplorerPanel
            workflows={explorerWorkflows}
            onWorkflowSelect={onExplorerSelect}
            onCreateWorkflow={onCreateWorkflow}
            onDeleteWorkflow={onDeleteWorkflow}
            onRenameWorkflow={onRenameWorkflow}
            activeWorkflowId={activeWorkflowId}
            nodes={explorerNodes}
            edges={explorerEdges}
            workflowMeta={workflowMeta}
            onAddPlace={onAddPlace}
            onRenamePlace={onRenamePlace}
            onDeletePlace={onDeletePlace}
            onAddTransition={onAddTransition}
            onRenameTransition={onRenameTransition}
            onDeleteTransition={onDeleteTransition}
            onDeleteArc={onDeleteArc}
            onSelectEntity={onSelectEntity}
            selectedEntity={selectedEntity}
            onRefreshWorkflows={onRefreshWorkflows}
          />
        </div>
        {/* Splitter */}
        <div
          ref={splitterRef}
          onMouseDown={(e) => { dragState.current = { startY: e.clientY, startHeight: explorerHeight, dragging: true } }}
          className="h-2 cursor-row-resize flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 select-none"
        >
          <div className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>
        {/* Property section */}
        <div ref={contentRef} className="flex-1 overflow-y-auto overflow-x-visible p-3">
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
            <Accordion type="multiple" className="w-full">
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
  const [text, setText] = useState<string>(() => {
    try {
      return JSON.stringify(token.data ?? {}, null, 2)
    } catch {
      return "{}"
    }
  })
  const [error, setError] = useState<string | null>(null)
  // Start with a deterministic height for SSR; adjust after mount via effect if needed
  const [editorHeight, setEditorHeight] = useState<number>(180)
  const dragState = useRef<{ startY: number; startH: number; dragging: boolean }>({ startY:0, startH:180, dragging:false })
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
    try {
      const newText = JSON.stringify(token.data ?? {}, null, 2)
      setText((prev) => (prev !== newText ? newText : prev))
      setError(null)
    } catch {
      // ignore
    }
  }, [token])

  const tryApply = () => {
    try {
      const parsed = text.trim() === "" ? {} : JSON.parse(text)
      onChange(parsed)
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
          onChange={(val: string) => setText(val)}
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

  const [guardText, setGuardText] = useState<string>(() => (node as any).guardExpression || (node.data as any).guardExpression || "")
  useEffect(() => {
    const incoming = (node as any).guardExpression || (node.data as any).guardExpression || ""
    setGuardText((prev) => (prev !== incoming ? incoming : prev))
  }, [node.id, (node as any).guardExpression, (node.data as any).guardExpression])

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

      <div className="rounded border bg-neutral-50 px-2 py-1 text-xs text-neutral-600">
        Type: <span className="font-medium capitalize">{tType}</span> (right-click the node to change)
      </div>

  <TypeSpecificEditor node={node} tType={tType} onUpdate={onUpdate} />
  <SubPageSection node={node} onUpdate={onUpdate} />
  <ActionExpressionEditor node={node} onUpdate={onUpdate} />
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
    default:
      return null
  }
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
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([])
  // Pre-supported schemas (lazy from CDN dictionaryUrl)
  const { names: preSupportedNames, loaded: preSupportedLoaded, load: loadPreSupported } = usePreSupportedSchemas()

  // Listen for declarations updates dispatched from DeclarationsPanel apply
  useEffect(() => {
    function sync(e: any) {
      const list: string[] = (e.detail?.next?.jsonSchemas || []).map((s: any) => s.name).filter(Boolean)
      setAvailableSchemas(list)
    }
    window.addEventListener('updateDeclarationsInternal', sync as EventListener)
    return () => window.removeEventListener('updateDeclarationsInternal', sync as EventListener)
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
    // Existing availableSchemas already seeded from workflow events (jsonSchemas). We'll rebuild to include color sets & pre-supported.
    availableSchemas.forEach(s => merged.add(s))
    // Built-in color sets (treated as potential form schema names for quick templates)
    try { ['INT','REAL','STRING','BOOL','UNIT'].forEach(c => merged.add(c)) } catch {/* ignore */}
    if (preSupportedLoaded) preSupportedNames.forEach(n => merged.add(n))
    setAvailableSchemas(Array.from(merged))
  // We intentionally ignore setAvailableSchemas in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSupportedLoaded, preSupportedNames.join('|')])

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
                <CommandGroup>
                  {availableSchemas.map((name) => (
                    <CommandItem
                      key={name}
                      value={name}
                      onSelect={() => {
                        onUpdate(node.id, { manual: { ...manual, formSchema: name } as any })
                        setOpen(false)
                      }}
                      className="flex items-center justify-between"
                    >
                      <span>{name}</span>
                      {name === manual.formSchema ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                    </CommandItem>
                  ))}
                  {!preSupportedLoaded && (
                    <div className="px-2 py-1 text-xs text-neutral-500">Loading pre-supported schemas...</div>
                  )}
                </CommandGroup>
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

function ActionExpressionEditor({ node, onUpdate }: { node: Node<PetriNodeData>; onUpdate: (id: string, patch: Partial<PetriNodeData>) => void }) {
  // actionExpression is now available for all transition types
  const actionExpression = (node.data as any).actionExpression || ""
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
      <Label htmlFor="transition-action-expression">Action Expression</Label>
      <div className="relative rounded border bg-white" style={{ height: editorHeight }}>
        <CodeMirror
          value={actionExpression}
          height={`${editorHeight - 8}px`}
          theme="light"
          extensions={[EditorView.lineWrapping, StreamLanguage.define(lua)]}
          onChange={(val) => onUpdate(node.id, { actionExpression: val } as any)}
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
          aria-label="Resize script editor"
        />
      </div>
      <p className="text-xs text-neutral-500">Lua-like action expression executed when this transition fires.</p>
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
    template: "",
    vars: {},
    stream: false,
    options: {},
  }) as {
    template?: string
    vars?: Record<string, any>
    stream?: boolean
    options?: Record<string, any>
  }

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

  const [editorHeight, setEditorHeight] = React.useState<number>(180)
  const dragRef = React.useRef<{ startY: number; startH: number; dragging: boolean }>({ startY:0, startH:180, dragging:false })
  React.useEffect(() => {
    function onMove(e: MouseEvent){ if(!dragRef.current.dragging) return; const dy = e.clientY - dragRef.current.startY; setEditorHeight(Math.min(Math.max(120, dragRef.current.startH + dy), 560)) }
    function onUp(){ dragRef.current.dragging = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid gap-1">
        <Label className="text-sm">Messages Template (Jinja + JSON)</Label>
    <div className="relative rounded border bg-white" style={{ height: editorHeight }}>
          <CodeMirror
            value={llm.template || ""}
            height={`${editorHeight - 8}px`}
            theme="light"
            // Jinja highlighting optional; install @codemirror/lang-jinja to enable.
            extensions={[EditorView.lineWrapping]}
            onChange={(val) => update({ template: val })}
            basicSetup={{ lineNumbers: true, bracketMatching: true, closeBrackets: true, highlightActiveLine: true, indentOnInput: true, defaultKeymap: true }}
            placeholder='Example:\n[\n  {"role": "system", "content": "You are helpful."},\n  {"role": "user", "content": "Answer in 3 words: {{ q }}"}\n]'
          />
          <div
            onMouseDown={(e) => { dragRef.current = { startY: e.clientY, startH: editorHeight, dragging: true } }}
            className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-gradient-to-b from-transparent to-neutral-200"
            aria-label="Resize LLM messages editor"
          />
        </div>
  <p className="text-xs text-neutral-500 mt-1">Provide a JSON array of messages. You can reference bound variables via Jinja, e.g., <code>{"{{ q }}"}</code>.</p>
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
    </div>
  )
}
