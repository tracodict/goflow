"use client"

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
// @ts-ignore dynamic form shared component (run mode)
import { DynamicForm } from '@/components/run/forms/dynamic-form'
import "@xyflow/react/dist/style.css"
import {
  Background,
  Controls,
  ControlButton,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnectStart,
  type OnConnectEnd,
  ConnectionLineType,
} from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Activity, Check, File, Play, RotateCcw, Trash2, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PlaceNode } from "./place-node"
import { TransitionNode } from "./transition-node"
import { LabeledEdge } from "./labeled-edge"
import { SidePanel } from "./side-panel"
import { SystemSettingsProvider } from "./system-settings-context"
import { useSystemSettings } from "./system-settings-context"
import { type PetriEdgeData, type PetriNodeData, type TransitionType } from "@/lib/petri-types"
import { serverToGraph, graphToServer, type ServerWorkflow } from "@/lib/workflow-conversion"
// consolidated petri client import
import { fetchWorkflow, fetchTransitionsStatus, fetchMarking, fireTransition as fireTransitionApi, simulationStep, saveWorkflow, deleteWorkflowApi, resetWorkflow, withApiErrorToast, listMcpTools, listRegisteredMcpServers, registerMcpServer, deregisterMcpServer } from "./petri-client"
import { toast } from '@/hooks/use-toast'
import { MonitorPanel } from './monitor-panel'
import { useSimulation } from '@/hooks/use-simulation'
import { safeParseJSON as safeParse, inferSchemaFromSample, extractBindingValue, computeEffectiveSchema, deriveSampleFromIncomingPlaces } from '@/components/util/manual-form-utils'
import { TransitionIcon } from './transition-icon'
import { CanvasControls } from './canvas-controls'
import { useMonitor } from '@/hooks/use-monitor'
import { useGraphEditing } from '@/hooks/use-graph-editing'
import { computePetriLayout } from '@/lib/auto-layout'
import { validateWorkflow } from './petri-client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button as UIButton } from '@/components/ui/button'
import { useFlowServiceUrl } from '@/hooks/use-flow-service-url'
import CodeMirror from '@uiw/react-codemirror'
import { useWorkspace } from '@/stores/workspace-store'
import { useFlowWorkspaceStoreContext } from '@/stores/petri/flow-editor-context'
import { setTabState } from '@/stores/pagebuilder/tab-state-cache'

const nodeTypes = { place: PlaceNode, transition: TransitionNode } as any
const edgeTypes = { labeled: LabeledEdge } as any

// Default color sets always present in a workflow unless explicitly overridden
const DEFAULT_COLOR_SETS = ['INT','REAL','STRING','BOOL','UNIT']

type SelectedRef = { type: "node"; id: string } | { type: "edge"; id: string } | null
type SelectedResolved = { type: "node"; node: Node<PetriNodeData> } | { type: "edge"; edge: Edge<PetriEdgeData> } | null


export function FlowWorkspace() {
  return (
    <SystemSettingsProvider>
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </SystemSettingsProvider>
  )
}

function CanvasInner() {
  // (All these states/refs are now declared at the top of CanvasInner)
  // All state/hooks used in onExplorerSelect must be declared before it
  // All state/hooks used in onExplorerSelect and throughout CanvasInner
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PetriNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<PetriEdgeData>>([])
  // keep refs to the latest nodes/edges so event handlers can read current state
  const nodesRef = useRef<Node<PetriNodeData>[]>([])
  const edgesRef = useRef<Edge<PetriEdgeData>[]>([])
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])
  // History management (present/past/future) to support reliable undo/redo
  type Snapshot = { nodes: Node<PetriNodeData>[]; edges: Edge<PetriEdgeData>[] }
  const historyRef = useRef<{ past: Snapshot[]; present: Snapshot | null; future: Snapshot[] }>({ past: [], present: null, future: [] })
  const isRestoringRef = useRef(false)
  const isLoadingWorkflowRef = useRef(false)
  const [selectedRef, setSelectedRef] = useState<SelectedRef>(null)
  // panelMode removed: side panel resize is controlled externally now
  const [panelWidth, setPanelWidth] = useState<number>(360)
  const [resizing, setResizing] = useState(false)
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)
  const [editedMap, setEditedMap] = useState<Record<string, boolean>>({});
  const saveWorkspaceFile = useWorkspace(state => state.saveFile)
  const markWorkspaceFileDirty = useWorkspace(state => state.markFileDirty)
  const workspacePathByIdRef = useRef<Record<string, string>>({})
  const workspaceIdByPathRef = useRef<Record<string, string>>({})
  const [contextMenu, setContextMenu] = useState<{
    open: boolean
    x: number
    y: number 
    nodeId: string | null
  }>({
    open: false,
    x: 0,
    y: 0,
    nodeId: null,
  })
  const flowStore = useFlowWorkspaceStoreContext()
  const [showSystem, setShowSystem] = useState<boolean>(false)
  const [systemTab, setSystemTab] = useState<'simulation' | 'settings' | 'mcp'>('simulation')
  // Removed workflow picker state (direct simulation start only)
  // MCP state
  type McpServer = { id: string; name: string; baseUrl: string; timeoutMs?: number; toolCount?: number; description?: string }
  const [mcpServers, setMcpServers] = useState<McpServer[]>([])
  const [mcpSearch, setMcpSearch] = useState('')
  const [mcpLoading, setMcpLoading] = useState(false)
  const [mcpError, setMcpError] = useState<string | null>(null)
  const [mcpAddOpen, setMcpAddOpen] = useState(false)
  const [mcpDetailsOpen, setMcpDetailsOpen] = useState<{ open: boolean; server?: McpServer }>({ open: false })
  const [mcpDetails, setMcpDetails] = useState<any[]>([])
  const [mcpDetailsExpanded, setMcpDetailsExpanded] = useState<Record<number, boolean>>({})
  const [mcpAddForm, setMcpAddForm] = useState<{ baseUrl: string; name: string; id: string; timeoutMs?: number }>({ baseUrl: '', name: '', id: '' })
  const [mcpDiscovering, setMcpDiscovering] = useState(false)
  const [mcpDiscovered, setMcpDiscovered] = useState<any[] | null>(null)
  const [mcpDeleteConfirm, setMcpDeleteConfirm] = useState<{ open: boolean; server?: McpServer }>({ open: false })
  const [monitorTabs, setMonitorTabs] = useState<string[]>([])
  const [activeMonitorTab, setActiveMonitorTab] = useState<string>('root')
  // Simulation state (initialized after settings available)
  const { settings } = useSystemSettings();
  const flowServiceUrl = useFlowServiceUrl()
  const { sims, activeSimId, activeSim, start: startSim, select: selectSim, step: stepSim, stepInteractive: stepSimInteractive, fire: fireSim, run: runSim, remove: deleteSim, refreshActive: refreshSim, loading: simLoading, running: simRunning } = useSimulation({ flowServiceUrl: flowServiceUrl ?? undefined, workflowId: activeWorkflowId })
  const [simStepLimit, setSimStepLimit] = useState(50)
  // (Moved manual sim form utilities after workflowMeta definition for ordering)
  // Sync simulation marking onto canvas place nodes
  useEffect(() => {
    if (!activeSim || !activeSim.marking) return
    const mkRaw: any = activeSim.marking.places && typeof activeSim.marking.places === 'object' ? activeSim.marking.places : activeSim.marking
    setNodes(nds => nds.map(n => {
      if (n.type !== 'place') return n
      const name = (n.data as any)?.name
      const tokensServer: any[] = Array.isArray(mkRaw[n.id]) ? mkRaw[n.id] : (Array.isArray(mkRaw[name]) ? mkRaw[name] : [])
      const list = tokensServer.map((t, idx) => {
        const val = t?.value !== undefined ? t.value : (t?.data !== undefined ? t.data : t)
        const ts = typeof t?.timestamp === 'number' ? t.timestamp : 0
        return { id: t?.id || `simtok-${n.id}-${idx}`, data: val, createdAt: ts, serverTimestamp: t?.timestamp }
      })
      // Avoid unnecessary object churn if counts & first ids match
      const prevList: any[] = (n.data as any).tokenList || []
      if (prevList.length === list.length && prevList.every((p,i)=> p.data === list[i].data)) {
        return n
      }
      return { ...n, data: { ...(n.data as any), tokens: list.length, tokenList: list } }
    }))
  }, [activeSim?.marking, activeSim?.caseId, setNodes])
  const [leftTab, setLeftTab] = useState<'property' | 'explorer'>("property")
  const [interactive, setInteractive] = useState<boolean>(true)
  const [tokensOpenForPlaceId, setTokensOpenForPlaceId] = useState<string | null>(null)
  const [guardOpenForTransitionId, setGuardOpenForTransitionId] = useState<string | null>(null)
  const [validationOpen, setValidationOpen] = useState(false)
  const [violations, setViolations] = useState<any[]>([])
  const [validating, setValidating] = useState(false)
  // Use a ref for connect state so it's available synchronously on first drag
  const connectStateRef = useRef<{
    start: { nodeId?: string | null; handleType?: "source" | "target" | null } | null
    inProgress: boolean
    completed: boolean
    cancel: boolean
  }>({
    start: null,
    inProgress: false,
    completed: false,
    cancel: false,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow()
  // --- Helpers to rename IDs (used by property panel) ---
  const isValidIdent = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s)
  const renamePlaceId = useCallback((oldId: string, nextId: string): { ok: boolean; reason?: string } => {
    if (!nextId || !isValidIdent(nextId)) return { ok: false, reason: 'Invalid identifier' }
    if (oldId === nextId) return { ok: true }
    // uniqueness across all nodes
    if (nodes.some(n => n.id === nextId)) return { ok: false, reason: 'ID already exists' }
    setNodes((nds) => nds.map(n => (n.id === oldId && n.type === 'place') ? { ...n, id: nextId } as any : n))
    setEdges((eds) => eds.map(e => {
      let changed = false
      let src = e.source, tgt = e.target
      if (e.source === oldId) { src = nextId; changed = true }
      if (e.target === oldId) { tgt = nextId; changed = true }
      return changed ? { ...e, source: src, target: tgt } : e
    }))
    if (tokensOpenForPlaceId === oldId) setTokensOpenForPlaceId(nextId)
    if (selectedRef && selectedRef.type === 'node' && selectedRef.id === oldId) setSelectedRef({ type: 'node', id: nextId })
    setEditedMap(prev => activeWorkflowId ? { ...prev, [activeWorkflowId]: true } : prev)
    return { ok: true }
  }, [nodes, edges, tokensOpenForPlaceId, selectedRef, activeWorkflowId])

  const renameTransitionId = useCallback((oldId: string, nextId: string): { ok: boolean; reason?: string } => {
    if (!nextId || !isValidIdent(nextId)) return { ok: false, reason: 'Invalid identifier' }
    if (oldId === nextId) return { ok: true }
    if (nodes.some(n => n.id === nextId)) return { ok: false, reason: 'ID already exists' }
    setNodes((nds) => nds.map(n => (n.id === oldId && n.type === 'transition') ? { ...n, id: nextId } as any : n))
    setEdges((eds) => eds.map(e => {
      let changed = false
      let src = e.source, tgt = e.target
      if (e.source === oldId) { src = nextId; changed = true }
      if (e.target === oldId) { tgt = nextId; changed = true }
      return changed ? { ...e, source: src, target: tgt } : e
    }))
    if (guardOpenForTransitionId === oldId) setGuardOpenForTransitionId(nextId)
    if (selectedRef && selectedRef.type === 'node' && selectedRef.id === oldId) setSelectedRef({ type: 'node', id: nextId })
    setEditedMap(prev => activeWorkflowId ? { ...prev, [activeWorkflowId]: true } : prev)
    return { ok: true }
  }, [nodes, edges, guardOpenForTransitionId, selectedRef, activeWorkflowId])

  const renameEdgeId = useCallback((oldId: string, nextId: string): { ok: boolean; reason?: string } => {
    if (!nextId || !isValidIdent(nextId)) return { ok: false, reason: 'Invalid identifier' }
    if (oldId === nextId) return { ok: true }
    if (edges.some(e => e.id === nextId)) return { ok: false, reason: 'ID already exists' }
    setEdges((eds) => eds.map(e => e.id === oldId ? { ...e, id: nextId } : e))
    if (selectedRef && selectedRef.type === 'edge' && selectedRef.id === oldId) setSelectedRef({ type: 'edge', id: nextId })
    setEditedMap(prev => activeWorkflowId ? { ...prev, [activeWorkflowId]: true } : prev)
    return { ok: true }
  }, [edges, selectedRef, activeWorkflowId])

  // Server workflow state for server mode
  const [serverWorkflows, setServerWorkflows] = useState<any[]>([]);
  const [serverWorkflowsFetched, setServerWorkflowsFetched] = useState(false);
  const [serverWorkflowCache, setServerWorkflowCache] = useState<Record<string, ServerWorkflow>>({});
  const [workflowGraphCache, setWorkflowGraphCache] = useState<Record<string, { nodes: Node<PetriNodeData>[]; edges: Edge<PetriEdgeData>[] }>>({})
  const [workflowMeta, setWorkflowMeta] = useState<Record<string, { name: string; description?: string; colorSets: string[]; declarations?: { batchOrdering?: string[]; globref?: string[]; color?: string[]; var?: string[]; lua?: string[] } }>>({})
  // Simulation manual transition dynamic form state (reinserted after workflowMeta for ordering)
  const [simFormOpen, setSimFormOpen] = useState(false)
  const [simFormSchema, setSimFormSchema] = useState<any>(null)
  const [simFormUiSchema, setSimFormUiSchema] = useState<any>(null)
  const [simFormData, setSimFormData] = useState<any>(null)
  const [simFormEffectiveSchema, setSimFormEffectiveSchema] = useState<any>(null)
  const [simFormTitle, setSimFormTitle] = useState<string>('Manual Task')
  const [simFormTransitionId, setSimFormTransitionId] = useState<string | null>(null)
  const [simFormBindingIndex, setSimFormBindingIndex] = useState<number>(0)
  // safeParse & inference now centralized in util
  const dictionaryUrl = (typeof window !== 'undefined'
    ? (() => { try { const raw = window.localStorage.getItem('goflow.systemSettings'); if (raw) { const parsed = JSON.parse(raw); if (parsed?.dictionaryUrl) return parsed.dictionaryUrl } } catch{} return settings.dictionaryUrl })()
    : settings.dictionaryUrl)
  const getSchemaForSimTransition = useCallback((transition: any) => {
    const tid = transition.id || transition.transitionId
    const node = nodes.find(n => n.id === tid && n.type === 'transition') as any
    const tData = transition.data || (node ? node.data : {}) || {}
    const formSchemaName = tData?.formSchema || tData?.manual?.formSchema
    const layoutSchemaRaw = tData?.manual?.layoutSchema || tData?.layoutSchema
    if (!formSchemaName) return { name: undefined, schema: null, ui: layoutSchemaRaw ? safeParse(layoutSchemaRaw) : null }
    const meta = activeWorkflowId ? workflowMeta[activeWorkflowId] : null
    const decls: any = meta?.declarations || {}
    const list = Array.isArray(decls.jsonSchemas) ? decls.jsonSchemas : []
    const found = list.find((s: any) => s.name === formSchemaName)
    return found ? { name: formSchemaName, schema: found.schema, ui: layoutSchemaRaw ? safeParse(layoutSchemaRaw) : null } : { name: formSchemaName, schema: null, ui: layoutSchemaRaw ? safeParse(layoutSchemaRaw) : null }
  }, [nodes, activeWorkflowId, workflowMeta])
  const openManualSimForm = useCallback(async (transition: any) => {
    if (!transition) return
    const schemaInfo = getSchemaForSimTransition(transition)
    setSimFormSchema(schemaInfo?.schema || null)
    setSimFormUiSchema(schemaInfo?.ui || null)
    let sample: any = null
    if (Array.isArray(transition.bindings) && transition.bindings.length) {
      const firstBinding = transition.bindings[0]
      sample = extractBindingValue(firstBinding).value
    }
    if (sample == null) sample = deriveSampleFromIncomingPlaces(transition, nodes, edges)
    setSimFormData(sample)
    setSimFormBindingIndex(0)
    setSimFormTransitionId(transition.id || transition.transitionId)
    const name = transition.data?.name || transition.name || transition.id
    setSimFormTitle(name || 'Manual Task')
    ;(async () => {
      const eff = await computeEffectiveSchema(schemaInfo, sample, dictionaryUrl)
      setSimFormEffectiveSchema(eff)
    })()
    setSimFormOpen(true)
  }, [dictionaryUrl, getSchemaForSimTransition, edges, nodes])
  const handleSimStep = useCallback(async () => {
    const result = await stepSimInteractive()
    if (result?.manualTransition) await openManualSimForm(result.manualTransition)
  }, [stepSimInteractive, openManualSimForm])
  // Explorer-only selection (for non-canvas pseudo entities like declarations)
  const [explorerSelection, setExplorerSelection] = useState<{ kind: 'declarations'; id: string } | null>(null)

  // Fetch workflow list from server
  const fetchServerWorkflowList = useCallback(async () => {
    if (!flowServiceUrl) return;
    try {
      const list = await withApiErrorToast(import("./petri-client").then(m => m.fetchWorkflowList(flowServiceUrl)), toast, 'Fetch workflows');
      const arr = (Array.isArray(list?.cpns)
        ? list.cpns
        : Array.isArray(list?.data?.cpns)
          ? list.data.cpns
          : Array.isArray(list?.data)
            ? list.data
            : Array.isArray(list)
              ? list
              : []) as ServerWorkflow[]
      setServerWorkflows(arr);
      setServerWorkflowsFetched(true);
    } catch (err: any) {
  // toast already shown
    }
  }, [flowServiceUrl]);

  // Handler for selecting a workflow in Explorer (server or mockup) with microtask deferral
  const onExplorerSelect = useCallback((workflowId: string, options?: { data?: ServerWorkflow }) => {
    const hasProvidedData = !!options?.data
    if (!flowServiceUrl && !hasProvidedData) return
    // Defer actual state updates to avoid triggering during ExplorerPanel render
    queueMicrotask(async () => {
      let swf = options?.data ?? serverWorkflowCache[workflowId]
      if (!swf) {
        if (!flowServiceUrl) return
        try {
          const resp = await withApiErrorToast(fetchWorkflow(flowServiceUrl, workflowId), toast, 'Fetch workflow')
          swf = (resp?.data as ServerWorkflow) || (resp as unknown as ServerWorkflow)
          setServerWorkflowCache(prev => ({ ...prev, [workflowId]: swf! }))
        } catch (e: any) {
          return
        }
      } else {
        setServerWorkflowCache(prev => ({ ...prev, [workflowId]: swf! }))
      }

      if (!swf) return

      if (options?.data) {
        setServerWorkflowsFetched(true)
      }
      setServerWorkflows(prev => {
        const existingIndex = prev.findIndex(w => w.id === workflowId)
        if (existingIndex >= 0) {
          const next = [...prev]
          next[existingIndex] = { ...next[existingIndex], name: swf!.name || next[existingIndex].name }
          return next
        }
        return [...prev, { id: workflowId, name: swf!.name || workflowId }]
      })

      if (!options?.data) {
        const existingPath = workspacePathByIdRef.current[workflowId]
        if (existingPath) {
          delete workspaceIdByPathRef.current[existingPath]
        }
        delete workspacePathByIdRef.current[workflowId]
      }

      const cachedGraph = options?.data ? undefined : workflowGraphCache[workflowId]
      const graph = cachedGraph || serverToGraph(swf).graph
      if (options?.data || !cachedGraph) {
        setWorkflowGraphCache(prev => ({ ...prev, [workflowId]: graph }))
      }

      const workspacePath = workspacePathByIdRef.current[workflowId]
      if (workspacePath) {
        setTabState(workspacePath, { workflow: swf })
      }

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[FlowWorkspace] preparing workflow render', {
          workflowId,
          source: options?.data ? 'workspace-file' : 'server',
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          hasWorkflowCache: Boolean(workflowGraphCache[workflowId]),
        })
      }

      requestAnimationFrame(() => { setNodes(graph.nodes); setEdges(graph.edges) })

      let stored: any = {}
      try { stored = JSON.parse(localStorage.getItem('goflow.declarations.'+workflowId) || '{}') } catch {}
      const allServerColorSetLines = (swf!.colorSets || []).filter(cs => /^\s*colset\s+/i.test(cs))
      const decls = (swf as any).declarations && Object.keys((swf as any).declarations).length
        ? (swf as any).declarations
        : { ...stored, color: allServerColorSetLines }
      if (Array.isArray((swf as any).jsonSchemas)) {
        (decls as any).jsonSchemas = (swf as any).jsonSchemas
      }
      const nameRegex = /^\s*colset\s+([A-Za-z_]\w*)/i
      const colorSetNames = allServerColorSetLines.map(l => { const m = l.match(nameRegex); return m? m[1]: '' }).filter(Boolean)
      setWorkflowMeta(prev => ({ ...prev, [workflowId]: { name: swf!.name, description: swf!.description, colorSets: colorSetNames, declarations: decls } }))

      historyRef.current = { past: [], present: { nodes: graph.nodes.map(n => ({ ...n })), edges: graph.edges.map(e => ({ ...e })) }, future: [] }
      isLoadingWorkflowRef.current = true

      const broadcastNames = colorSetNames.length
        ? Array.from(new Set([ ...DEFAULT_COLOR_SETS, ...colorSetNames ]))
        : Array.from(new Set([ ...DEFAULT_COLOR_SETS, ...((workflowMeta[workflowId]?.colorSets) || []) ]))
      window.dispatchEvent(new CustomEvent('goflow-colorSets', { detail: { colorSets: broadcastNames } }))

      setSelectedRef(null)
      setTokensOpenForPlaceId(null)
      setGuardOpenForTransitionId(null)
      setActiveWorkflowId(workflowId)
      setEditedMap(prev => ({ ...prev, [workflowId]: false }))
      // previously would auto-open panel when tokens/guard opened; now just ensure leftTab set appropriately
    })
  }, [flowServiceUrl, serverWorkflowCache, workflowGraphCache, workflowMeta, setTabState])

  // Listen to explorer selection events dispatched from other panels
  useEffect(() => {
    const handler = (e: any) => {
      const id = e?.detail?.id
      const data = e?.detail?.data as ServerWorkflow | undefined
      if (id) onExplorerSelect(id, data ? { data } : undefined)
    }
    const openHandler = (e: any) => {
      const detail = e?.detail
      const incoming = detail?.data as ServerWorkflow | undefined
      if (!incoming) return

      const inferredId = incoming.id || (typeof detail?.path === 'string' ? detail.path.split('/').pop()?.replace(/\.cpn$/i, '') : undefined)
      if (!inferredId) return
      const normalizedId = inferredId.trim()
      if (!normalizedId) return

      if (typeof detail?.path === 'string' && detail.path.trim()) {
        const trimmedPath = detail.path.trim()
        const previousPath = workspacePathByIdRef.current[normalizedId]
        if (previousPath && previousPath !== trimmedPath) {
          delete workspaceIdByPathRef.current[previousPath]
        }
        workspacePathByIdRef.current[normalizedId] = trimmedPath
        workspaceIdByPathRef.current[trimmedPath] = normalizedId
      }

      const workflowData: ServerWorkflow = { ...incoming, id: normalizedId, name: incoming.name || normalizedId }
      if (!Array.isArray(workflowData.places) || !Array.isArray(workflowData.transitions) || !Array.isArray(workflowData.arcs)) {
        console.warn('goflow-open-workflow missing required workflow structure', detail?.path)
        return
      }

      onExplorerSelect(normalizedId, { data: workflowData })
    }
    const delHandler = (e: any) => {
      const id = e?.detail?.id
      if (id && id === activeWorkflowId) {
        // workflow deleted externally -> clear canvas
        setActiveWorkflowId(null)
        setNodes([])
        setEdges([])
      }
      if (typeof id === 'string' && id.length) {
        const existingPath = workspacePathByIdRef.current[id]
        if (existingPath) {
          delete workspacePathByIdRef.current[id]
          delete workspaceIdByPathRef.current[existingPath]
        }
      }
    }
    window.addEventListener('goflow-explorer-select', handler as EventListener)
    window.addEventListener('goflow-open-workflow', openHandler as EventListener)
    window.addEventListener('goflow-workflow-deleted', delHandler as EventListener)
    // Listen for entity selection events from explorer (left panel)
    const entityHandler = (e: any) => {
      const { kind, id } = e?.detail || {}
      if (!kind || !id) return
      // mirror the same selection behavior as the side-panel's onSelectEntity prop
      if (kind === 'place' || kind === 'transition') {
        setExplorerSelection(null)
        setSelectedRef({ type: 'node', id })
        setNodes(nds => nds.map(n => n.id===id ? { ...n, selected: true } : { ...n, selected: false }))
        setEdges(eds => eds.map(e => ({ ...e, selected: false })))
        setLeftTab('property')
      } else if (kind === 'arc') {
        setExplorerSelection(null)
        setSelectedRef({ type: 'edge', id })
        setEdges(eds => eds.map(e => e.id===id ? { ...e, selected: true } : { ...e, selected: false }))
        setNodes(nds => nds.map(n => ({ ...n, selected: false })))
        setLeftTab('property')
      } else if (kind === 'declarations') {
        setSelectedRef(null)
        setExplorerSelection({ kind: 'declarations', id })
        setNodes(nds => nds.map(n => ({ ...n, selected: false })))
        setEdges(eds => eds.map(e => ({ ...e, selected: false })))
        setLeftTab('property')
      }
    }
    window.addEventListener('goflow-explorer-entity-select', entityHandler as EventListener)
    return () => {
      window.removeEventListener('goflow-explorer-select', handler as EventListener)
      window.removeEventListener('goflow-open-workflow', openHandler as EventListener)
      window.removeEventListener('goflow-workflow-deleted', delHandler as EventListener)
      window.removeEventListener('goflow-explorer-entity-select', entityHandler as EventListener)
    }
  }, [onExplorerSelect, activeWorkflowId, setLeftTab])

  const persistWorkflow = useCallback(async (workflowId: string, options?: { targetPath?: string }) => {
    if (!workflowId) return null

    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current
    const meta = workflowMeta[workflowId]
    const serverBase = serverWorkflowCache[workflowId]
    const payload = graphToServer(
      serverBase,
      workflowId,
      meta?.name || workflowId,
      { nodes: currentNodes, edges: currentEdges },
      meta?.colorSets ?? [],
      meta?.description,
      meta?.declarations
    )

    const explicitPath = typeof options?.targetPath === 'string' && options.targetPath.trim().length ? options.targetPath.trim() : undefined
    const workspacePath = explicitPath || workspacePathByIdRef.current[workflowId]

    if (process.env.NODE_ENV !== 'production') {
      try {
        console.debug('[FlowWorkspace] persistWorkflow arcs', payload.arcs.map(a => ({ id: a.id, readonly: (a as any).readonly, ReadOnly: (a as any).ReadOnly })))
      } catch (err) {
        // ignore debug issues
      }
    }

    if (workspacePath) {
      try {
        const serialized = JSON.stringify(payload, null, 2)
        await saveWorkspaceFile(workspacePath, serialized)
        setTabState(workspacePath, { workflow: payload })
      } catch (err) {
        return null
      }
      const after = useWorkspace.getState().files.get(workspacePath)
      if (after && after.dirty === false) {
        setServerWorkflowCache(prev => ({ ...prev, [workflowId]: payload }))
        setEditedMap(prev => ({ ...prev, [workflowId]: false }))
        return 'workspace'
      }
      return null
    }

    if (!flowServiceUrl) {
      toast({
        title: 'Unable to save workflow',
        description: 'No Flow service is configured for saving this workflow.',
        variant: 'destructive'
      })
      return null
    }

    try {
      await withApiErrorToast(saveWorkflow(flowServiceUrl, payload), toast, 'Save')
      setServerWorkflowCache(prev => ({ ...prev, [workflowId]: payload }))
      setEditedMap(prev => ({ ...prev, [workflowId]: false }))
      toast({ title: 'Saved', description: 'Workflow saved successfully' })
      return 'flow-service'
    } catch (err) {
      return null
    }
  }, [workflowMeta, serverWorkflowCache, saveWorkspaceFile, flowServiceUrl, toast])

  useEffect(() => {
    const handleSaveFile = (event: Event) => {
      const ce = event as CustomEvent<{ path?: string }>
      const detailPathRaw = ce?.detail?.path
      if (!detailPathRaw || typeof detailPathRaw !== 'string') return
      const detailPath = detailPathRaw.trim()
      if (!detailPath.toLowerCase().endsWith('.cpn')) return

      const mappedId = workspaceIdByPathRef.current[detailPath]
      const derivedId = detailPath.split('/').pop()?.replace(/\.cpn$/i, '')
      const workflowId = mappedId || derivedId
      if (!workflowId) return
      if (workflowId !== activeWorkflowId) return

      const previousPath = workspacePathByIdRef.current[workflowId]
      if (previousPath && previousPath !== detailPath) {
        delete workspaceIdByPathRef.current[previousPath]
      }
      workspacePathByIdRef.current[workflowId] = detailPath
      workspaceIdByPathRef.current[detailPath] = workflowId

      const savePromise = persistWorkflow(workflowId, { targetPath: detailPath })
      savePromise?.then((mode) => {
        if (!mode || typeof window === 'undefined') return
        window.dispatchEvent(new CustomEvent('goflow-file-saved', {
          detail: { path: detailPath, workflowId, mode }
        }))
      }).catch(() => {
        /* errors already surfaced via toast */
      })
    }

    window.addEventListener('goflow-save-file', handleSaveFile as EventListener)
    return () => {
      window.removeEventListener('goflow-save-file', handleSaveFile as EventListener)
    }
  }, [persistWorkflow, activeWorkflowId])

  const edited = activeWorkflowId ? editedMap[activeWorkflowId] ?? false : false;

  const selected: SelectedResolved = useMemo(() => {
    if (!selectedRef) return null
    if (selectedRef.type === "node") {
      const n = nodes.find((x) => x.id === selectedRef.id)
      return n ? { type: "node", node: n } : null
    } else {
      const e = edges.find((x) => x.id === selectedRef.id)
      return e ? { type: "edge", edge: e } : null
    }
  }, [selectedRef, nodes, edges])

  useEffect(() => {
    const pathMap = workspacePathByIdRef.current
    for (const [id, isEdited] of Object.entries(editedMap)) {
      const path = pathMap[id]
      if (!path) continue
      markWorkspaceFileDirty(path, !!isEdited)
    }
  }, [editedMap, markWorkspaceFileDirty])

  useEffect(() => {
    function onDocClick() {
      setContextMenu((c) => ({ ...c, open: false }))
    }
    function onKey(e: KeyboardEvent) {
      // Undo / Redo keyboard shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === "Escape") {
        // cancel current connect attempt (no node/edge should be created)
        connectStateRef.current.cancel = true
        connectStateRef.current.inProgress = false
        connectStateRef.current.start = null
        setContextMenu((c) => ({ ...c, open: false }))
  setShowSystem(false)
      }
    }
    function onOpenTokens(ev: Event) {
      const ce = ev as CustomEvent<{ placeId: string }>
      const pid = ce.detail?.placeId
      if (!pid) return
      setSelectedRef({ type: "node", id: pid })
      setTokensOpenForPlaceId(pid)
      setLeftTab('property')
  setGuardOpenForTransitionId(null)
      // panel mode removed; no-op
    }
    function onOpenGuard(ev: Event) {
      const ce = ev as CustomEvent<{ transitionId: string }>
      const tid = ce.detail?.transitionId
      if (!tid) return
      setSelectedRef({ type: "node", id: tid })
  setGuardOpenForTransitionId(tid)
      setLeftTab('property')
      // panel mode removed; no-op
    }
    document.addEventListener("click", onDocClick)
    document.addEventListener("keydown", onKey)
    window.addEventListener("openPlaceTokens", onOpenTokens as EventListener)
    window.addEventListener("openTransitionGuard", onOpenGuard as EventListener)
    return () => {
      document.removeEventListener("click", onDocClick)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("openPlaceTokens", onOpenTokens as EventListener)
      window.removeEventListener("openTransitionGuard", onOpenGuard as EventListener)
      setGuardOpenForTransitionId(null)
    }
  }, [])

  // Listen to workflow selection from Explorer and load its graph
  // Remove legacy listener relying on mock store
  useEffect(() => { return () => {} }, [])

  // When canvas graph changes propagate back to store (debounced) if a workflow is active
  // Only set edited=true if nodes/edges change and not on load
  const prevNodes = useRef<Node<PetriNodeData>[]>([]);
  const prevEdges = useRef<Edge<PetriEdgeData>[]>([]);
  // Undo/Redo handlers using present/past/future
  const undo = useCallback(() => {
    if (isRestoringRef.current) return
    const h = historyRef.current
    if (!h.present || h.past.length === 0) return
    const newFutureEntry: Snapshot = { nodes: h.present.nodes.map(n => ({ ...n })), edges: h.present.edges.map(e => ({ ...e })) }
    const previous = h.past[h.past.length - 1]
    h.past.pop()
    h.future.push(newFutureEntry)
    h.present = { nodes: previous.nodes.map(n => ({ ...n })), edges: previous.edges.map(e => ({ ...e })) }
    isRestoringRef.current = true
    setNodes(h.present.nodes.map(n => ({ ...n })))
    setEdges(h.present.edges.map(e => ({ ...e })))
    requestAnimationFrame(() => { isRestoringRef.current = false })
  }, [setNodes, setEdges])

  const redo = useCallback(() => {
    if (isRestoringRef.current) return
    const h = historyRef.current
    if (h.future.length === 0 || !h.present) return
    const next = h.future[h.future.length - 1]
    h.future.pop()
    h.past.push({ nodes: h.present.nodes.map(n => ({ ...n })), edges: h.present.edges.map(e => ({ ...e })) })
    h.present = { nodes: next.nodes.map(n => ({ ...n })), edges: next.edges.map(e => ({ ...e })) }
    isRestoringRef.current = true
    setNodes(h.present.nodes.map(n => ({ ...n })))
    setEdges(h.present.edges.map(e => ({ ...e })))
    requestAnimationFrame(() => { isRestoringRef.current = false })
  }, [setNodes, setEdges])
  useEffect(() => {
    if (!activeWorkflowId) return
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(prevNodes.current)
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(prevEdges.current)
    if ((nodesChanged || edgesChanged)) {
      // Mark edited (ignore very first load & restoring)
      if (!isRestoringRef.current && !isLoadingWorkflowRef.current) {
        setEditedMap(prev => ({ ...prev, [activeWorkflowId]: true }))
        const h = historyRef.current
        if (h.present) {
          h.past.push({ nodes: h.present.nodes.map(n => ({ ...n })), edges: h.present.edges.map(e => ({ ...e })) })
          if (h.past.length > 100) h.past.splice(0, h.past.length - 100)
        }
        h.present = { nodes: nodes.map(n => ({ ...n })), edges: edges.map(e => ({ ...e })) }
        h.future = []
      } else if (isLoadingWorkflowRef.current) {
        // First load: establish prev nodes/edges without adding history
        historyRef.current.present = { nodes: nodes.map(n => ({ ...n })), edges: edges.map(e => ({ ...e })) }
        isLoadingWorkflowRef.current = false
      } else if (isRestoringRef.current) {
        // During restore just update present
        historyRef.current.present = { nodes: nodes.map(n => ({ ...n })), edges: edges.map(e => ({ ...e })) }
      }
    }
    prevNodes.current = nodes
    prevEdges.current = edges
    const t = setTimeout(() => {
      const next = { nodes: [...nodes], edges: [...edges] }
      setWorkflowGraphCache(prev => ({ ...prev, [activeWorkflowId]: next }))
      try { window.dispatchEvent(new CustomEvent('goflow-explorer-graph-updated', { detail: { workflowId: activeWorkflowId, graph: next } })) } catch {}
    }, 200)
    return () => clearTimeout(t)
  }, [nodes, edges, activeWorkflowId, setWorkflowGraphCache, setEditedMap])

  // Listen to primitive store changes (Explorer mutations) and refresh canvas graph if same workflow mutated
  // Removed mock store change listener
  useEffect(() => { return () => {} }, [])

  // Listen to explorer entity selection to visually select in canvas
  useEffect(() => { return () => {} }, [])

  useEffect(() => {
    // NOTE: We include activeWorkflowId in the dependency array so the event handlers
    // always close over the current workflow id. Previously they always returned early
    // because the captured activeWorkflowId was null when the listener was first mounted.
    function onMove(e: MouseEvent) {
      if (!resizing || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const desired = Math.min(Math.max(rect.right - e.clientX, 240), Math.min(640, rect.width - 160))
      setPanelWidth(desired)
    }
    function onUp() {
      if (resizing) setResizing(false)
    }
    function extractDeclarationColorNames(decls: any): string[] {
      if (!decls || !Array.isArray(decls.color)) return []
      const regex = /^\s*colset\s+([A-Za-z_]\w*)/i
      return decls.color.map((line: any) => {
        if (typeof line !== 'string') return ''
        const m = line.match(regex); return m? m[1]: ''
      }).filter(Boolean)
    }
    function broadcastMergedColors(metaMap: typeof workflowMeta, wfId: string) {
      const meta = metaMap[wfId]
      const declNames = extractDeclarationColorNames(meta?.declarations)
      const nameSet = Array.from(new Set([ ...DEFAULT_COLOR_SETS, ...(meta?.colorSets||[]), ...declNames ]))
      window.dispatchEvent(new CustomEvent('goflow-colorSets', { detail: { colorSets: nameSet } }))
    }
    function onUpdateColorSets(ev: Event) {
      const ce = ev as CustomEvent<{ next: string[] }>
      if (!activeWorkflowId) return
      const next = ce.detail?.next || []
      setWorkflowMeta(meta => {
        // Sanitize inputs to only valid identifiers
        const cleaned = next.filter(n => typeof n === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(n))
        const updated = { ...meta, [activeWorkflowId]: { ...(meta[activeWorkflowId]||{ name: activeWorkflowId, description:'', colorSets: [] }), colorSets: cleaned } }
        broadcastMergedColors(updated, activeWorkflowId)
        return updated
      })
      setEditedMap(m => ({ ...m, [activeWorkflowId]: true }))
    }
    function onUpdateDeclarations(ev: Event) {
      const ce = ev as CustomEvent<{ next: any }>
      if (!activeWorkflowId) return
      const next = ce.detail?.next || {}
      setWorkflowMeta(meta => {
  const prevMeta = meta[activeWorkflowId] || { name: activeWorkflowId, description:'', colorSets: [] }
  // Extract color declarations and merge into colorSets (avoid duplicates)
  const colorLines: string[] = Array.isArray(next.color) ? next.color.filter((l: any) => typeof l === 'string' && l.trim().length) : []
  const nameRegex = /^\s*colset\s+([A-Za-z_]\w*)/i
  const colorNames = colorLines.map(l => { const m = l.match(nameRegex); return m? m[1]: '' }).filter(Boolean)
  // Remove previously declaration-derived names from colorSets, then add current valid names
  const prevDeclNames = extractDeclarationColorNames(prevMeta.declarations)
  const base = (prevMeta.colorSets || []).filter(n => !prevDeclNames.includes(n))
  const mergedColorSets = Array.from(new Set([...base, ...colorNames]))
  const updated = { ...meta, [activeWorkflowId]: { ...prevMeta, colorSets: mergedColorSets, declarations: next } }
  try { localStorage.setItem('goflow.declarations.'+activeWorkflowId, JSON.stringify(next)) } catch {}
  broadcastMergedColors(updated, activeWorkflowId)
  return updated
      })
      setEditedMap(m => ({ ...m, [activeWorkflowId]: true }))
    }
  // Support both pointer and mouse events so pointer capture from SidePanel works
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('updateColorSetsInternal', onUpdateColorSets as EventListener)
  window.addEventListener('updateDeclarationsInternal', onUpdateDeclarations as EventListener)
  const onOpenMcp = (e: Event) => {
    console.debug('[FlowWorkspace] received goflow-open-mcp', e)
    try { fetch('/api/debug/mcp-received', { method: 'POST', body: JSON.stringify({ ts: Date.now() }), headers: { 'Content-Type': 'application/json' } }).catch(()=>{}) } catch {}
    setMcpAddOpen(true)
  }
  window.addEventListener('goflow-open-mcp', onOpenMcp as EventListener)
    return () => {
  window.removeEventListener("mousemove", onMove)
  window.removeEventListener("mouseup", onUp)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('updateColorSetsInternal', onUpdateColorSets as EventListener)
    window.removeEventListener('updateDeclarationsInternal', onUpdateDeclarations as EventListener)
    window.removeEventListener('goflow-open-mcp', onOpenMcp as EventListener)
    }
  }, [resizing, activeWorkflowId])

  const onConnect = useCallback(
    (connection: Connection) => {
      // A valid connection to an existing handle was made -> mark completed
      connectStateRef.current.completed = true
      connectStateRef.current.inProgress = false
      connectStateRef.current.cancel = false
      connectStateRef.current.start = null

      const newEdge: Edge<PetriEdgeData> = {
        ...connection,
        id: `e-${connection.source ?? ""}-${connection.sourceHandle ?? ""}-${connection.target ?? ""}-${
          connection.targetHandle ?? ""
        }-${Math.random().toString(36).slice(2, 7)}`,
        type: "labeled",
        data: { label: "arc" },
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    [setEdges],
  )

  const isValidConnection = useCallback(
    (conn: Connection | Edge): boolean => {
      const src = nodes.find((n) => n.id === (conn.source || ""))
      const tgt = nodes.find((n) => n.id === (conn.target || ""))
      if (!src || !tgt) return false
      if (src.id === tgt.id) return false
      return src.type !== tgt.type
    },
    [nodes],
  )

  const onSelectionChange = useCallback((params: { nodes?: Node[]; edges?: Edge[] }) => {
    const n = params.nodes?.[0]
    const e = params.edges?.[0]

    if (n) {
      setSelectedRef({ type: 'node', id: n.id })
      setExplorerSelection(null)
      setTokensOpenForPlaceId((prev) => (prev === n.id ? prev : null))
      setGuardOpenForTransitionId((prev) => (prev === n.id ? prev : null))
      setLeftTab('property')
      return
    }

    if (e) {
      setSelectedRef({ type: 'edge', id: e.id })
      setExplorerSelection(null)
      setTokensOpenForPlaceId(null)
      setGuardOpenForTransitionId(null)
      setLeftTab('property')
      return
    }

    setSelectedRef(null)
    setExplorerSelection(null)
    setTokensOpenForPlaceId(null)
    setGuardOpenForTransitionId(null)
  }, [setLeftTab])

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type !== "transition" && node.type !== 'place') return
      event.preventDefault()
      const { clientX, clientY } = event
      // Offset slightly to appear just below/right of the clicked node
      setContextMenu({ open: true, x: clientX + 8, y: clientY + 12, nodeId: node.id })
    },
    [setContextMenu],
  )

  // Record start of connecting in a ref for instant availability
  const onConnectStart: OnConnectStart = useCallback(
    (_event, params) => {
      connectStateRef.current.start = { nodeId: params.nodeId, handleType: params.handleType }
      connectStateRef.current.inProgress = true
      connectStateRef.current.completed = false
      connectStateRef.current.cancel = false
    },
    [],
  )

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const state = connectStateRef.current

      // If nothing was started or it was already handled or canceled, exit
      if (!state.inProgress || state.completed || state.cancel || !state.start) {
        connectStateRef.current.inProgress = false
        connectStateRef.current.completed = false
        connectStateRef.current.cancel = false
        connectStateRef.current.start = null
        return
      }

      // If dropped on the pane (not on a handle), create opposite node and connect
      const pt =
        "clientX" in event
          ? { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY }
          : { x: (event as TouchEvent).changedTouches[0].clientX, y: (event as TouchEvent).changedTouches[0].clientY }

      const elem = document.elementFromPoint(pt.x, pt.y)
      const droppedOnPane = !!elem && !!(elem as Element).closest(".react-flow__pane")

      if (!droppedOnPane) {
        // Let React Flow handle other drop targets (like existing handles)
        connectStateRef.current.inProgress = false
        connectStateRef.current.completed = false
        connectStateRef.current.cancel = false
        connectStateRef.current.start = null
        return
      }

      const flowPos = screenToFlowPosition ? screenToFlowPosition(pt) : { x: pt.x, y: pt.y }

      const startNode = nodes.find((n) => n.id === state.start?.nodeId)
      if (!startNode) {
        connectStateRef.current.inProgress = false
        connectStateRef.current.completed = false
        connectStateRef.current.cancel = false
        connectStateRef.current.start = null
        return
      }

  const startIsPlace = startNode.type === "place"
      const newId = startIsPlace
        ? `t-${Math.random().toString(36).slice(2, 7)}`
        : `p-${Math.random().toString(36).slice(2, 7)}`

      const suffix = ' #' + Math.random().toString(16).slice(2,5)
      const newNode = startIsPlace
        ? {
            id: newId,
            type: "transition" as const,
            position: flowPos,
            guardExpression: "true",
            data: {
              kind: "transition",
              name: "Transition" + suffix,
              tType: "Manual", // TransitionType value
              manual: { assignee: "", formSchema: "", layoutSchema: "" }
            },
          }
        : {
            id: newId,
            type: "place" as const,
            position: flowPos,
            data: { kind: "place", name: "Place" + suffix, tokens: 0, tokenList: [], colorSet: 'INT' },
          }

      setNodes((nds) => [...nds, newNode as any])

      const newEdge: Edge<PetriEdgeData> = {
        id: `e-${Math.random().toString(36).slice(2, 7)}`,
        source: state.start.handleType === "source" ? (state.start.nodeId as string) : newId,
        target: state.start.handleType === "source" ? newId : (state.start.nodeId as string),
        type: "labeled",
        data: { label: "arc" },
      }
      setEdges((eds) => [...eds, newEdge])
      setSelectedRef({ type: "node", id: newId })

      // cleanup
      connectStateRef.current.inProgress = false
      connectStateRef.current.completed = false
      connectStateRef.current.cancel = false
      connectStateRef.current.start = null
    },
    [nodes, screenToFlowPosition, setNodes, setEdges],
  )

  const addPlace = useCallback(() => {
    const id = `p-${Math.random().toString(36).slice(2, 7)}`
    const pos = screenToFlowPosition ? screenToFlowPosition({ x: 200, y: 150 }) : { x: 200, y: 150 }
  const suffixP = ' #' + Math.random().toString(16).slice(2,5)
  setNodes((nds) => [...nds, { id, type: "place", position: pos, data: { kind: "place", name: "Place" + suffixP, tokens: 0, tokenList: [], colorSet: 'INT' } } as any])
    setSelectedRef({ type: "node", id })
  }, [screenToFlowPosition, setNodes])


  const addTransition = useCallback(() => {
    const id = `t-${Math.random().toString(36).slice(2, 7)}`
    const pos = screenToFlowPosition ? screenToFlowPosition({ x: 420, y: 150 }) : { x: 420, y: 150 }
  const suffixT = ' #' + Math.random().toString(16).slice(2,5)
  setNodes((nds) => [...nds, { id, type: "transition", position: pos, guardExpression: "true", data: { kind: "transition", name: "Transition" + suffixT, tType: "Manual", manual: { assignee: "", formSchema: "", layoutSchema: "" } } } as any])
    setSelectedRef({ type: "node", id })
  }, [screenToFlowPosition, setNodes])

  // Register explorer-originated Add actions after both addPlace and addTransition
  // exist to avoid block-scoped usage-before-declaration errors.
  useEffect(() => {
    const onAddPlace = (ev: Event) => {
      try { addPlace() } catch (e) { /* ignore */ }
    }
    const onAddTransition = (ev: Event) => {
      try { addTransition() } catch (e) { /* ignore */ }
    }
    window.addEventListener('goflow-explorer-add-place', onAddPlace as EventListener)
    window.addEventListener('goflow-explorer-add-transition', onAddTransition as EventListener)
    return () => {
      window.removeEventListener('goflow-explorer-add-place', onAddPlace as EventListener)
      window.removeEventListener('goflow-explorer-add-transition', onAddTransition as EventListener)
    }
  }, [addPlace, addTransition])

  const deleteNodeById = useCallback(
    (id: string) => {
      // compute next state from current refs to ensure we can broadcast the exact new graph
      const nextNodes = nodesRef.current.filter((n) => n.id !== id)
      const nextEdges = edgesRef.current.filter((e) => e.source !== id && e.target !== id)
      setNodes(() => nextNodes)
      setEdges(() => nextEdges)
      setSelectedRef(null)
      setTokensOpenForPlaceId(null)
      setGuardOpenForTransitionId(null)
      // broadcast updated graph for explorer cache sync
      try {
        window.dispatchEvent(new CustomEvent('goflow-explorer-graph-updated', { detail: { workflowId: activeWorkflowId, graph: { nodes: nextNodes, edges: nextEdges } } }))
      } catch {}
    },
    [setNodes, setEdges, activeWorkflowId],
  )

  const deleteEdgeById = useCallback((id: string) => {
    const nextEdges = edgesRef.current.filter((e) => e.id !== id)
    setEdges(() => nextEdges)
    setSelectedRef(null)
    try {
      window.dispatchEvent(new CustomEvent('goflow-explorer-graph-updated', { detail: { workflowId: activeWorkflowId, graph: { nodes: nodesRef.current, edges: nextEdges } } }))
    } catch {}
  }, [setEdges, activeWorkflowId])

  // Register explorer-originated Delete actions
  useEffect(() => {
    const onDeletePlace = (ev: Event) => {
      const ce = ev as CustomEvent<{ id?: string; workflowId?: string }>
      const id = ce.detail?.id
      const wfId = ce.detail?.workflowId
      if (!id) return
      // only apply to current canvas when workflow matches (or workflowId not provided)
      if (wfId && wfId !== activeWorkflowId) return
      const nextNodes = nodesRef.current.filter(n => n.id !== id)
      const nextEdges = edgesRef.current.filter(e => e.source !== id && e.target !== id)
      console.debug('[goflow] deletePlace', { id, activeWorkflowId, before: nodesRef.current.length, after: nextNodes.length })
      setNodes(() => nextNodes)
      console.debug('[goflow] deletePlace edges', { id, before: edgesRef.current.length, after: nextEdges.length })
      setEdges(() => nextEdges)
      setSelectedRef(null)
      setTokensOpenForPlaceId(null)
      setGuardOpenForTransitionId(null)
      try { window.dispatchEvent(new CustomEvent('goflow-explorer-graph-updated', { detail: { workflowId: activeWorkflowId, graph: { nodes: nextNodes, edges: nextEdges } } })) } catch {}
    }
    const onDeleteTransition = (ev: Event) => {
      const ce = ev as CustomEvent<{ id?: string; workflowId?: string }>
      const id = ce.detail?.id
      const wfId = ce.detail?.workflowId
      if (!id) return
      if (wfId && wfId !== activeWorkflowId) return
      const nextNodes = nodesRef.current.filter(n => n.id !== id)
      const nextEdges = edgesRef.current.filter(e => e.source !== id && e.target !== id)
      console.debug('[goflow] deleteTransition', { id, activeWorkflowId, before: nodesRef.current.length, after: nextNodes.length })
      setNodes(() => nextNodes)
      console.debug('[goflow] deleteTransition edges', { id, before: edgesRef.current.length, after: nextEdges.length })
      setEdges(() => nextEdges)
      setSelectedRef(null)
      setTokensOpenForPlaceId(null)
      setGuardOpenForTransitionId(null)
      try { window.dispatchEvent(new CustomEvent('goflow-explorer-graph-updated', { detail: { workflowId: activeWorkflowId, graph: { nodes: nextNodes, edges: nextEdges } } })) } catch {}
    }
    const onDeleteArc = (ev: Event) => {
      const ce = ev as CustomEvent<{ id?: string; workflowId?: string }>
      const id = ce.detail?.id
      const wfId = ce.detail?.workflowId
      if (!id) return
      if (wfId && wfId !== activeWorkflowId) return
      const nextEdges = edgesRef.current.filter(e => e.id !== id)
      console.debug('[goflow] deleteArc', { id, activeWorkflowId, before: edgesRef.current.length, after: nextEdges.length })
      setEdges(() => nextEdges)
      setSelectedRef(null)
      try { window.dispatchEvent(new CustomEvent('goflow-explorer-graph-updated', { detail: { workflowId: activeWorkflowId, graph: { nodes: nodesRef.current, edges: nextEdges } } })) } catch {}
    }
    window.addEventListener('goflow-explorer-delete-place', onDeletePlace as EventListener)
    window.addEventListener('goflow-explorer-delete-transition', onDeleteTransition as EventListener)
    window.addEventListener('goflow-explorer-delete-arc', onDeleteArc as EventListener)
    return () => {
      window.removeEventListener('goflow-explorer-delete-place', onDeletePlace as EventListener)
      window.removeEventListener('goflow-explorer-delete-transition', onDeleteTransition as EventListener)
      window.removeEventListener('goflow-explorer-delete-arc', onDeleteArc as EventListener)
    }
  }, [deleteNodeById, deleteEdgeById, activeWorkflowId])

  const setTransitionType = useCallback(
    (id: string, tType: TransitionType) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id && n.type === "transition" ? { ...n, data: { ...(n.data as any), tType } } : n)),
      )
    },
    [setNodes],
  )

  const { marking: serverMarking, enabled, loading: monitorLoading, fastForwarding: monitorFastForwarding, globalClock, currentStep, refresh: refreshMonitorData, fire: fireTransitionMon, step: doMonitorStep, fastForward: monitorFastForward, forwardToEnd: monitorForwardToEnd, rollback: monitorRollback, reset: resetMonitor } = useMonitor({ workflowId: activeWorkflowId, flowServiceUrl: flowServiceUrl ?? undefined, setNodes })

  // Event (a) open Monitor tab & (b) workflow change while on Monitor
  // Legacy monitor refresh left intact; will be removed when MonitorPanel replaced.
  useEffect(() => { if (systemTab === 'simulation') { refreshSim() } }, [systemTab, activeWorkflowId, refreshSim])

  const resetTokens = useCallback(() => {
    // TODO: implement server reset endpoint if available
  }, [])

  const updateNode = useCallback(
    (id: string, patch: Partial<PetriNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...(n.data as any), ...patch } as PetriNodeData } : n)),
      )
    },
    [setNodes],
  )

  const updateEdge = useCallback(
    (id: string, patch: Partial<PetriEdgeData>) => {
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, data: { ...(e.data as any), ...patch } } : e)))
    },
    [setEdges],
  )

  const download = (filename: string, data: string) => {
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const serialize = () => JSON.stringify({ nodes, edges }, null, 2)

  // Simple auto layout: arrange places left, transitions right in vertical stacks preserving order
  const autoLayout = useCallback(() => {
    setNodes(curr => computePetriLayout(curr, edges, { horizontalGap: 260, verticalGap: 120, startX: 120, startY: 80 }))
    setTimeout(() => fitView?.({ padding: 0.25, duration: 300 }), 30)
    toast({ title: 'Auto layout applied' })
  }, [edges, fitView, setNodes])

  // Direct declarations apply handler (bypasses global event for reliability)
  const onDeclarationsApply = useCallback((next: any) => {
    if (!activeWorkflowId) return
    setWorkflowMeta(meta => {
      const prevMeta = meta[activeWorkflowId] || { name: activeWorkflowId, description:'', colorSets: [] }
      const colorLines: string[] = Array.isArray(next.color) ? next.color.filter((l: any) => typeof l === 'string' && l.trim().length) : []
      const nameRegex = /^\s*colset\s+([A-Za-z_]\w*)/i
      const colorNames = colorLines.map(l => { const m = l.match(nameRegex); return m? m[1]: '' }).filter(Boolean)
      // Remove declaration-derived names from previous meta, then add current valid names
      const prevDeclNames = (() => {
        const decls = prevMeta.declarations
        if (!decls || !Array.isArray((decls as any).color)) return [] as string[]
        return (decls as any).color
          .filter((ln: any) => typeof ln === 'string' && ln.trim().length)
          .map((ln: string) => { const m = ln.match(nameRegex); return m? m[1]: '' })
          .filter(Boolean)
      })()
      const base = (prevMeta.colorSets || []).filter(n => !prevDeclNames.includes(n))
      const mergedColorSets = Array.from(new Set([...base, ...colorNames]))
      const updated = { ...meta, [activeWorkflowId]: { ...prevMeta, colorSets: mergedColorSets, declarations: next } }
      try { localStorage.setItem('goflow.declarations.'+activeWorkflowId, JSON.stringify(next)) } catch {}
      // Broadcast merged color set names (include defaults) – sanitize again
      const broadcastNames = Array.from(new Set([ ...DEFAULT_COLOR_SETS, ...mergedColorSets ])).filter(n => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n))
      window.dispatchEvent(new CustomEvent('goflow-colorSets', { detail: { colorSets: broadcastNames } }))
      return updated
    })
    setEditedMap(m => ({ ...m, [activeWorkflowId]: true }))
  }, [activeWorkflowId])

  // ---- MCP helpers ----
  type ToolCatalogItem = { id: string; name: string; type: string; description?: string; inputSchema?: any; outputSchema?: any; config?: any; enabled?: boolean }
  const refreshMcpServers = useCallback(async () => {
    if (!flowServiceUrl) return
    setMcpLoading(true); setMcpError(null)
    try {
      const serversRaw: any[] = await withApiErrorToast(listRegisteredMcpServers(flowServiceUrl), toast, 'Load MCP servers')
      const baseServers: McpServer[] = (serversRaw||[]).map((s:any) => ({
        id: s.id || s.baseUrl,
        name: s.name || (()=>{ try { return new URL(s.baseUrl).host } catch { return s.baseUrl } })(),
        baseUrl: s.endpoint,
        timeoutMs: s.timeoutMs,
        toolCount: s.toolCount,
        description: s.description,
      }))
      // If toolCount missing, fetch via listMcpTools and count (silent failure tolerated)
      const servers: McpServer[] = await Promise.all(baseServers.map(async (srv) => {
        if (typeof srv.toolCount === 'number') return srv
        try {
          const tools = await listMcpTools(flowServiceUrl, { baseUrl: srv.baseUrl, timeoutMs: srv.timeoutMs })
          return { ...srv, toolCount: Array.isArray(tools) ? tools.length : undefined }
        } catch { return srv }
      }))
      setMcpServers(servers)
    } catch(e:any) {
      setMcpError(e?.message || String(e))
    } finally { setMcpLoading(false) }
  }, [flowServiceUrl])

  useEffect(() => { if (showSystem && systemTab==='mcp') { refreshMcpServers() } }, [showSystem, systemTab, refreshMcpServers])

  const openMcpDetails = useCallback(async (srv: McpServer) => {
    if (!flowServiceUrl) return
    try {
      const items = await withApiErrorToast(listMcpTools(flowServiceUrl, { baseUrl: srv.baseUrl, timeoutMs: srv.timeoutMs }), toast, 'Load MCP tools')
      setMcpDetails(Array.isArray(items) ? items : [])
      setMcpDetailsOpen({ open: true, server: srv })
    } catch(e:any) { /* toasted */ }
  }, [flowServiceUrl])

  const handleMcpDelete = useCallback(async (srv: McpServer) => {
    if (!flowServiceUrl) { toast({ title: 'Flow service URL missing', variant: 'destructive' }); return }
    try {
      await withApiErrorToast(deregisterMcpServer(flowServiceUrl, { id: srv.id, baseUrl: srv.baseUrl }), toast, 'Deregister MCP server')
      toast({ title: 'MCP server removed', description: srv.baseUrl })
      await refreshMcpServers()
    } catch(e:any) { /* toasted */ }
  }, [flowServiceUrl, refreshMcpServers])

  const verifyAndDiscoverMcp = useCallback(async () => {
    const base = mcpAddForm.baseUrl.trim().replace(/\/$/, '')
    if (!base) { toast({ title: 'Enter baseUrl', variant: 'destructive' }); return }
    if (!flowServiceUrl) { toast({ title: 'Flow service URL missing', variant: 'destructive' }); return }
    setMcpDiscovering(true); setMcpDiscovered(null)
    try {
      const arr = await withApiErrorToast(listMcpTools(flowServiceUrl, { baseUrl: base, timeoutMs: mcpAddForm.timeoutMs }), toast, 'Discover MCP tools')
      setMcpDiscovered(arr)
      if (!arr || arr.length===0) toast({ title: 'No tools discovered', description: 'Server returned no tools' })
    } catch(e:any) {
      setMcpDiscovered([])
      // withApiErrorToast already toasts; keep minimal fallback only
    } finally { setMcpDiscovering(false) }
  }, [mcpAddForm, flowServiceUrl])

  const handleRegisterDiscovered = useCallback(async (selectedNames: string[]) => {
    if (!flowServiceUrl) return
    const base = mcpAddForm.baseUrl.trim().replace(/\/$/, '')
    const picked = (mcpDiscovered||[]).filter((t:any)=> selectedNames.includes(t.name))
    if (picked.length===0) { toast({ title: 'Nothing selected' }); return }
    try {
      // 1) Register/ensure MCP server exists in catalog with explicit tool enable list
  const toolPayload = (mcpDiscovered||[]).map((t:any)=> ({ name: t.name, enabled: selectedNames.includes(t.name) }))
      await withApiErrorToast(registerMcpServer(flowServiceUrl, { baseUrl: base, name: mcpAddForm.name || undefined, id: mcpAddForm.id || undefined, timeoutMs: mcpAddForm.timeoutMs, tools: toolPayload }), toast, 'Register MCP server')
      // 2) Refresh MCP server list (authoritative) and close dialog
      toast({ title: 'MCP server registered', description: base })
      await refreshMcpServers()
      setMcpAddOpen(false)
      setMcpDiscovered(null)
      setMcpAddForm({ baseUrl: '', name: '', id: '' })
    } catch(e:any) { /* toasted */ }
  }, [flowServiceUrl, mcpDiscovered, mcpAddForm, refreshMcpServers])

    const selectedEntity = useMemo(() => {
      if (explorerSelection) return explorerSelection
      if (!selectedRef) return null

      if (selectedRef.type === 'node') {
        const node = nodes.find((n) => n.id === selectedRef.id)
        if (!node) return null
        if (node.type === 'place') return { kind: 'place' as const, id: node.id }
        if (node.type === 'transition') return { kind: 'transition' as const, id: node.id }
        return null
      }

      const edge = edges.find((e) => e.id === selectedRef.id)
      return edge ? { kind: 'arc' as const, id: edge.id } : null
    }, [explorerSelection, selectedRef, nodes, edges])

  const sidePanelDetail = useMemo(() => {
    return {
      open: true,
      width: panelWidth,
      onResizeStart: () => setResizing(true),
      selected,
      onUpdateNode: updateNode,
      onUpdateEdge: updateEdge,
      onRenamePlaceId: renamePlaceId,
      onRenameTransitionId: renameTransitionId,
      onRenameEdgeId: renameEdgeId,
      tokensOpenForPlaceId: tokensOpenForPlaceId || undefined,
      guardOpenForTransitionId: guardOpenForTransitionId || undefined,
      tab: leftTab,
      setTab: setLeftTab,
      explorerWorkflows: serverWorkflows,
      onExplorerSelect,
      onRefreshWorkflows: () => { void fetchServerWorkflowList() },
      onDeclarationsApply,
      onCreateWorkflow: async () => {
        if (!flowServiceUrl) return
        try {
          const newId = `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
          const name = `Workflow ${newId.slice(-4)}`
          const empty = { id: newId, name, description: '', colorSets: [], places: [], transitions: [], arcs: [], initialMarking: {}, declarations: {} }
          await withApiErrorToast(saveWorkflow(flowServiceUrl, empty), toast, 'Create workflow')
          setServerWorkflows((wfs) => ([...(Array.isArray(wfs) ? wfs : []), { id: newId, name }]))
          setWorkflowMeta((meta) => ({ ...meta, [newId]: { name, description: '', colorSets: [] } }))
          onExplorerSelect(newId)
          toast({ title: 'Created', description: name })
        } catch (e: any) {
          /* already toasted */
        }
      },
      onDeleteWorkflow: async (id: string) => {
        if (!flowServiceUrl) return
        if (!confirm('Delete workflow ' + id + '?')) return
        try {
          await withApiErrorToast(deleteWorkflowApi(flowServiceUrl, id), toast, 'Delete workflow')
          setServerWorkflows((list) => list.filter((w) => w.id !== id))
          if (activeWorkflowId === id) {
            setActiveWorkflowId(null)
            setNodes([])
            setEdges([])
          }
          toast({ title: 'Deleted', description: id })
        } catch (e: any) {
          /* toasted */
        }
      },
      onRenameWorkflow: (id: string, name: string) => {
        setWorkflowMeta((prev) => ({ ...prev, [id]: { ...(prev[id] || { colorSets: [] }), name } }))
        setEditedMap((prev) => ({ ...prev, [id]: true }))
        setServerWorkflows((list) => list.map((w) => (w.id === id ? { ...w, name } : w)))
      },
      workflowMeta,
      activeWorkflowId,
      explorerNodes: nodes,
      explorerEdges: edges,
      onAddPlace: () => {
        const id = `p-${Math.random().toString(36).slice(2, 7)}`
        setNodes((nds) => [
          ...nds,
          {
            id,
            type: 'place',
            position: { x: 120, y: 120 },
            data: { kind: 'place', name: `Place ${id.slice(-3)}`, colorSet: '', tokens: 0, tokenList: [] },
          } as any,
        ])
        setEditedMap((m) => (activeWorkflowId ? { ...m, [activeWorkflowId]: true } : m))
      },
      onRenamePlace: (pid: string, name: string) => setNodes((nds) => nds.map((n) => (n.id === pid && n.type === 'place' ? { ...n, data: { ...(n.data as any), name } } : n))),
      onDeletePlace: (pid: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== pid))
        setEdges((eds) => eds.filter((e) => e.source !== pid && e.target !== pid))
        setEditedMap((m) => (activeWorkflowId ? { ...m, [activeWorkflowId]: true } : m))
      },
      onAddTransition: () => {
        const id = `t-${Math.random().toString(36).slice(2, 7)}`
        setNodes((nds) => [
          ...nds,
          {
            id,
            type: 'transition',
            position: { x: 360, y: 240 },
            data: { kind: 'transition', name: `Transition ${id.slice(-3)}`, tType: 'Manual', guardExpression: 'true' },
          } as any,
        ])
        setEditedMap((m) => (activeWorkflowId ? { ...m, [activeWorkflowId]: true } : m))
      },
      onRenameTransition: (tid: string, name: string) => setNodes((nds) => nds.map((n) => (n.id === tid && n.type === 'transition' ? { ...n, data: { ...(n.data as any), name } } : n))),
      onDeleteTransition: (tid: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== tid))
        setEdges((eds) => eds.filter((e) => e.source !== tid && e.target !== tid))
        setEditedMap((m) => (activeWorkflowId ? { ...m, [activeWorkflowId]: true } : m))
      },
      onAddArc: () => {
        const place = nodes.find((n) => n.type === 'place')
        const trans = nodes.find((n) => n.type === 'transition')
        if (!place || !trans) return
        const id = `e-${Math.random().toString(36).slice(2, 7)}`
        setEdges((eds) => [
          ...eds,
          { id, source: place.id, target: trans.id, type: 'labeled', data: { label: 'arc', expression: '' } } as any,
        ])
        setEditedMap((m) => (activeWorkflowId ? { ...m, [activeWorkflowId]: true } : m))
      },
      onDeleteArc: (aid: string) => {
        setEdges((eds) => eds.filter((e) => e.id !== aid))
        setEditedMap((m) => (activeWorkflowId ? { ...m, [activeWorkflowId]: true } : m))
      },
      onColorSetsChange: (next: string[]) => {
        if (!activeWorkflowId) return
        setWorkflowMeta((meta) => ({
          ...meta,
          [activeWorkflowId]: {
            ...(meta[activeWorkflowId] || { name: activeWorkflowId, description: '', colorSets: [] }),
            colorSets: next,
          },
        }))
        setEditedMap((m) => ({ ...m, [activeWorkflowId]: true }))
      },
      onSelectEntity: (kind: 'place' | 'transition' | 'arc' | 'declarations', id: string) => {
        if (kind === 'place' || kind === 'transition') {
          setExplorerSelection(null)
          setSelectedRef({ type: 'node', id })
          setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, selected: true } : { ...n, selected: false })))
          setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
          setLeftTab('property')
        } else if (kind === 'arc') {
          setExplorerSelection(null)
          setSelectedRef({ type: 'edge', id })
          setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, selected: true } : { ...e, selected: false })))
          setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
          setLeftTab('property')
        } else if (kind === 'declarations') {
          setSelectedRef(null)
          setExplorerSelection({ kind: 'declarations', id })
          setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
          setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
          setLeftTab('property')
        }
      },
      selectedEntity,
    }
  }, [
    nodes,
    edges,
    panelWidth,
    selected,
    updateNode,
    updateEdge,
    renamePlaceId,
    renameTransitionId,
    renameEdgeId,
    tokensOpenForPlaceId,
    guardOpenForTransitionId,
    leftTab,
    setLeftTab,
    serverWorkflows,
    onExplorerSelect,
    fetchServerWorkflowList,
    onDeclarationsApply,
    flowServiceUrl,
    toast,
    setServerWorkflows,
    setWorkflowMeta,
  selectedEntity,
  workflowMeta,
    activeWorkflowId,
    setNodes,
    setEdges,
    setEditedMap,
    setExplorerSelection,
  ])

  useEffect(() => {
    const storeState = flowStore.getState()
    if (storeState.sidePanelDetail !== sidePanelDetail) {
      storeState.setSidePanelDetail(sidePanelDetail)
    }
    window.dispatchEvent(new CustomEvent('goflow-sidepanel-props', { detail: sidePanelDetail }))
  }, [flowStore, sidePanelDetail])

  useEffect(() => {
    const storeState = flowStore.getState()
    if (storeState.selectedEntity !== selectedEntity) {
      storeState.setSelectedEntity(selectedEntity)
    }
  }, [flowStore, selectedEntity])

  return (
    <div ref={containerRef} className="flex h-full w-full gap-4">
  {/* ...existing code... */}
      {/* Left System Panel with tabs */}
      {showSystem && (
        <div className="flex h-full w-80 flex-col rounded-lg border bg-white">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" aria-hidden />
              <h2 className="text-sm font-medium">Simulation</h2>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setShowSystem(false)} aria-label="Close system panel">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            {systemTab === 'simulation' && (
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b bg-neutral-50 px-2 py-1 text-xs relative">
                  <button
                    className="h-6 px-2 rounded bg-emerald-600 text-white text-[11px]"
                    disabled={simLoading}
                    onClick={() => {
                      if (!activeWorkflowId) { toast({ title: 'Open a workflow first', description: 'Select or load a workflow before starting a simulation', variant: 'destructive' }); return }
                      const wfId = activeWorkflowId
                      if (!wfId) return
                      const cpnPath = workspacePathByIdRef.current[wfId]
                      const cpnFile = typeof cpnPath === 'string' ? cpnPath.split('/').pop() : undefined
                      const cpnName = cpnFile ? cpnFile.replace(/\.cpn$/i, '') : wfId
                      startSim({ cpnName })
                    }}
                    title="Start new simulation for current workflow"
                  >+ Sim</button>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-neutral-500">Simulation:</span>
                    <select
                      className="h-6 rounded border px-1 text-[11px] min-w-[120px]"
                      value={activeSimId || ''}
                      onChange={(e)=> selectSim(e.target.value || null)}
                      disabled={simLoading || sims.length===0}
                    >
                      <option value="">(none)</option>
                      {sims.map(s => (
                        <option key={s.caseId} value={s.caseId}>{s.caseId}</option>
                      ))}
                    </select>
                  </div>
                  {activeSim && <span className="text-[10px] text-neutral-500">Step {activeSim.currentStep ?? 0}</span>}
                </div>
                <div className="flex-1 overflow-hidden">
                  <MonitorPanel
                    open={!!activeSim}
                    loading={simLoading}
                    running={simRunning}
                    // Simulation case provides enabled transitions directly under activeSim.enabledTransitions
                    enabledTransitions={activeSim?.enabledTransitions || []}
                    // Server shape uses marking.places; fallback to object if already flattened
                    marking={(() => { const mk = activeSim?.marking; if (!mk) return {}; if (mk.places && typeof mk.places === 'object') return mk.places; return mk; })()}
                    currentStep={activeSim?.currentStep}
                    stepLimit={simStepLimit}
                    onChangeStepLimit={(n)=> setSimStepLimit(n)}
                    onStep={() => handleSimStep()}
                    onRun={() => runSim(simStepLimit)}
                    onRefresh={() => refreshSim()}
                    onDelete={() => activeSimId ? deleteSim(activeSimId) : undefined}
                    onReset={async () => {
                      if (!activeSimId) return
                      const id = activeSimId
                      await deleteSim(id)
                      // slight delay to allow server cleanup; then re-start
                      setTimeout(() => {
                        const wfId = activeWorkflowId
                        if (!wfId) return
                        const cpnPath = workspacePathByIdRef.current[wfId]
                        const cpnFile = typeof cpnPath === 'string' ? cpnPath.split('/').pop() : undefined
                        const cpnName = cpnFile ? cpnFile.replace(/\.cpn$/i, '') : wfId
                        startSim({ cpnName })
                      }, 50)
                    }}
                  />
                  {/* Workflow picker removed */}
                  {simFormOpen && (
                    <div className="fixed inset-0 z-[120] flex flex-col bg-white/95 backdrop-blur-sm">
                      <div className="flex items-center justify-between border-b px-4 py-2 bg-white/80">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{simFormTitle}</span>
                          {simFormTransitionId && <span className="text-[10px] text-neutral-400">{simFormTransitionId}</span>}
                        </div>
                        <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100" onClick={()=> setSimFormOpen(false)}>✕</button>
                      </div>
                      <div className="flex-1 overflow-auto p-6">
                        <DynamicForm
                          schema={simFormEffectiveSchema || simFormSchema || { type: 'string' }}
                          uiSchema={simFormUiSchema as any}
                          data={simFormData ?? {}}
                          onChange={(d: any) => setSimFormData(d)}
                        />
                        {!simFormSchema && !simFormUiSchema && <p className="mt-4 text-[11px] text-neutral-500">Schema inferred. Provide formSchema/layoutSchema on transition to customize.</p>}
                      </div>
                      <div className="border-t px-4 py-2 flex justify-end gap-2 bg-white/80">
                        <button type="button" onClick={()=> setSimFormOpen(false)} className="px-3 py-1.5 text-xs rounded border hover:bg-neutral-50">Cancel</button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (simFormTransitionId) {
                              await fireSim(simFormTransitionId, simFormBindingIndex, simFormData)
                              setSimFormOpen(false)
                            }
                          }}
                          className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-500"
                        >Submit</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* settings tab moved to system settings dialog/menu; removed inline settings tab */}
            {/* MCP moved to the new 'MCP Tools' left panel tab. Inline MCP list removed from the system panel. */}
          </div>
        </div>
      )}

      {/* MCP Delete Confirmation */}
      <AlertDialog open={mcpDeleteConfirm.open} onOpenChange={(v)=> setMcpDeleteConfirm(prev => ({ ...prev, open: v }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deregister MCP server?</AlertDialogTitle>
            <AlertDialogDescription>
              {mcpDeleteConfirm.server?.name} — {mcpDeleteConfirm.server?.baseUrl}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={()=> setMcpDeleteConfirm({ open: false })}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async ()=> {
              const srv = mcpDeleteConfirm.server
              if (srv) { await handleMcpDelete(srv) }
              setMcpDeleteConfirm({ open: false })
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Canvas area */}
      <div className="relative h-full flex-1 overflow-hidden rounded-lg border bg-white">
  <ReactFlow<Node<PetriNodeData>, Edge<PetriEdgeData>>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onSelectionChange={onSelectionChange}
          onNodeContextMenu={onNodeContextMenu}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          elementsSelectable={interactive}
          nodesDraggable={interactive}
          nodesConnectable={interactive}
          panOnDrag={interactive}
          zoomOnScroll={interactive}
          zoomOnPinch={interactive}
          selectionOnDrag
          deleteKeyCode={["Delete", "Backspace"]}
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={{ stroke: "#059669", strokeWidth: 2 }}
        >
          <Background gap={16} color="#e5e5e5" />
          <MiniMap zoomable pannable />
          <CanvasControls
            onSave={async () => {
              if (!activeWorkflowId) return
              const mode = await persistWorkflow(activeWorkflowId)
              if (mode && typeof window !== 'undefined') {
                const path = workspacePathByIdRef.current[activeWorkflowId]
                if (path) {
                  window.dispatchEvent(new CustomEvent('goflow-file-saved', {
                    detail: { path, workflowId: activeWorkflowId, mode }
                  }))
                }
              }
            }}
            edited={edited}
            interactive={interactive}
            setInteractive={setInteractive}
            showSystem={showSystem}
            toggleSystem={() => { setShowSystem(v => !v); if (!showSystem) setSystemTab('simulation') }}
            openExplorer={async () => { setLeftTab('explorer'); if (!serverWorkflowsFetched) { try { await withApiErrorToast(fetchServerWorkflowList(), toast, 'Fetch workflows') } catch(e){} } }}
            openProperties={() => setLeftTab('property')}
            addPlace={addPlace}
            addTransition={addTransition}
            onAutoLayout={() => autoLayout()}
            onValidate={async () => {
              if (!activeWorkflowId || !flowServiceUrl) return
              setValidating(true)
              try {
                const result = await withApiErrorToast(validateWorkflow(flowServiceUrl, activeWorkflowId), toast, 'Validate')
                const v = result.violations || []
                setViolations(v)
                if (v.length > 0) {
                  setValidationOpen(true)
                } else {
                  toast({ title: 'Validation passed', description: 'No violations found.' })
                }
              } catch(e:any){ /* toasted */ }
              finally { setValidating(false) }
            }}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            fitView={fitView}
            onOpenRun={() => {
              // navigate to run mode keeping current workflow id
              const wf = activeWorkflowId ? `&workflow=${encodeURIComponent(activeWorkflowId)}` : ''
              window.location.href = `/wfBuilder?mode=run${wf}`
            }}
          />
        </ReactFlow>



        {contextMenu.open && contextMenu.nodeId && (
          createPortal((
          <div
            className="z-50 rounded-md border bg-white shadow-lg"
            style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, minWidth: 200 }}
            onClick={(e) => e.stopPropagation()}
            role="menu"
            aria-label="Transition context menu"
          >
            {(nodes.find(n=>n.id===contextMenu.nodeId)?.type === 'transition') && (
              <>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  onClick={() => {
                    deleteNodeById(contextMenu.nodeId as string)
                    setContextMenu({ open: false, x: 0, y: 0, nodeId: null })
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
                  Delete transition
                </button>
                <Separator />
                {(["Manual", "Auto", "Message", "LLM", "Tools", "Retriever"] as TransitionType[]).map((t) => (
                  <button
                    key={t}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    onClick={() => {
                      setTransitionType(contextMenu.nodeId as string, t)
                      setContextMenu({ open: false, x: 0, y: 0, nodeId: null })
                      setSelectedRef({ type: "node", id: contextMenu.nodeId as string })
                    }}
                  >
                    <span className="flex items-center gap-2 capitalize">
                      <TransitionIcon tType={t} className="h-4 w-4" />
                      {t}
                    </span>
                    {(((nodes as any[]).find((n: any) => n.id === contextMenu.nodeId) as any)?.data as any)?.tType === t ? (
                      <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                    ) : null}
                  </button>
                ))}
              </>
            )}
            {(nodes.find(n=>n.id===contextMenu.nodeId)?.type === 'place') && (
              <>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  onClick={() => {
                    deleteNodeById(contextMenu.nodeId as string)
                    setContextMenu({ open: false, x: 0, y: 0, nodeId: null })
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
                  Delete place
                </button>
                <Separator />
                <div className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">Color Set</div>
                {(() => {
                  const custom = workflowMeta[activeWorkflowId||'']?.colorSets || []
                  // Pre-supported JSON form schema names as colors (lazy load)
                  // Dynamic hook usage inside IIFE is unconventional; moved outside not trivial here so guard.
                  let preSupportedNames: string[] = []
                  try {
                    // @ts-ignore - allow conditional require pattern
                    const hook = require('@/components/petri/pre-supported-schemas')
                    if (hook && hook.usePreSupportedSchemas) {
                      const ps = hook.usePreSupportedSchemas()
                      if (ps && ps.names) {
                        preSupportedNames = ps.names
                        if (!ps.loaded && ps.load) { try { ps.load() } catch {} }
                      }
                    }
                  } catch { /* ignore runtime require issues */ }
                  // Ensure built-ins always available even if user removed from meta
                  const idRe = /^[A-Za-z_][A-Za-z0-9_]*$/
                  const all = Array.from(new Set([...DEFAULT_COLOR_SETS, ...custom, ...preSupportedNames].filter(n => idRe.test(n))))
                  return all.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-neutral-400">No color sets defined</div>
                  ) : (
                    all.map(cs => (
                      <button
                        key={cs}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-neutral-50"
                        onClick={() => {
                          setNodes(nds => nds.map(n => n.id===contextMenu.nodeId ? { ...n, data: { ...(n.data as any), colorSet: cs } } : n))
                          setContextMenu({ open: false, x:0, y:0, nodeId: null })
                          setSelectedRef({ type: 'node', id: contextMenu.nodeId as string })
                        }}
                      >
                        <span className={DEFAULT_COLOR_SETS.includes(cs) ? 'font-medium' : ''}>{cs}</span>
                        {(((nodes as any[]).find((n:any)=>n.id===contextMenu.nodeId)?.data as any)?.colorSet) === cs ? <Check className="h-4 w-4 text-emerald-600" /> : null}
                      </button>
                    ))
                  )
                })()}
                <Separator />
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  onClick={() => {
                    setNodes(nds => nds.map(n => n.id===contextMenu.nodeId ? { ...n, data: { ...(n.data as any), colorSet: '' } } : n))
                    setContextMenu({ open: false, x:0, y:0, nodeId: null })
                  }}
                >
                  <span>Clear color set</span>
                </button>
              </>
            )}
          </div>), document.body)
        )}
      </div>

      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Validation Result</DialogTitle>
            <DialogDescription>{violations.length} violation(s) found.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] overflow-auto rounded border">
            {violations.length === 0 ? (
              <div className="p-4 text-sm text-emerald-600">No violations.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Rule</th>
                    <th className="px-2 py-1 text-left font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map((v, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-neutral-50">
                      <td className="border-t px-2 py-1 align-top whitespace-pre-wrap max-w-[160px]">{v.rule || v.code || '-'}</td>
                      <td className="border-t px-2 py-1 align-top whitespace-pre-wrap">{v.message || v.detail || v.description || JSON.stringify(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <UIButton onClick={() => setValidationOpen(false)}>Close</UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MCP Add Dialog */}
      <Dialog open={mcpAddOpen} onOpenChange={setMcpAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add MCP server</DialogTitle>
            <DialogDescription>Enter the MCP httpstream base URL and discover tools to register.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <label className="w-24 text-right">Base URL</label>
              <input className="flex-1 rounded border px-2 py-1" placeholder="https://data.lizhao.net/api/mcp" value={mcpAddForm.baseUrl} onChange={e=>setMcpAddForm(f=>({...f, baseUrl: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-24 text-right">Name</label>
              <input className="flex-1 rounded border px-2 py-1" placeholder="Optional label" value={mcpAddForm.name} onChange={e=>setMcpAddForm(f=>({...f, name: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-24 text-right">Server ID</label>
              <input className="flex-1 rounded border px-2 py-1" placeholder="Optional identifier" value={mcpAddForm.id} onChange={e=>setMcpAddForm(f=>({...f, id: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-24 text-right">Timeout (ms)</label>
              <input className="w-40 rounded border px-2 py-1" type="number" placeholder="8000" value={mcpAddForm.timeoutMs||''} onChange={e=>setMcpAddForm(f=>({...f, timeoutMs: e.target.value? Number(e.target.value): undefined }))} />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button size="sm" variant="secondary" onClick={verifyAndDiscoverMcp} disabled={mcpDiscovering}>{mcpDiscovering? 'Discovering…' : 'Discover Tools'}</Button>
            </div>
            {Array.isArray(mcpDiscovered) && (
              <div className="max-h-60 overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr>
                      <th className="px-2 py-1 text-left">Enabled</th>
                      <th className="px-2 py-1 text-left">Name</th>
                      <th className="px-2 py-1 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mcpDiscovered.map((t:any, i:number) => (
                      <tr key={i} className="odd:bg-white even:bg-neutral-50">
                        <td className="border-t px-2 py-1"><input type="checkbox" onChange={(e)=>{ const name=t.name; setMcpDiscovered(arr=>{ const next=(arr||[]).map((x:any)=> ({...x})); const idx=next.findIndex((x:any)=>x.name===name); if (idx>=0) next[idx]._selected = e.target.checked; return next }) }} /></td>
                        <td className="border-t px-2 py-1">{t.name}</td>
                        <td className="border-t px-2 py-1">{t.description || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <UIButton variant="secondary" onClick={()=> setMcpAddOpen(false)}>Cancel</UIButton>
            <UIButton onClick={()=> handleRegisterDiscovered((mcpDiscovered||[]).filter((t:any)=>t._selected).map((t:any)=>t.name))} disabled={!Array.isArray(mcpDiscovered) || (mcpDiscovered||[]).every((t:any)=>!t._selected)}>Register Selected</UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MCP Details Dialog */}
      <Dialog open={mcpDetailsOpen.open} onOpenChange={(v)=> setMcpDetailsOpen(prev=> ({ ...prev, open: v }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>MCP Tools: {mcpDetailsOpen.server?.name}</DialogTitle>
            <DialogDescription>{mcpDetailsOpen.server?.baseUrl}</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto rounded border">
            {mcpDetails.length === 0 ? (
              <div className="p-3 text-xs text-neutral-500">No tools found for this server.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-2 py-1 text-left">Enabled</th>
                    <th className="px-2 py-1 text-left">Name</th>
                    <th className="px-2 py-1 text-left">Description</th>
                    <th className="px-2 py-1 text-left" aria-label="schema" />
                  </tr>
                </thead>
                <tbody>
                  {mcpDetails.map((t:any, i:number) => (
                    <>
                      <tr key={`row-${i}`} className="odd:bg-white even:bg-neutral-50">
                        <td className="border-t px-2 py-1 align-top">
                          <input
                            type="checkbox"
                            disabled
                            aria-label={`Tool ${t.name} enabled`}
                            checked={!!(t.enabled ?? t.Enabled)}
                            className="h-3 w-3 align-middle accent-emerald-600 cursor-not-allowed"
                          />
                        </td>
                        <td className="border-t px-2 py-1 align-top">{t.name}</td>
                        <td className="border-t px-2 py-1 align-top">{t.description || ''}</td>
                        <td className="border-t px-2 py-1 align-top text-right">
                          <button className="px-2 py-0.5 text-[11px] border rounded" onClick={()=> setMcpDetailsExpanded(s=> ({ ...s, [i]: !s[i] }))}>{mcpDetailsExpanded[i] ? 'Hide' : 'Show'} schema</button>
                        </td>
                      </tr>
                      {mcpDetailsExpanded[i] && (
                        <tr key={`schema-${i}`} className="odd:bg-white even:bg-neutral-50">
                          <td colSpan={4} className="border-t px-2 py-2">
                            <div className="grid grid-cols-1 gap-2">
                              <div>
                                <div className="text-[11px] text-neutral-600 mb-1">inputSchema</div>
                                <div className="rounded border">
                                  <CodeMirror value={JSON.stringify(t.inputSchema||{}, null, 2)} height="180px" theme="light" basicSetup={{ lineNumbers: false }} readOnly={true} onChange={()=>{}} />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <UIButton onClick={()=> setMcpDetailsOpen({ open: false })}>Close</UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SystemSettingsTab() {
  const { settings, setSetting, deleteSetting, addSetting, resetDefaults } = useSystemSettings()
  const entries = Object.entries(settings)
  return (
    <div className="flex h-full flex-col p-3 text-xs">
      <div className="mb-2 flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={addSetting}>Add</Button>
        <Button size="sm" variant="outline" onClick={resetDefaults}>Reset Defaults</Button>
      </div>
      <div className="overflow-auto rounded border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="border-b px-2 py-1 text-left font-medium">Key</th>
              <th className="border-b px-2 py-1 text-left font-medium">Value</th>
              <th className="border-b px-2 py-1" aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className="odd:bg-white even:bg-neutral-50">
                <td className="border-b px-2 py-1 align-top">
                  <input
                    className="w-full rounded border px-1 py-0.5 bg-white"
                    value={k}
                    readOnly={true /* keys immutable once created to keep references stable */}
                  />
                </td>
                <td className="border-b px-2 py-1 align-top">
                  <input
                    className="w-full rounded border px-1 py-0.5 bg-white"
                    value={v}
                    onChange={(e) => setSetting(k, e.target.value)}
                  />
                </td>
                <td className="border-b px-1 py-1 text-right align-top">
                  {!(k === 'flowServiceUrl' || k === 'dictionaryUrl') && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteSetting(k)} aria-label={`Delete ${k}`}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-neutral-500">Settings are stored locally and available app-wide via context.</p>
    </div>
  )
}

// TransitionIcon moved to its own file
