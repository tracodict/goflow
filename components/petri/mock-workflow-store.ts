// Mock workflow store for Explorer side panel
// Each workflow has: id, name, places, transitions, arcs, subWorkflows

export type Place = { id: string; name: string };
export type Arc = { id: string; from: string; to: string };
export type Transition = { id: string; name: string; type?: 'normal' | 'workflow'; workflowRef?: string };
import type { Edge, Node } from "@xyflow/react";
import type { PetriEdgeData, PetriNodeData } from "@/lib/petri-sim";

export type Workflow = {
  id: string;
  name: string;
  places: Place[];
  transitions: Transition[];
  arcs: Arc[];
  subWorkflows: string[]; // references to other workflow ids
  graph?: { nodes: Node<PetriNodeData>[]; edges: Edge<PetriEdgeData>[] };
};

// Example mock data
export const workflows: Record<string, Workflow> = {
  'sample': {
    id: 'sample',
    name: 'Sample Petri Net',
    places: [],
    transitions: [],
    arcs: [],
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
            tokens: 1,
            tokenList: [{ id: "tok-aaaaaa", data: { docId: "INV-1001", amount: 250 }, createdAt: Date.now() }],
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
            manual: { assignee: "", formSchemaId: "" },
            inscription: "",
          },
        },
        {
          id: "p-review",
          type: "place",
          position: { x: 540, y: 90 },
          data: { kind: "place", name: "Under Review", tokens: 0, tokenList: [] },
        },
        {
          id: "p-done",
          type: "place",
          position: { x: 540, y: 210 },
          data: { kind: "place", name: "Done", tokens: 0, tokenList: [] },
        },
        {
          id: "t-auto-archive",
          type: "transition",
          position: { x: 760, y: 90 },
          data: { kind: "transition", name: "Auto Archive", tType: "auto", auto: { script: "" }, inscription: "" },
        },
        {
          id: "p-archived",
          type: "place",
          position: { x: 980, y: 90 },
          data: { kind: "place", name: "Archived", tokens: 0, tokenList: [] },
        },
      ],
      edges: [
        { id: "e1", source: "p-start", target: "t-approve", type: "labeled", data: { label: "submit" } },
        { id: "e2", source: "t-approve", target: "p-review", type: "labeled", data: { label: "approved" } },
        { id: "e3", source: "t-approve", target: "p-done", type: "labeled", data: { label: "fast-track" } },
        { id: "e4", source: "p-review", target: "t-auto-archive", type: "labeled", data: { label: "reviewed" } },
        { id: "e5", source: "t-auto-archive", target: "p-archived", type: "labeled", data: { label: "archived" } },
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
  workflows[id] = { id, name: `Workflow ${id.slice(-4)}`, places: [], transitions: [], arcs: [], subWorkflows: [] }
  if (parentId && workflows[parentId]) {
    workflows[parentId].subWorkflows.push(id)
  }
  return id
}

export function deleteWorkflow(id: string): void {
  // Remove reference from any parent
  Object.values(workflows).forEach(w => {
    w.subWorkflows = w.subWorkflows.filter(x => x !== id)
  })
  delete workflows[id]
}

export function addPlace(wfId: string, name?: string): string | null {
  const w = workflows[wfId]
  if (!w) return null
  const id = rid('p')
  w.places.push({ id, name: name ?? `Place ${id.slice(-4)}` })
  return id
}

export function addTransition(wfId: string, name?: string): string | null {
  const w = workflows[wfId]
  if (!w) return null
  const id = rid('t')
  w.transitions.push({ id, name: name ?? `Transition ${id.slice(-4)}`, type: 'normal' })
  return id
}

export function addArc(wfId: string, from = 'from', to = 'to'): string | null {
  const w = workflows[wfId]
  if (!w) return null
  const id = rid('a')
  w.arcs.push({ id, from, to })
  return id
}

export function deletePlace(wfId: string, placeId: string) {
  const w = workflows[wfId]
  if (!w) return
  w.places = w.places.filter(p => p.id !== placeId)
}

export function deleteTransition(wfId: string, tId: string) {
  const w = workflows[wfId]
  if (!w) return
  w.transitions = w.transitions.filter(t => t.id !== tId)
}

export function deleteArc(wfId: string, arcId: string) {
  const w = workflows[wfId]
  if (!w) return
  w.arcs = w.arcs.filter(a => a.id !== arcId)
}

// Rename helpers
export function renameWorkflow(id: string, name: string) {
  const w = workflows[id]
  if (!w) return
  w.name = name
}

export function renamePlace(wfId: string, placeId: string, name: string) {
  const w = workflows[wfId]
  if (!w) return
  const p = w.places.find(p => p.id === placeId)
  if (p) p.name = name
}

export function renameTransition(wfId: string, tId: string, name: string) {
  const w = workflows[wfId]
  if (!w) return
  const t = w.transitions.find(t => t.id === tId)
  if (t) t.name = name
}
