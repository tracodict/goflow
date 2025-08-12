"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { Edge, Node } from "@xyflow/react"
import type { PetriEdgeData, PetriNodeData, TransitionType, Token, PlaceData } from "@/lib/petri-sim"
import { GripVertical, Minimize2, Maximize2, PanelRightOpen, ChevronsUpDown, Check, Plus, Trash2 } from "lucide-react"
import { DmnDecisionTable, type DecisionTable } from "./dmn-decision-table"
import { FORM_SCHEMAS } from "@/lib/form-schemas"
import { CronLite as Cron } from "@/components/petri/cron-lite"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { FloatingCodeMirror } from "./floating-codemirror"

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
  inscriptionOpenForTransitionId,
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
  inscriptionOpenForTransitionId?: string
}) {
  const contentRef = useRef<HTMLDivElement | null>(null)

  if (!open || mode === "mini") {
    return null
  }

  const title = "Properties"
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
      aria-label={title}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
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

      <div ref={contentRef} className="flex-1 overflow-y-auto overflow-x-visible p-3">
        {!selected ? (
          <div className="text-xs text-neutral-500">Select a node or edge to edit its properties.</div>
        ) : selected.type === "node" ? (
          selected.node.type === "place" ? (
            <PlaceEditor
              node={selected.node}
              onUpdate={onUpdateNode}
              forceOpenTokens={tokensOpenForPlaceId === selected.node.id}
              scrollContainerRef={contentRef}
            />
          ) : (
            <TransitionEditor
              node={selected.node}
              onUpdate={onUpdateNode}
              focusInscription={inscriptionOpenForTransitionId === selected.node.id}
              scrollContainerRef={contentRef}
            />
          )
        ) : (
          <EdgeEditor edge={selected.edge} onUpdate={onUpdateEdge} />
        )}
      </div>
    </aside>
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
              {tokenList.map((tok, idx) => (
                <AccordionItem key={tok.id} value={tok.id} className="border rounded mb-2">
                  <AccordionTrigger className="px-3 py-2 text-sm no-underline hover:no-underline">
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate">
                        #{idx + 1} — {tok.id}
                      </span>
                      <span className="text-xs text-neutral-500">{new Date(tok.createdAt).toLocaleString()}</span>
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
              ))}
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
  const anchorRef = useRef<HTMLDivElement | null>(null)

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
      {/* Anchor placeholder in the panel; real editor renders in a fixed portal */}
      <div ref={anchorRef} className="rounded border transform-none" style={{ height: 180 }}>
        <div className="sr-only">Floating editor anchor</div>
      </div>
      <FloatingCodeMirror
        anchorRef={anchorRef}
        scrollParents={[window, ...(scrollContainerRef.current ? [scrollContainerRef.current] : [])]}
        height={180}
        language="json"
        value={text}
        onChange={(val) => setText(val)}
        placeholder="{ ... }"
      />
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
            <Input value={new Date(token.updatedAt).toLocaleString()} readOnly />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TransitionEditor({
  node,
  onUpdate,
  focusInscription,
  scrollContainerRef,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
  focusInscription?: boolean
  scrollContainerRef: React.RefObject<HTMLElement | null>
}) {
  const tType = ((node.data as any).tType || "manual") as TransitionType
  const inscRef = useRef<HTMLDivElement | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (focusInscription && inscRef.current) {
      inscRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [focusInscription])

  const [inscriptionText, setInscriptionText] = useState<string>(() => (node.data as any).inscription || "")
  useEffect(() => {
    const incoming = (node.data as any).inscription || ""
    setInscriptionText((prev) => (prev !== incoming ? incoming : prev))
  }, [node.id, (node.data as any).inscription])

  useEffect(() => {
    const h = window.setTimeout(() => onUpdate(node.id, { inscription: inscriptionText } as any), 150)
    return () => window.clearTimeout(h)
  }, [inscriptionText, node.id, onUpdate])

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
        <Label className="text-sm">Inscription (FEEL)</Label>
        {/* Anchor placeholder; actual editor is floated in a portal */}
        <div ref={anchorRef} className="rounded border transform-none" style={{ height: 160 }}>
          <div className="sr-only">Floating editor anchor</div>
        </div>
        <FloatingCodeMirror
          anchorRef={anchorRef}
          scrollParents={[window, ...(scrollContainerRef.current ? [scrollContainerRef.current] : [])]}
          height={160}
          language="javascript"
          value={inscriptionText}
          onChange={(val) => setInscriptionText(val)}
          placeholder='if amount > 1000 then "review" else "auto"'
        />
        <p className="text-xs text-neutral-500">
          FEEL-like expression. Using Shell syntax highlight for readability. Example:{" "}
          {'if amount > 1000 then "review" else "auto"'}.
        </p>
      </div>

      <div className="rounded border bg-neutral-50 px-2 py-1 text-xs text-neutral-600">
        Type: <span className="font-medium capitalize">{tType}</span> (right-click the node to change)
      </div>

      <TypeSpecificEditor node={node} tType={tType} onUpdate={onUpdate} />
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
    case "manual":
      return <ManualEditor node={node} onUpdate={onUpdate} />
    case "auto":
      return <AutoEditor node={node} onUpdate={onUpdate} />
    case "timer":
      return <TimerEditor node={node} onUpdate={onUpdate} />
    case "message":
      return <MessageEditor node={node} onUpdate={onUpdate} />
    case "dmn":
      return <DmnEditor node={node} onUpdate={onUpdate} />
    case "llm":
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
  const manual = ((node.data as any).manual || {}) as { assignee?: string; formSchemaId?: string }
  const [open, setOpen] = useState(false)
  const selected = FORM_SCHEMAS.find((f) => f.id === manual.formSchemaId)

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
                      key={schema.id}
                      value={schema.name}
                      onSelect={() => {
                        onUpdate(node.id, { manual: { ...manual, formSchemaId: schema.id } as any })
                        setOpen(false)
                      }}
                      className="flex items-center justify-between"
                    >
                      <span>{schema.name}</span>
                      {schema.id === manual.formSchemaId ? <Check className="h-4 w-4 text-emerald-600" /> : null}
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

function AutoEditor({
  node,
  onUpdate,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
}) {
  const script = (node.data as any).auto?.script || ""
  return (
    <div className="space-y-2">
      <Label htmlFor="auto-script">Script</Label>
      <textarea
        id="auto-script"
        className="w-full rounded border p-2 text-sm"
        rows={6}
        value={script}
        onChange={(e) =>
          onUpdate(node.id, { auto: { ...((node.data as any).auto || {}), script: e.target.value } as any })
        }
        placeholder="// JS script or function name"
      />
    </div>
  )
}

function TimerEditor({
  node,
  onUpdate,
}: {
  node: Node<PetriNodeData>
  onUpdate: (id: string, patch: Partial<PetriNodeData>) => void
}) {
  const timer = ((node.data as any).timer || {}) as { delayMs?: number; cron?: string }
  const delayMs = timer.delayMs ?? 0
  const cron = timer.cron || ""
  const [cronError, setCronError] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="timer-delay">Delay (ms)</Label>
        <Input
          id="timer-delay"
          type="number"
          min={0}
          value={delayMs}
          onChange={(e) =>
            onUpdate(node.id, { timer: { ...timer, delayMs: Math.max(0, Number(e.target.value || 0)) } as any })
          }
          placeholder="e.g., 1000"
        />
        <p className="text-xs text-neutral-500">Optional one-shot delay after enablement.</p>
      </div>

      <div className="space-y-2">
        <Label>Crontab Schedule</Label>
        <div className="rounded-md border p-2">
          <Cron
            value={cron}
            setValue={(v) => onUpdate(node.id, { timer: { ...timer, cron: v } as any })}
            onError={(e) => setCronError(e ? e.description : null)}
            humanizeLabels
            humanizeValue
            leadingZero
            clearButton
          />
        </div>
        {cronError ? <p className="text-xs text-red-600">{cronError}</p> : null}
        <p className="text-xs text-neutral-500">
          Define a recurring schedule with a standard cron expression. Leave blank if not required.
        </p>
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
  return (
    <div className="mt-2 space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="e-label">Arc Label</Label>
        <Input
          id="e-label"
          value={(edge.data as any)?.label || ""}
          onChange={(e) => onUpdate(edge.id, { label: e.target.value })}
          placeholder="e.g., guard or weight"
        />
      </div>
    </div>
  )
}
