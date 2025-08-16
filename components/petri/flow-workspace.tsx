"use client"

import type React from "react"

import { useCallback, useMemo, useRef, useState, useEffect } from "react"
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
import { Activity, Bot, Brain, Check, CirclePlus, Coins, Eye, File, Folder, Hand, Maximize2, MessageSquare, MousePointer2, Play, RotateCcw, Save, SlidersHorizontal, TableProperties, SquarePlus, Trash2, X, ZoomIn, ZoomOut } from "lucide-react"
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
import {
  anyEnabledTransitions,
  fireTransition,
  getEnabledTransitions,
  type PetriEdgeData,
  type PetriNodeData,
  type TransitionType,
} from "@/lib/petri-sim"
import { getWorkflowGraph, updateWorkflowFromGraph } from "./mock-workflow-store"
import { fetchWorkflow, fetchMarking, fetchTransitionsStatus, fireTransition as fireTransitionApi, simulationStep } from "./petriClient"

const nodeTypes = { place: PlaceNode, transition: TransitionNode } as any
const edgeTypes = { labeled: LabeledEdge } as any

type SelectedRef = { type: "node"; id: string } | { type: "edge"; id: string } | null
type SelectedResolved = { type: "node"; node: Node<PetriNodeData> } | { type: "edge"; edge: Edge<PetriEdgeData> } | null

type PanelMode = "mini" | "normal" | "full"

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
  const [selectedRef, setSelectedRef] = useState<SelectedRef>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>("mini")
  const [panelWidth, setPanelWidth] = useState<number>(360)
  const [resizing, setResizing] = useState(false)
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)
  const [editedMap, setEditedMap] = useState<Record<string, boolean>>({});
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
  const [showSystem, setShowSystem] = useState<boolean>(false)
  const [systemTab, setSystemTab] = useState<'monitor' | 'settings'>('monitor')
  const [leftTab, setLeftTab] = useState<'property' | 'explorer'>("property")
  const [interactive, setInteractive] = useState<boolean>(true)
  const [tokensOpenForPlaceId, setTokensOpenForPlaceId] = useState<string | null>(null)
  const [guardOpenForTransitionId, setGuardOpenForTransitionId] = useState<string | null>(null)
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
  const { settings } = useSystemSettings();

  // Server workflow state for server mode
  const [serverWorkflows, setServerWorkflows] = useState<any[]>([]);
  const [serverWorkflowsFetched, setServerWorkflowsFetched] = useState(false);
  const [serverWorkflowCache, setServerWorkflowCache] = useState<Record<string, any>>({});

  // Fetch workflow list from server
  const fetchServerWorkflowList = useCallback(async () => {
    if (!settings.flowServiceUrl) return;
    try {
      const list = await import("./petriClient").then(m => m.fetchWorkflowList(settings.flowServiceUrl));
      setServerWorkflows(list.data.cpns);
      setServerWorkflowsFetched(true);
    } catch (err: any) {
      alert('Failed to fetch workflow list: ' + (err?.message || err));
    }
  }, [settings.flowServiceUrl]);

  // Handler for selecting a workflow in Explorer (server or mockup)
  const onExplorerSelect = useCallback(async (workflowId: string) => {
    if (settings.runMode === 'mockup') {
      const graph = getWorkflowGraph(workflowId)
      if (graph) {
        setNodes(graph.nodes)
        setEdges(graph.edges)
        setSelectedRef(null)
        setTokensOpenForPlaceId(null)
        setGuardOpenForTransitionId(null)
        setActiveWorkflowId(workflowId)
        setEditedMap((prev) => ({ ...prev, [workflowId]: false }))
        if (panelMode === 'mini') setPanelMode('normal')
      }
    } else {
      // Only fetch if not already cached
      if (!serverWorkflowCache[workflowId]) {
        try {
          const swf = (await fetchWorkflow(settings.flowServiceUrl, workflowId)).data;
          // Convert server workflow to xyflow format
          const { syncListsIntoGraph } = await import("./mock-workflow-store");
          const wf = syncListsIntoGraph(swf);
          setServerWorkflowCache((prev) => ({ ...prev, [workflowId]: wf }));
          setNodes(wf.graph?.nodes || []);
          setEdges(wf.graph?.edges || []);
        } catch (err: any) {
          alert('Failed to fetch workflow: ' + (err?.message || err));
          return;
        }
      } else {
        const wf = serverWorkflowCache[workflowId];
        setNodes(wf.graph?.nodes || []);
        setEdges(wf.graph?.edges || []);
      }
      setSelectedRef(null)
      setTokensOpenForPlaceId(null)
      setGuardOpenForTransitionId(null)
      setActiveWorkflowId(workflowId)
      setEditedMap((prev) => ({ ...prev, [workflowId]: false }))
      if (panelMode === 'mini') setPanelMode('normal')
    }
  }, [settings, getWorkflowGraph, setNodes, setEdges, setSelectedRef, setTokensOpenForPlaceId, setGuardOpenForTransitionId, setActiveWorkflowId, setEditedMap, panelMode, setPanelMode, serverWorkflowCache]);

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

  const controlsRight = useMemo(() => (panelMode === "normal" ? panelWidth + 12 : 12), [panelMode, panelWidth])

  useEffect(() => {
    function onDocClick() {
      setContextMenu((c) => ({ ...c, open: false }))
    }
    function onKey(e: KeyboardEvent) {
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
  setGuardOpenForTransitionId(null)
      if (panelMode === "mini") setPanelMode("normal")
    }
    function onOpenGuard(ev: Event) {
      const ce = ev as CustomEvent<{ transitionId: string }>
      const tid = ce.detail?.transitionId
      if (!tid) return
      setSelectedRef({ type: "node", id: tid })
  setGuardOpenForTransitionId(tid)
      if (panelMode === "mini") setPanelMode("normal")
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
  }, [panelMode])

  // Listen to workflow selection from Explorer and load its graph
  useEffect(() => {
    function onLoadWorkflow(ev: Event) {
      const ce = ev as CustomEvent<{ workflowId: string }>
      const id = ce.detail?.workflowId
      if (!id) return
      const graph = getWorkflowGraph(id)
      if (graph) {
        setNodes(graph.nodes)
        setEdges(graph.edges)
        setSelectedRef(null)
        setTokensOpenForPlaceId(null)
        setGuardOpenForTransitionId(null)
        setActiveWorkflowId(id)
        // Reset edited status for this workflow
        setEditedMap((prev) => ({ ...prev, [id]: false }))
        if (panelMode === 'mini') setPanelMode('normal')
      }
    }
    window.addEventListener('loadWorkflow', onLoadWorkflow as EventListener)
    return () => window.removeEventListener('loadWorkflow', onLoadWorkflow as EventListener)
  }, [panelMode, setNodes, setEdges])

  // When canvas graph changes propagate back to store (debounced) if a workflow is active
  // Only set edited=true if nodes/edges change and not on load
  const prevNodes = useRef<Node<PetriNodeData>[]>([]);
  const prevEdges = useRef<Edge<PetriEdgeData>[]>([]);
  useEffect(() => {
    if (!activeWorkflowId) return;
    // Compare nodes/edges to previous, if different, set edited true
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(prevNodes.current);
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(prevEdges.current);
    if ((nodesChanged || edgesChanged) && prevNodes.current.length > 0) {
      setEditedMap((prev) => ({ ...prev, [activeWorkflowId]: true }));
    }
    prevNodes.current = nodes;
    prevEdges.current = edges;
    const h = setTimeout(() => {
      updateWorkflowFromGraph(activeWorkflowId, nodes as any, edges as any)
      // Emit event to let Explorer refresh if needed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('workflowGraphUpdated', { detail: { workflowId: activeWorkflowId } }))
      }
    }, 200)
    return () => clearTimeout(h)
  }, [nodes, edges, activeWorkflowId])

  // Listen to primitive store changes (Explorer mutations) and refresh canvas graph if same workflow mutated
  useEffect(() => {
    function onStoreChanged(ev: Event) {
      const ce = ev as CustomEvent<{ workflowId: string }>
      const id = ce.detail?.workflowId
      if (!id || id !== activeWorkflowId) return
      const graph = getWorkflowGraph(id)
      if (graph) {
        setNodes(graph.nodes)
        setEdges(graph.edges)
      }
    }
    window.addEventListener('workflowStoreChanged', onStoreChanged as EventListener)
    return () => window.removeEventListener('workflowStoreChanged', onStoreChanged as EventListener)
  }, [activeWorkflowId])

  // Listen to explorer entity selection to visually select in canvas
  useEffect(() => {
    function onExplorerSelect(ev: Event) {
      const ce = ev as CustomEvent<{ kind: 'place'|'transition'|'arc'; id: string; workflowId: string }>
      const detail = ce.detail
      if (!detail) return
      // Only act if same workflow active
      if (detail.workflowId !== activeWorkflowId) return
      if (detail.kind === 'place' || detail.kind === 'transition') {
        const id = detail.id
        setSelectedRef({ type: 'node', id })
        setNodes(nds => nds.map(n => ({ ...n, selected: n.id === id })))
        setEdges(eds => eds.map(e => ({ ...e, selected: false })))
        if (panelMode === 'mini') setPanelMode('normal')
      } else if (detail.kind === 'arc') {
        const id = detail.id
        setSelectedRef({ type: 'edge', id })
        setEdges(eds => eds.map(e => ({ ...e, selected: e.id === id })))
        setNodes(nds => nds.map(n => ({ ...n, selected: false })))
        if (panelMode === 'mini') setPanelMode('normal')
      }
    }
    window.addEventListener('explorerSelectEntity', onExplorerSelect as EventListener)
    return () => window.removeEventListener('explorerSelectEntity', onExplorerSelect as EventListener)
  }, [activeWorkflowId, panelMode])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizing || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const desired = Math.min(Math.max(rect.right - e.clientX, 240), Math.min(640, rect.width - 160))
      setPanelWidth(desired)
    }
    function onUp() {
      if (resizing) setResizing(false)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [resizing])

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
      setSelectedRef({ type: "node", id: n.id })
      setTokensOpenForPlaceId((prev) => (prev === n.id ? prev : null))
          setGuardOpenForTransitionId((prev) => (prev === n.id ? prev : null))
    } else if (e) {
      setSelectedRef({ type: "edge", id: e.id })
      setTokensOpenForPlaceId(null)
          setGuardOpenForTransitionId(null)
    } else {
      setSelectedRef(null)
      setTokensOpenForPlaceId(null)
          setGuardOpenForTransitionId(null)
    }
  }, [])

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type !== "transition") return
      event.preventDefault()
      const { clientX, clientY } = event
      setContextMenu({ open: true, x: clientX, y: clientY, nodeId: node.id })
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

      const newNode = startIsPlace
        ? {
            id: newId,
            type: "transition" as const,
            position: flowPos,
            guardExpression: "true",
            data: {
              kind: "transition",
              name: "Transition",
              tType: "manual",
              manual: { assignee: "", formSchemaId: "" }              
            },
          }
        : {
            id: newId,
            type: "place" as const,
            position: flowPos,
            data: { kind: "place", name: "Place", tokens: 0, tokenList: [] },
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
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "place",
        position: pos,
        data: { kind: "place", name: "Place", tokens: 0, tokenList: [], colorSet: 'INT' },
      },
    ])
    setSelectedRef({ type: "node", id })
  }, [screenToFlowPosition, setNodes])

  const addTransition = useCallback(() => {
    const id = `t-${Math.random().toString(36).slice(2, 7)}`
    const pos = screenToFlowPosition ? screenToFlowPosition({ x: 420, y: 150 }) : { x: 420, y: 150 }
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "transition",
        position: pos,
        guardExpression: "true",
        data: {
          kind: "transition",
          name: "Transition",
          tType: "manual",
          manual: { assignee: "", formSchemaId: "" }
        },
      },
    ])
    setSelectedRef({ type: "node", id })
  }, [screenToFlowPosition, setNodes])

  const deleteNodeById = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id))
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
      setSelectedRef(null)
      setTokensOpenForPlaceId(null)
  setGuardOpenForTransitionId(null)
    },
    [setNodes, setEdges],
  )

  const setTransitionType = useCallback(
    (id: string, tType: TransitionType) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id && n.type === "transition" ? { ...n, data: { ...(n.data as any), tType } } : n)),
      )
    },
    [setNodes],
  )

  // Monitor tab state for server mode
  const [serverMarking, setServerMarking] = useState<any>(null);
  const [serverTransitions, setServerTransitions] = useState<any[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);

  // Fetch server marking and transitions when Monitor tab is opened in server mode
  useEffect(() => {
    if (settings.runMode !== 'mockup' && showSystem && systemTab === 'monitor' && activeWorkflowId && settings.flowServiceUrl) {
      setMonitorLoading(true);
      Promise.all([
        fetchMarking(settings.flowServiceUrl, activeWorkflowId),
        fetchTransitionsStatus(settings.flowServiceUrl, activeWorkflowId)
      ]).then(([marking, transitions]) => {
        setServerMarking(marking.data.places);
        setServerTransitions(transitions.data || []);
        console.log(serverMarking);
      }).catch((err) => {
        setServerMarking(null);
        setServerTransitions([]);
      }).finally(() => setMonitorLoading(false));
    }
  }, [settings.runMode, showSystem, systemTab, activeWorkflowId, settings.flowServiceUrl]);

  const enabled = useMemo(() => {
    if (settings.runMode === 'mockup') return getEnabledTransitions(nodes, edges);
    return serverTransitions.filter((t) => t.enabled);
  }, [settings.runMode, nodes, edges, serverTransitions]);

  const doAutoStep = useCallback(async () => {
    if (settings.runMode === 'mockup') {
      const enabledList = anyEnabledTransitions(nodes, edges)
      if (enabledList.length === 0) return
      const tid = enabledList[0].id
      const { nodes: newNodes } = fireTransition(tid, nodes, edges)
      setNodes(newNodes)
    } else if (activeWorkflowId && settings.flowServiceUrl) {
      setMonitorLoading(true);
      try {
        await simulationStep(settings.flowServiceUrl, activeWorkflowId);
        // Refresh marking and transitions
        const [marking, transitions] = await Promise.all([
          fetchMarking(settings.flowServiceUrl, activeWorkflowId),
          fetchTransitionsStatus(settings.flowServiceUrl, activeWorkflowId)
        ]);
        setServerMarking(marking);
        setServerTransitions(transitions.data || []);
      } finally {
        setMonitorLoading(false);
      }
    }
  }, [settings.runMode, nodes, edges, setNodes, activeWorkflowId, settings.flowServiceUrl]);

  const resetTokens = useCallback(() => {
    if (settings.runMode === 'mockup') {
      setNodes((nds) =>
        nds.map((n) => (n.type === "place" ? { ...n, data: { ...(n.data as any), tokens: 0, tokenList: [] } } : n)),
      )
    } else {
      // No-op or implement server reset if available
    }
  }, [settings.runMode, setNodes])

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

  return (
    <div ref={containerRef} className="flex h-full w-full gap-4">
  {/* ...existing code... */}
      {/* Left System Panel with tabs */}
      {showSystem && (
        <div className="flex h-full w-80 flex-col rounded-lg border bg-white">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" aria-hidden />
              <h2 className="text-sm font-medium">System</h2>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setShowSystem(false)} aria-label="Close system panel">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex border-b text-xs font-medium">
            <button
              className={`px-3 py-2 ${systemTab === 'monitor' ? 'border-b-2 border-emerald-600 text-emerald-700' : 'text-neutral-500'}`}
              onClick={() => setSystemTab('monitor')}
            >Monitor</button>
            <button
              className={`px-3 py-2 ${systemTab === 'settings' ? 'border-b-2 border-emerald-600 text-emerald-700' : 'text-neutral-500'}`}
              onClick={() => setSystemTab('settings')}
            >Settings</button>
          </div>
          <div className="flex-1 overflow-hidden">
            {systemTab === 'monitor' && (
              <div className="flex h-full flex-col p-3">
                <ScrollArea className="h-full">
                  <div className="space-y-4 pr-2">
                    <section>
                      <div className="mb-2 text-xs font-semibold text-neutral-600">Enabled Transitions</div>
                      {monitorLoading ? (
                        <div className="text-xs text-neutral-500">Loading...</div>
                      ) : enabled.length === 0 ? (
                        <div className="text-xs text-neutral-500">No transitions enabled</div>
                      ) : (
                        <div className="grid gap-2">
                          {enabled.map((t) => (
                            <div key={t.id || t.transitionId} className="flex items-center justify-between rounded-md border px-2 py-1.5">
                              <div className="flex items-center gap-2">
                                <TransitionIcon tType={((t.data ? t.data.tType : t.tType) || 'manual') as TransitionType} className="h-3.5 w-3.5" />
                                <span className="text-xs">{t.data ? t.data.name : t.name}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-6 px-2 text-xs"
                                onClick={async () => {
                                  if (settings.runMode === 'mockup') {
                                    const { nodes: newNodes } = fireTransition(t.id, nodes, edges)
                                    setNodes(newNodes)
                                  } else if (activeWorkflowId && settings.flowServiceUrl) {
                                    setMonitorLoading(true);
                                    try {
                                      await fireTransitionApi(settings.flowServiceUrl, activeWorkflowId, t.transitionId || t.id, 0);
                                      // Refresh marking and transitions
                                      const [marking, transitions] = await Promise.all([
                                        fetchMarking(settings.flowServiceUrl, activeWorkflowId),
                                        fetchTransitionsStatus(settings.flowServiceUrl, activeWorkflowId)
                                      ]);
                                      setServerMarking(marking);
                                      setServerTransitions(transitions.data || []);
                                    } finally {
                                      setMonitorLoading(false);
                                    }
                                  }
                                }}
                              >
                                Fire
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                    <section>
                      <div className="mb-2 text-xs font-semibold text-neutral-600">Tokens by Place</div>
                      <div className="grid gap-2">
                        {settings.runMode === 'mockup'
                          ? nodes.filter((n) => n.type === 'place').map((p) => (
                              <div key={p.id} className="flex items-center justify-between rounded-md bg-neutral-50 px-2 py-1.5">
                                <span className="text-xs">{(p.data as any).name}</span>
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <Coins className="h-3 w-3 text-amber-600" aria-hidden />
                                  {(p.data as any).tokens}
                                </Badge>
                              </div>
                            ))
                          : serverMarking && typeof serverMarking === 'object'
                          ? Object.entries(serverMarking).map(([place, tokens]: [string, unknown]) => {
                              const tokenArr = Array.isArray(tokens) ? (tokens as any[]) : [];
                              return (
                                <div key={place} className="rounded-md bg-neutral-50 px-2 py-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium">{place}</span>
                                    <Badge variant="outline" className="gap-1 text-xs">
                                      <Coins className="h-3 w-3 text-amber-600" aria-hidden />
                                      {tokenArr.length}
                                    </Badge>
                                  </div>
                                  {tokenArr.length > 0 && (
                                    <ul className="ml-2 mt-1 space-y-0.5">
                                      {tokenArr.map((tok, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-xs text-neutral-700">
                                          <span className="font-mono">{JSON.stringify(tok.value)}</span>
                                          <span className="text-[10px] text-neutral-400">{
                                            (() => {
                                              const d = new Date(tok.timestamp);
                                              const pad = (n: number) => n.toString().padStart(2, '0');
                                              return `${d.getFullYear().toString().slice(2)}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                                            })()
                                          }</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })
                          : <div className="text-xs text-neutral-500">No marking data</div>
                        }
                      </div>
                    </section>
                  </div>
                </ScrollArea>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" onClick={doAutoStep} disabled={monitorLoading}>
                    <Play className="mr-1.5 h-4 w-4" aria-hidden /> Step
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetTokens} disabled={settings.runMode !== 'mockup'}>
                    <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden /> Reset
                  </Button>
                </div>
              </div>
            )}
            {systemTab === 'settings' && <SystemSettingsTab />}
          </div>
        </div>
      )}

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

          {/* Custom controls: order + outline icons, offset when panel is normal */}
          <div
            style={{
              position: "absolute",
              right: controlsRight,
              bottom: 12,
              zIndex: 10,
              pointerEvents: "auto",
            }}
            aria-label="Canvas toolbar"
          >
            <Controls position="bottom-right" showZoom={false} showFitView={false} showInteractive={false}>
              {/* Save workflow button */}
              <ControlButton
                onClick={async () => {
                  if (!activeWorkflowId) return;
                  const url = settings.flowServiceUrl;
                  if (!url) {
                    alert('flowServiceUrl is not set in system settings.');
                    return;
                  }
                  // Get the workflow data as updateWorkflowFromGraph would
                  const workflowData = updateWorkflowFromGraph(activeWorkflowId, nodes as any, edges as any);
                  console.log('Saving workflow data:', workflowData);
                  try {
                    const resp = await fetch(`${url}/api/cpn/load`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(workflowData),
                    });
                    if (!resp.ok) {
                      const msg = await resp.text();
                      alert(`Save failed: ${resp.status} ${msg}`);
                      return;
                    }
                    setEditedMap((prev) => ({ ...prev, [activeWorkflowId]: false }));
                  } catch (err: any) {
                    alert('Save failed: ' + (err?.message || err));
                  }
                }}
                title={edited ? 'Save workflow' : 'No changes to save'}
                disabled={!edited}
                style={{ opacity: edited ? 1 : 0.5 }}
                aria-label="Save workflow"
              >
                <Save className="h-4 w-4" aria-hidden />
              </ControlButton>

              {/* Toggle interactivity */}
              <ControlButton
                onClick={() => setInteractive((v) => !v)}
                title={interactive ? "Disable interactivity" : "Enable interactivity"}
              >
                <MousePointer2 className={`h-4 w-4 ${interactive ? "" : "opacity-50"}`} aria-hidden />
              </ControlButton>

              {/* Preview */}
              <ControlButton
                onClick={() => {
                  setShowSystem((v) => !v)
                  if (!showSystem) setSystemTab('monitor')
                }}
                title={showSystem ? 'Hide System panel' : 'Show System panel'}
              >
                <Eye className="h-4 w-4" aria-hidden />
              </ControlButton>

              {/* Explorer (Folder) */}
              <ControlButton
                onClick={async () => {
                  if (panelMode === 'mini') setPanelMode('normal');
                  setLeftTab('explorer');
                  if (settings.runMode !== 'mockup' && !serverWorkflowsFetched) {
                    await fetchServerWorkflowList();
                  }
                }}
                title="Open Explorer"
              >
                <Folder className="h-4 w-4" aria-hidden />
              </ControlButton>

              {/* Zoom In/Out and Fit View */}
              <ControlButton onClick={() => zoomIn?.({ duration: 200 })} title="Zoom in" aria-label="Zoom in">
                <ZoomIn className="h-5 w-5" aria-hidden />
              </ControlButton>
              <ControlButton onClick={() => zoomOut?.({ duration: 200 })} title="Zoom out" aria-label="Zoom out">
                <ZoomOut className="h-5 w-5" aria-hidden />
              </ControlButton>
              <ControlButton onClick={() => fitView?.({ padding: 0.2, duration: 300 })} title="Fit view">
                <Maximize2 className="h-4 w-4" aria-hidden />
              </ControlButton>

              {/* Properties toggle (when mini) */}
              {panelMode === "mini" && (
                <ControlButton onClick={() => setPanelMode("normal")} title="Open Properties">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                </ControlButton>
              )}

              {/* Add nodes */}
              <ControlButton onClick={addPlace} title="Add Place">
                <CirclePlus className="h-4 w-4" aria-hidden />
              </ControlButton>
              <ControlButton onClick={addTransition} title="Add Transition">
                <SquarePlus className="h-4 w-4" aria-hidden />
              </ControlButton>
            </Controls>
          </div>
        </ReactFlow>



        {contextMenu.open && contextMenu.nodeId && (
          <div
            className="z-50 rounded-md border bg-white shadow-lg"
            style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, minWidth: 200 }}
            onClick={(e) => e.stopPropagation()}
            role="menu"
            aria-label="Transition context menu"
          >
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
            {(["manual", "auto", "dmn", "message", "llm"] as TransitionType[]).map((t) => (
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
          </div>
        )}
      </div>

      <SidePanel
        open={panelMode !== "mini"}
        mode={panelMode}
        width={panelWidth}
        onResizeStart={() => setResizing(true)}
        selected={selected}
        onUpdateNode={updateNode}
        onUpdateEdge={updateEdge}
        onModeChange={setPanelMode}
        tokensOpenForPlaceId={tokensOpenForPlaceId || undefined}
        guardOpenForTransitionId={guardOpenForTransitionId || undefined}
        tab={leftTab}
        setTab={setLeftTab}
        explorerWorkflows={settings.runMode === 'mockup' ? undefined : serverWorkflows}
        onExplorerSelect={onExplorerSelect}
      />
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
                  {!(k === 'flowServiceUrl' || k === 'dictionaryUrl' || k === 'runMode') && (
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

function TransitionIcon({
  tType,
  className = "h-4 w-4",
}: {
  tType: TransitionType
  className?: string
}) {
  switch (tType) {
    case "manual":
      return <Hand className={className} aria-label="manual" />
    case "auto":
      return <Bot className={className} aria-label="auto" />
    case "message":
      return <MessageSquare className={className} aria-label="message" />
    case "dmn":
      return <TableProperties className={className} aria-label="DMN" />
    case "llm":
      return <Brain className={className} aria-label="LLM" />
    default:
      return <Activity className={className} aria-label="transition" />
  }
}
