// Mock workflow store for Explorer side panel
// Each workflow has: id, name, places, transitions, arcs, subWorkflows

export type Position = { x: number; y: number };
export type Place = { id: string; name: string, colorSet: string, position: Position };
export type Arc = { id: string; sourceId: string; targetId: string, expression: string, direction: 'IN' | 'OUT'};
export type Transition = { id: string; name: string; type?: 'normal' | 'workflow'; 
  workflowRef?: string, guardExpression?: string, variables?: string[],
  transitionDelay?: number, position: Position
 };
export type Marking = { value: object, timestamp: number }
import type { Edge, Node } from "@xyflow/react";
import type { PetriEdgeData, PetriNodeData } from "@/lib/petri-sim";

export type Workflow = {
  id: string;
  name: string;
  description: string;
  colorSets: string[];
  places: Place[];
  transitions: Transition[];
  arcs: Arc[];
  endPlaces: string[];
  initialMarking: Record<string, Marking[]>;
  subWorkflows: string[]; // references to other workflow ids
  graph?: { nodes: Node<PetriNodeData>[]; edges: Edge<PetriEdgeData>[] };
};

// --- Internal helpers for positioning newly created nodes when added via Explorer ---
function genPosition(kind: 'place' | 'transition'): { x: number; y: number } {
  // Simple scatter layout: places upper band, transitions lower band
  const x = 80 + Math.random() * 640;
  const y = kind === 'place' ? 120 + Math.random() * 160 : 360 + Math.random() * 160;
  return { x, y };
}

function ensureGraph(w: Workflow) {
  if (!w.graph) w.graph = { nodes: [], edges: [] };
}

// Keep graph nodes/edges in sync with list-based primitives after Explorer mutations
export function syncListsIntoGraph(w: Workflow) {
  ensureGraph(w);
  const nodeMap: Record<string, Node<PetriNodeData>> = {};
  // Existing nodes retained for position if still present
  w.graph!.nodes.forEach(n => { nodeMap[n.id] = n; });

  const nextNodes: Node<PetriNodeData>[] = [];
  w.places.forEach(p => {
    const existing = nodeMap[p.id];
    if (existing && existing.type === 'place') {
      nextNodes.push({ ...existing, data: { ...(existing.data as any), name: p.name } });
    } else {
      nextNodes.push({ id: p.id, type: 'place', position: p.position || genPosition('place'), data: { kind: 'place', name: p.name, colorSet: p.colorSet, tokens: 0, tokenList: [] } });
    }
  });
  w.transitions.forEach(t => {
    const existing = nodeMap[t.id];
    if (existing && existing.type === 'transition') {
      nextNodes.push({ ...existing, data: { ...(existing.data as any), name: t.name } });
    } else {
      nextNodes.push({ id: t.id, type: 'transition', position: t.position || genPosition('transition'), data: { kind: 'transition', name: t.name, tType: 'manual', manual: { assignee: '', formSchemaId: '' }, guard: '' } });
    }
  });

  // Rebuild edges from arcs referencing existing node ids
  const nextEdges: Edge<PetriEdgeData>[] = [];
  w.arcs.forEach(a => {
    if (nextNodes.find(n => n.id === a.sourceId) && nextNodes.find(n => n.id === a.targetId)) {
      // Reuse existing edge if id matches
      const existing = w.graph!.edges.find(e => e.id === a.id);
      nextEdges.push(existing ? { ...existing } : { id: a.id, source: a.sourceId, target: a.targetId, type: 'labeled', data: { label: 'arc' } });
    }
  });

  w.graph = { nodes: nextNodes, edges: nextEdges };
  return w
}

// Public API for Canvas -> Store sync (does NOT emit events to avoid feedback loops)
export function updateWorkflowFromGraph(id: string, nodes: Node<PetriNodeData>[], edges: Edge<PetriEdgeData>[]) {
  const w = workflows[id];
  if (!w) return;
  w.graph = { nodes: [...nodes], edges: [...edges] };
  // Derive primitive lists from nodes/edges
  w.places = nodes.filter(n => n.type === 'place').map(n => ({
    id: n.id,
    name: (n.data as any)?.name || n.id,
    colorSet: (n.data as any)?.colorSet || '',
    position: n.position as Position
  }));
  w.transitions = nodes.filter(n => n.type === 'transition').map(n => ({
    id: n.id,
    name: (n.data as any)?.name || n.id,
    position: n.position as Position,
    type: ((n.data as any)?.tType === 'workflow' ? 'workflow' : 'normal'),
    workflowRef: (n.data as any)?.workflowRef,
    guardExpression: (n.data as any)?.guard,
    variables: (n.data as any)?.variables,
    transitionDelay: (n.data as any)?.time?.delaySec
  }));
  w.arcs = edges.map(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    const targetNode = nodes.find(n => n.id === e.target);
    let direction: 'IN' | 'OUT' = 'IN';
    if (sourceNode && targetNode) {
      if (sourceNode.type === 'place' && targetNode.type === 'transition') {
        direction = 'IN';
      } else if (sourceNode.type === 'transition' && targetNode.type === 'place') {
        direction = 'OUT';
      }
    }
    return {
      id: e.id,
      sourceId: e.source,
      targetId: e.target,
      expression: (e.data as any)?.expression || '',
      direction
    };
  });
  // Generate initialMarking from tokenList for places with tokens
  const marking: Record<string, { value: any; timestamp: number }[]> = {};
  nodes.filter(n => n.type === 'place').forEach(n => {
    const name = (n.data as any)?.name || n.id;
    const tokenList = (n.data as any)?.tokenList;
    if (Array.isArray(tokenList) && tokenList.length > 0) {
      marking[name] = tokenList.map((tok: any) => ({
        value: tok.data,
        timestamp: typeof tok.createdAt === 'number' ? tok.createdAt : 0
      }));
    }
  });
  w.initialMarking = marking;
  return w
}

function emitChanged(workflowId: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workflowStoreChanged', { detail: { workflowId } }));
  }
}

// Example mock data
export const workflows: Record<string, Workflow> = {
  'sample': {
    id: 'sample',
    name: 'Sample Petri Net',
    description: 'A sample workflow',
    colorSets: [],
    places: [],
    transitions: [],
    arcs: [],
    endPlaces: [],
  initialMarking: {},
    subWorkflows: [],
    graph: {
      nodes: [
        {
          id: "p-start",
          type: "place",
          position: { x: 80, y: 160 },          
          data: {
            kind: "place",
            name: "Start",
            colorSet: 'INT',
            isStart: true,
            tokens: 1,
            tokenList: [{ id: "tok-aaaaaa", data: 1, createdAt: Date.now() }],
          },
        },
        {
          id: "t-approve",
          type: "transition",
          position: { x: 300, y: 148 },
          data: {
            kind: "transition",
            name: "Approve",
            tType: "manual",
            manual: { assignee: "lee", formSchemaId: "" },
            guard: "if a>3 then true",
            time: { delaySec: 4}
          },
        },
        {
          id: "p-review",
          type: "place",
          position: { x: 540, y: 90 },
          data: { kind: "place", name: "Under Review", colorSet: 'INT', tokens: 0, tokenList: [] },
        },
        {
          id: "p-done",
          type: "place",
          position: { x: 540, y: 210 },
          data: { kind: "place", name: "Done", tokens: 0, colorSet: 'INT',tokenList: [] },
        },
        {
          id: "t-auto-archive",
          type: "transition",
          position: { x: 760, y: 90 },
          data: { kind: "transition", name: "Auto Archive", tType: "auto", auto: { script: "val x" }, guard: "" },
        },
        {
          id: "p-archived",
          type: "place",
          position: { x: 980, y: 90 },
          data: { kind: "place", name: "Archived",colorSet: 'INT', tokens: 0, tokenList: [] },
        },
        // New sample DMN transition
        {
          id: "t-decision",
          type: "transition",
          position: { x: 760, y: 210 },
          data: {
            kind: "transition",
            name: "Decision Eval",
            tType: "dmn",
            dmnDefinition: { name: "SampleDecision", inputs: [], rules: [] },
            guard: "",
          },
        },
        {
          id: "p-decision-out",
          type: "place",
          position: { x: 980, y: 210 },
          data: { kind: "place", name: "Decision Out", colorSet: 'INT', tokens: 0, tokenList: [] },
        },
        // New sample Message transition
        {
          id: "t-notify",
          type: "transition",
          position: { x: 1200, y: 210 },
          data: {
            kind: "transition",
            name: "Notify",
            tType: "message",
            message: { channel: "email" },
            guard: "",
          },
        },
        {
          id: "p-msg-out",
          type: "place",
          position: { x: 1420, y: 210 },
          data: { kind: "place", name: "Msg Out", colorSet: 'INT', tokens: 0, tokenList: [] },
        },
        // New sample LLM transition
        {
          id: "t-llm-sum",
          type: "transition",
          position: { x: 1640, y: 210 },
          data: {
            kind: "transition",
            name: "AI Summarize",
            tType: "llm",
            llm: { system: "You are a summarizer", user: "Summarize invoice data", jsonOutput: false },
            guard: "",
          },
        },
        {
          id: "p-ai-out",
          type: "place",
          position: { x: 1860, y: 210 },
          data: { kind: "place", name: "AI Out", colorSet: 'INT', isEnd:true, tokens: 0, tokenList: [] },
        },
      ],
      edges: [
        { id: "e1", source: "p-start", target: "t-approve", type: "labeled", data: { label: "submit" } },
        { id: "e2", source: "t-approve", target: "p-review", type: "labeled", data: { label: "approved" } },
        { id: "e3", source: "t-approve", target: "p-done", type: "labeled", data: { label: "fast-track" } },
        { id: "e4", source: "p-review", target: "t-auto-archive", type: "labeled", data: { label: "reviewed" } },
        { id: "e5", source: "t-auto-archive", target: "p-archived", type: "labeled", data: { label: "archived" } },
        { id: "e6", source: "p-review", target: "t-decision", type: "labeled", data: { label: "decide" } },
        { id: "e7", source: "t-decision", target: "p-decision-out", type: "labeled", data: { label: "out" } },
        { id: "e8", source: "p-decision-out", target: "t-notify", type: "labeled", data: { label: "notify" } },
        { id: "e9", source: "t-notify", target: "p-msg-out", type: "labeled", data: { label: "sent" } },
        { id: "e10", source: "p-msg-out", target: "t-llm-sum", type: "labeled", data: { label: "summarize" } },
        { id: "e11", source: "t-llm-sum", target: "p-ai-out", type: "labeled", data: { label: "ai-out" } },
      ],
    },
  },
};

export function getWorkflow(id: string): Workflow | undefined {
  return workflows[id];
}

export function getWorkflowGraph(id: string): { nodes: Node<PetriNodeData>[]; edges: Edge<PetriEdgeData>[] } | undefined {
  const wf = workflows[id];
  return wf?.graph;
}

// --- Mutation helpers for Explorer ---
const rid = (p = "id") => `${p}-${Math.random().toString(36).slice(2, 8)}`

export function addWorkflow(parentId?: string): string {
  const id = rid('wf')
  workflows[id] = {
    id,
    name: `Workflow ${id.slice(-4)}`,
    description: '',
    colorSets: [],
    places: [],
    transitions: [],
    arcs: [],
    endPlaces: [],
  initialMarking: {},
    subWorkflows: []
  }
  if (parentId && workflows[parentId]) {
    workflows[parentId].subWorkflows.push(id)
  }
  emitChanged(id)
  return id
}

export function deleteWorkflow(id: string): void {
  // Remove reference from any parent
  Object.values(workflows).forEach(w => {
    w.subWorkflows = w.subWorkflows.filter(x => x !== id)
  })
  delete workflows[id]
  emitChanged(id)
}

export function addPlace(wfId: string, name?: string, colorSet: string = ''): string | null {
  const w = workflows[wfId]
  if (!w) return null
  const id = rid('p')
  w.places.push({ id, name: name ?? `Place ${id.slice(-4)}`, colorSet })
  syncListsIntoGraph(w)
  emitChanged(wfId)
  return id
}

export function addTransition(wfId: string, name?: string, type: 'normal' | 'workflow' = 'normal', workflowRef?: string, guardExpression?: string, variables?: string[], transitionDelay?: number): string | null {
  const w = workflows[wfId]
  if (!w) return null
  const id = rid('t')
  w.transitions.push({ id, name: name ?? `Transition ${id.slice(-4)}`, type, workflowRef, guardExpression, variables, transitionDelay })
  syncListsIntoGraph(w)
  emitChanged(wfId)
  return id
}

export function addArc(wfId: string, sourceId = 'from', targetId = 'to', expression = '', direction: 'IN' | 'OUT' = 'IN'): string | null {
  const w = workflows[wfId]
  if (!w) return null
  // Attempt to auto-pick sensible endpoints if defaults passed
  if (sourceId === 'from' || targetId === 'to') {
    const place = w.places[0];
    const transition = w.transitions[0];
    if (place && transition) {
      sourceId = place.id;
      targetId = transition.id;
    }
  }
  const id = rid('e') // reuse 'e' prefix to align with edge ids
  w.arcs.push({ id, sourceId, targetId, expression, direction })
  syncListsIntoGraph(w)
  emitChanged(wfId)
  return id
}

export function deletePlace(wfId: string, placeId: string) {
  const w = workflows[wfId]
  if (!w) return
  w.places = w.places.filter(p => p.id !== placeId)
  // Remove arcs referencing this place
  w.arcs = w.arcs.filter(a => a.sourceId !== placeId && a.targetId !== placeId)
  syncListsIntoGraph(w)
  emitChanged(wfId)
}

export function deleteTransition(wfId: string, tId: string) {
  const w = workflows[wfId]
  if (!w) return
  w.transitions = w.transitions.filter(t => t.id !== tId)
  // Remove arcs referencing this transition
  w.arcs = w.arcs.filter(a => a.sourceId !== tId && a.targetId !== tId)
  syncListsIntoGraph(w)
  emitChanged(wfId)
}

export function deleteArc(wfId: string, arcId: string) {
  const w = workflows[wfId]
  if (!w) return
  w.arcs = w.arcs.filter(a => a.id !== arcId)
  syncListsIntoGraph(w)
  emitChanged(wfId)
}

// Rename helpers
export function renameWorkflow(id: string, name: string) {
  const w = workflows[id]
  if (!w) return
  w.name = name
  emitChanged(id)
}

export function renamePlace(wfId: string, placeId: string, name: string) {
  const w = workflows[wfId]
  if (!w) return
  const p = w.places.find(p => p.id === placeId)
  if (p) p.name = name
  syncListsIntoGraph(w)
  emitChanged(wfId)
}

export function renameTransition(wfId: string, tId: string, name: string) {
  const w = workflows[wfId]
  if (!w) return
  const t = w.transitions.find(t => t.id === tId)
  if (t) t.name = name
  syncListsIntoGraph(w)
  emitChanged(wfId)
}
