// Get current marking for a workflow
export async function fetchMarking(flowServiceUrl: string, workflowId: string) {
  const resp = await fetch(`${flowServiceUrl}/api/marking/get?id=${encodeURIComponent(workflowId)}`);
  if (!resp.ok) throw new Error(`Failed to fetch marking: ${resp.status}`);
  return resp.json();
}

// Get all transitions' enabled/disabled status
export async function fetchTransitionsStatus(flowServiceUrl: string, workflowId: string) {
  const resp = await fetch(`${flowServiceUrl}/api/transitions/list?id=${encodeURIComponent(workflowId)}`);
  if (!resp.ok) throw new Error(`Failed to fetch transitions status: ${resp.status}`);
  return resp.json();
}

// Fire an enabled transition
export async function fireTransition(flowServiceUrl: string, workflowId: string, transitionId: string, bindingIndex: number = 0) {
  const resp = await fetch(`${flowServiceUrl}/api/transitions/fire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpnId: workflowId, transitionId, bindingIndex }),
  });
  if (!resp.ok) throw new Error(`Failed to fire transition: ${resp.status}`);
  return resp.json();
}

// Proceed one simulation step
export async function simulationStep(flowServiceUrl: string, workflowId: string) {
  const resp = await fetch(`${flowServiceUrl}/api/simulation/step?id=${encodeURIComponent(workflowId)}`, {
    method: 'POST',
  });
  if (!resp.ok) throw new Error(`Failed to step simulation: ${resp.status}`);
  return resp.json();
}
// petriClient.ts
// HTTP client for Petri net workflow API

export async function fetchWorkflowList(flowServiceUrl: string) {
  const resp = await fetch(`${flowServiceUrl}/api/cpn/list`);
  if (!resp.ok) throw new Error(`Failed to fetch workflow list: ${resp.status}`);
  return resp.json();
}

export async function fetchWorkflow(flowServiceUrl: string, id: string) {
  const resp = await fetch(`${flowServiceUrl}/api/cpn/get?id=${encodeURIComponent(id)}`);
  if (!resp.ok) throw new Error(`Failed to fetch workflow: ${resp.status}`);
  return resp.json();
}

export async function saveWorkflow(flowServiceUrl: string, workflowData: any) {
  const resp = await fetch(`${flowServiceUrl}/api/cpn/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflowData),
  });
  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`Save failed: ${resp.status} ${msg}`);
  }
  return resp.json();
}
