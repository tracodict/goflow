"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import ExplorerPanel from "./explorer-panel"
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
import { DmnDecisionTable, type DecisionTable } from "./dmn-decision-table"
import { FORM_SCHEMAS } from "@/lib/form-schemas"
import { CronLite as Cron } from "@/components/petri/cron-lite"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import CodeMirror from '@uiw/react-codemirror'
import { StreamLanguage } from '@codemirror/language'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { EditorView } from '@codemirror/view'
import { json } from '@codemirror/lang-json'

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
}: {
  open: boolean
  mode: PanelMode
  width?: number
  onResizeStart: () => void
  selected: SelectedResolved
  onUpdateNode: (id: string, patch: Partial<PetriNodeData>) => void
  onUpdateEdge: (id: string, patch: Partial<PetriEdgeData>) => void
  onModeChange: (m: PanelMode) => void
  tokensOpenForPlaceId?: string
  guardOpenForTransitionId?: string
  tab: 'property' | 'explorer'
  setTab: (tab: 'property' | 'explorer') => void
  explorerWorkflows?: any[]
  onExplorerSelect?: (workflowId: string) => void
  onCreateWorkflow?: () => void
  onDeleteWorkflow?: (id: string) => void
  onRenameWorkflow?: (id: string, name: string) => void
  workflowMeta?: Record<string, { name: string; description?: string; colorSets: string[] }>
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
  onSelectEntity?: (kind: 'place'|'transition'|'arc'|'colorSets', id: string) => void
  selectedEntity?: { kind: 'place'|'transition'|'arc'|'colorSets'; id: string } | null
  onRefreshWorkflows?: () => void
}) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  // New: split state between explorer (top) and property (bottom)
  const [explorerHeight, setExplorerHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 240
    const saved = window.localStorage.getItem('goflow.explorerHeight')
    const num = saved ? parseInt(saved, 10) : 240
    return isNaN(num) ? 240 : num
  })
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
            onColorSetsChange={onColorSetsChange}
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
            if (selectedEntity?.kind === 'colorSets' && activeWorkflowId) {
              const meta = workflowMeta?.[activeWorkflowId]
              return <ColorSetsEditor value={meta?.colorSets || []} onChange={(next) => {
                const ev = new CustomEvent('updateColorSetsInternal', { detail: { next } })
                window.dispatchEvent(ev)
              }} />
            }
            // Prefer canvas selection; fallback to externalSelection if nothing selected (colorSets handled above)
            const effectiveSelected = selected || (externalSelection ? { type: externalSelection.kind === 'arc' ? 'edge' : 'node', ...(externalSelection.kind === 'arc' ? { edge: { id: externalSelection.id } as any } : { node: { id: externalSelection.id, type: externalSelection.kind === 'place' ? 'place':'transition', data: {} } as any }) } as SelectedResolved : null)
            if (!effectiveSelected) return <div className="text-xs text-neutral-500">Select an element in the explorer or canvas.</div>
            if (effectiveSelected.type === 'node') {
              const node = effectiveSelected.node
              if (node.type === 'place') {
                return <PlaceEditor node={node} onUpdate={onUpdateNode} forceOpenTokens={tokensOpenForPlaceId === node.id} scrollContainerRef={contentRef} />
              }
              return <TransitionEditor node={node} onUpdate={onUpdateNode} focusGuard={guardOpenForTransitionId === node.id} scrollContainerRef={contentRef} />
            }
            return <EdgeEditor edge={effectiveSelected.edge} onUpdate={onUpdateEdge} />
          })()}
        </div>
      </div>
    </aside>
  )
}

function ColorSetsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(() => value.join('\n'))
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (!dirty) setText(value.join('\n')) }, [value.join('|')])
  const apply = () => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    onChange(lines)
    setDirty(false)
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Color Sets</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={!dirty} onClick={apply}>Apply</Button>
        </div>
      </div>
      <p className="text-[11px] text-neutral-500">One definition per line. Example: <code>colset INT = int;</code></p>
      <div className="rounded border bg-white">
        <CodeMirror
          value={text}
            height="220px"
            theme="light"
            extensions={[EditorView.lineWrapping, StreamLanguage.define(lua)]}
            onChange={(val: string) => { setText(val); setDirty(true) }}
            basicSetup={{ lineNumbers: true, bracketMatching: true, highlightActiveLine: false }}
        />
      </div>
      <div className="text-[11px] text-neutral-400 flex items-center justify-between">
        <span>{text.split(/\r?\n/).filter(l=>l.trim().length>0).length} lines</span>
        {dirty && <span className="text-amber-600">Unsaved</span>}
      </div>
    </div>
  )
}

function PlaceEditor({
  node,
  onUpdate,
  forceOpenTokens,
  scrollContainerRef,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
  forceOpenTokens?: boolean
  scrollContainerRef: React.RefObject<HTMLElement | null>
}) {
  const place = node.data as PlaceData
  const [section, setSection] = useState<"tokens" | "details">(forceOpenTokens ? "tokens" : "details")

  useEffect(() => {
    if (forceOpenTokens) setSection("tokens")
  }, [forceOpenTokens])

  const tokenList = useMemo<Token[]>(() => place.tokenList || [], [place.tokenList])

  const syncCount = () => onUpdate(node.id, { tokens: tokenList.length })

  const addToken = () => {
    const list = [
      ...tokenList,
      { id: `tok-${Math.random().toString(36).slice(2, 8)}`, data: {}, createdAt: Date.now() },
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
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={place.name || ""}
              onChange={(e) => onUpdate(node.id, { name: e.target.value })}
              placeholder="Place name"
            />
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
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={!!place.isStart}
                onChange={e => onUpdate(node.id, { isStart: e.target.checked })}
              />
              Start Place
            </label>
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
                return (
                  <AccordionItem key={tok.id || idx} value={tok.id || `tok-${idx}`} className="border rounded mb-2">
                    <AccordionTrigger className="px-3 py-2 text-sm no-underline hover:no-underline">
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate">
                          #{idx + 1} — {tok.id}
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
  focusGuard,
  scrollContainerRef,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
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
      <div className="mt-6 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Time Trigger</Label>
        </div>
        <TimeEditor node={node} onUpdate={onUpdate} />
        <p className="text-xs text-neutral-500">If neither delay nor cron provided, transition fires immediately when enabled.</p>
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
      return <AutoEditor node={node} onUpdate={onUpdate} />
    case "Message":
      return <MessageEditor node={node} onUpdate={onUpdate} />
    case "Dmn":
      return <DmnEditor node={node} onUpdate={onUpdate} />
    case "Llm":
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
  const manual = ((node.data as any).manual || {}) as { assignee?: string; formSchemaId?: number }
  const [open, setOpen] = useState(false)
  const selected = FORM_SCHEMAS.find((f) => f.component_id === manual.formSchemaId)

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
              {selected ? selected.name : "Select a form schema..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0">
            <Command>
              <CommandInput placeholder="Search form schemas..." />
              <CommandList>
                <CommandEmpty>No schema found.</CommandEmpty>
                <CommandGroup>
                  {FORM_SCHEMAS.map((schema) => (
                    <CommandItem
                      key={schema.component_id}
                      value={schema.name}
                      onSelect={() => {
                        onUpdate(node.id, { manual: { ...manual, formSchemaId: schema.component_id } as any })
                        setOpen(false)
                      }}
                      className="flex items-center justify-between"
                    >
                      <span>{schema.name}</span>
                      {schema.component_id === manual.formSchemaId ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function AutoEditor({ node, onUpdate }: { node: Node<PetriNodeData>; onUpdate: (id: string, patch: Partial<PetriNodeData>) => void }) {
  const script = (node.data as any).auto?.script || ""
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
    <div className="space-y-2">
      <Label htmlFor="auto-script">Script</Label>
      <div className="relative rounded border bg-white" style={{ height: editorHeight }}>
        <CodeMirror
          value={script}
          height={`${editorHeight - 8}px`}
          theme="light"
          extensions={[EditorView.lineWrapping, StreamLanguage.define(lua)]}
          onChange={(val) =>
            onUpdate(node.id, { auto: { ...((node.data as any).auto || {}), script: val } as any })
          }
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
      <p className="text-xs text-neutral-500">Lua script or function body.</p>
    </div>
  )
}

// Inline time trigger editor (cron or delay seconds)
function TimeEditor({ node, onUpdate }: { node: Node<PetriNodeData>; onUpdate: (id: string, patch: Partial<PetriNodeData>) => void }) {
  const time = ((node.data as any).time || {}) as { cron?: string; delaySec?: number }
  const delaySec = time.delaySec ?? 0
  const cron = time.cron || ""
  const [cronError, setCronError] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label htmlFor="time-delay">Delay (seconds)</Label>
        <Input
          id="time-delay"
          type="number"
          min={0}
            value={delaySec}
            onChange={(e) => onUpdate(node.id, { time: { ...time, delaySec: Math.max(0, Number(e.target.value || 0)), cron } as any })}
          placeholder="e.g., 30"
        />
        <p className="text-xs text-neutral-500">Optional one-shot delay after all preconditions are satisfied.</p>
      </div>
      <div className="grid gap-2">
        <Label>Crontab Schedule</Label>
        <div className="rounded-md border p-2">
          <Cron
            value={cron}
            setValue={(v) => onUpdate(node.id, { time: { ...time, cron: v || undefined, delaySec } as any })}
            onError={(e) => setCronError(e ? e.description : null)}
          />
        </div>
        {cronError ? <p className="text-xs text-red-600">{cronError}</p> : null}
        <p className="text-xs text-neutral-500">Provide either a cron schedule or a delay; both may be combined.</p>
      </div>
    </div>
  )
}

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

function DmnEditor({
  node,
  onUpdate,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
}) {
  const value = ((node.data as any).dmnDefinition || {
    name: "Decision",
    hitPolicy: "U",
    inputs: [{ id: "in-1", label: "amount", expression: "amount" }],
    outputs: [{ id: "out-1", label: "approved" }],
    rules: [{ when: ["> 1000"], then: ["no"] }],
  }) as DecisionTable

  return (
    <div className="space-y-2">
      <Label>Decision Table</Label>
      <div className="rounded border">
        <DmnDecisionTable model={value} onChange={(m) => onUpdate(node.id, { dmnDefinition: m } as any)} height={360} />
      </div>
      <div className="text-xs text-neutral-500">
        This built-in editor mimics jdm-editor's decision table behavior for quick prototyping.
      </div>
    </div>
  )
}

function LLMEditor({
  node,
  onUpdate,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
}) {
  const llm = ((node.data as any).llm || {
    system: "",
    user: "",
    extras: [],
    jsonOutput: false,
    jsonSchema: "",
    retryOnError: false,
    maxRetries: 1,
    retryIntervalSec: 5,
  }) as {
    system?: string
    user?: string
    extras?: string[]
    jsonOutput?: boolean
    jsonSchema?: string
    retryOnError?: boolean
    maxRetries?: number
    retryIntervalSec?: number
  }

  const update = (patch: Partial<typeof llm>) => onUpdate(node.id, { llm: { ...llm, ...patch } as any })

  const addExtra = () => update({ extras: [...(llm.extras || []), ""] })
  const removeExtra = (i: number) => update({ extras: (llm.extras || []).filter((_, idx) => idx !== i) })
  const updateExtra = (i: number, val: string) =>
    update({ extras: (llm.extras || []).map((v, idx) => (idx === i ? val : v)) })

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="llm-system">System prompt</Label>
        <Textarea
          id="llm-system"
          rows={4}
          value={llm.system || ""}
          onChange={(e) => update({ system: e.target.value })}
          placeholder="You are a helpful assistant..."
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="llm-user">User prompt (optional)</Label>
        <Textarea
          id="llm-user"
          rows={3}
          value={llm.user || ""}
          onChange={(e) => update({ user: e.target.value })}
          placeholder="Provide details for the task..."
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Other prompts (optional)</Label>
          <Button size="sm" variant="outline" onClick={addExtra}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        {(llm.extras || []).length === 0 ? (
          <p className="text-xs text-neutral-500">No additional prompts. Click Add to insert one.</p>
        ) : (
          <div className="grid gap-2">
            {(llm.extras || []).map((p, i) => (
              <div key={`xp-${i}`} className="flex items-start gap-2">
                <Textarea
                  rows={2}
                  value={p}
                  onChange={(e) => updateExtra(i, e.target.value)}
                  placeholder="Additional instruction or context..."
                  className="flex-1"
                />
                <Button size="icon" variant="ghost" onClick={() => removeExtra(i)} title="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2 rounded border p-2">
        <div className="flex items-center gap-2">
          <Checkbox id="llm-json" checked={!!llm.jsonOutput} onCheckedChange={(v) => update({ jsonOutput: !!v })} />
          <Label htmlFor="llm-json">JSON output</Label>
        </div>
        {llm.jsonOutput ? (
          <div className="mt-2 grid gap-2">
            <Label htmlFor="llm-json-schema">JSON schema (optional)</Label>
            <Textarea
              id="llm-json-schema"
              rows={5}
              value={llm.jsonSchema || ""}
              onChange={(e) => update({ jsonSchema: e.target.value })}
              placeholder='e.g. {"type":"object","properties":{...}}'
            />
          </div>
        ) : null}
      </div>
      <div className="space-y-2 rounded border p-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="llm-retry"
            checked={!!llm.retryOnError}
            onCheckedChange={(v) => update({ retryOnError: !!v })}
          />
          <Label htmlFor="llm-retry">Retry on error</Label>
        </div>
        {llm.retryOnError ? (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="llm-retries">Max retries</Label>
              <Input
                id="llm-retries"
                type="number"
                min={0}
                value={llm.maxRetries ?? 1}
                onChange={(e) => update({ maxRetries: Math.max(0, Number(e.target.value || 0)) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="llm-interval">Retry interval (sec)</Label>
              <Input
                id="llm-interval"
                type="number"
                min={1}
                value={llm.retryIntervalSec ?? 5}
                onChange={(e) => update({ retryIntervalSec: Math.max(1, Number(e.target.value || 1)) })}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EdgeEditor({
  edge,
  onUpdate,
}: {
  edge: Edge<PetriEdgeData>
  onUpdate: (id: string, patch: Partial<PetriEdgeData>) => void
}) {
  const [expr, setExpr] = React.useState<string>(() => (edge.data as any)?.expression || "");
  React.useEffect(() => {
    setExpr((edge.data as any)?.expression || "");
  }, [edge.id, (edge.data as any)?.expression]);
  return (
    <div className="grid gap-2">
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
