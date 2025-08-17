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
  if (!resp.ok) {
    let bodyText = ''
    let parsed: any = null
    try { bodyText = await resp.text() } catch { /* ignore */ }
    if (bodyText) { try { parsed = JSON.parse(bodyText) } catch { /* ignore */ } }
    const err = new ApiError('Fire transition failed', {
      status: resp.status,
      rawBody: bodyText,
      errorCode: parsed?.error,
      serverMessage: parsed?.message || parsed?.error || bodyText || `HTTP ${resp.status}`,
      context: 'fireTransition',
    })
    throw err
  }
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
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await fetch(`${base}/api/cpn/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflowData),
  });
  if (!resp.ok) {
    let bodyText = ''
    let parsed: any = null
    try { bodyText = await resp.text() } catch { /* ignore */ }
    if (bodyText) { try { parsed = JSON.parse(bodyText) } catch { /* ignore */ } }
    const err = new ApiError('Save failed', {
      status: resp.status,
      rawBody: bodyText,
      errorCode: parsed?.error,
      serverMessage: parsed?.message || parsed?.error || bodyText || `HTTP ${resp.status}`,
      context: 'saveWorkflow',
    })
    throw err
  }
  return resp.json();
}

// Create a new (empty) workflow on the server
export async function createWorkflow(flowServiceUrl: string, payload: { id?: string; name: string }) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await fetch(`${base}/api/cpn/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) throw new Error(`Failed to create workflow: ${resp.status}`)
  return resp.json()
}

// Delete a workflow
export async function deleteWorkflowApi(flowServiceUrl: string, id: string) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await fetch(`${base}/api/cpn/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!resp.ok) throw new Error(`Failed to delete workflow: ${resp.status}`)
  return resp.json()
}

// Update color sets
export async function updateColorSets(flowServiceUrl: string, id: string, colorSets: string[]) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await fetch(`${base}/api/cpn/colorsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, colorSets }),
  })
  if (!resp.ok) throw new Error(`Failed to update colorSets: ${resp.status}`)
  return resp.json()
}

// Validate a workflow; expected response: { data: { violations: [...] }} or { violations: [...] }
export async function validateWorkflow(flowServiceUrl: string, workflowId: string) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await fetch(`${base}/api/cpn/validate?id=${encodeURIComponent(workflowId)}`)
  if (!resp.ok) {
    let body = ''
    try { body = await resp.text() } catch {}
    throw new ApiError('Validation failed', { status: resp.status, rawBody: body, context: 'validateWorkflow' })
  }
  const json = await resp.json().catch(() => ({}))
  // Normalize shape
  const violations = json?.data?.violations || json?.violations || []
  return { raw: json, violations }
}

// Helper to run an API call and surface any thrown error via toast; rethrows after showing
export class ApiError extends Error {
  status?: number
  errorCode?: string
  serverMessage?: string
  rawBody?: string
  context?: string
  constructor(message: string, opts: { status?: number; errorCode?: string; serverMessage?: string; rawBody?: string; context?: string } = {}) {
    super(message)
    this.name = 'ApiError'
    Object.assign(this, opts)
  }
}

export async function withApiErrorToast<T>(promise: Promise<T>, toastFn?: (opts: { title: string; description?: string; variant?: 'default' | 'destructive' | null }) => void, action?: string): Promise<T> {
  try {
    return await promise
  } catch (e: any) {
    if (toastFn) {
      let title = action ? `${action} failed` : 'Request failed'
      let description: string | undefined
      if (e instanceof ApiError) {
        const parts = [] as string[]
        if (e.status) parts.push(`HTTP ${e.status}`)
        if (e.errorCode) parts.push(e.errorCode)
        if (e.serverMessage) parts.push(e.serverMessage)
        description = parts.join(' · ')
      } else {
        description = e?.message || String(e)
      }
      if (!description || description.trim() === '') description = 'Unknown error'
      toastFn({ title, description, variant: 'destructive' })
    }
    throw e
  }
}
