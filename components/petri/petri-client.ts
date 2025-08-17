// Get current marking for a workflow
export async function fetchMarking(flowServiceUrl: string, workflowId: string) {
  const resp = await fetch(`${flowServiceUrl}/api/marking/get?id=${encodeURIComponent(workflowId)}`)
  if (!resp.ok) throw new Error(`Failed to fetch marking: ${resp.status}`)
  const json = await resp.json()
  // Expected shape: { data: { places: { [placeName]: Token[] } } }
  if (json && typeof json === 'object') {
    if (json.data && typeof json.data === 'object') {
      if (json.data.places && typeof json.data.places === 'object') return json.data.places
    }
    // fallback if server sends places at top-level
    if (json.places && typeof json.places === 'object') return json.places
  }
  return json
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
// Reset workflow to its initial marking
export async function resetWorkflow(flowServiceUrl: string, workflowId: string) {
  const resp = await fetch(`${flowServiceUrl}/api/cpn/reset?id=${encodeURIComponent(workflowId)}`, { method: 'POST' });
  if (!resp.ok) throw new Error(`Failed to reset workflow: ${resp.status}`);
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

// Create a new (empty) workflow on the server
export async function createWorkflow(flowServiceUrl: string, payload: { id?: string; name: string }) {
  const resp = await fetch(`${flowServiceUrl}/api/cpn/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) throw new Error(`Failed to create workflow: ${resp.status}`)
  return resp.json()
}

// Delete a workflow
export async function deleteWorkflowApi(flowServiceUrl: string, id: string) {
  const resp = await fetch(`${flowServiceUrl}/api/cpn/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!resp.ok) throw new Error(`Failed to delete workflow: ${resp.status}`)
  return resp.json()
}

// Update color sets
export async function updateColorSets(flowServiceUrl: string, id: string, colorSets: string[]) {
  const resp = await fetch(`${flowServiceUrl}/api/cpn/colorsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, colorSets }),
  })
  if (!resp.ok) throw new Error(`Failed to update colorSets: ${resp.status}`)
  return resp.json()
}

// Helper to run an API call and surface any thrown error via toast; rethrows after showing
export async function withApiErrorToast<T>(promise: Promise<T>, toastFn?: (opts: { title: string; description?: string; variant?: 'default' | 'destructive' | null }) => void, action?: string): Promise<T> {
  try {
    return await promise
  } catch (e: any) {
    if (toastFn) {
      toastFn({ title: action ? `${action} failed` : 'Request failed', description: e?.message || String(e), variant: 'destructive' })
    }
    throw e
  }
}
