// Header used to tell the workspace flow proxy which upstream base URL to target.
const FLOW_UPSTREAM_HEADER = 'x-goflow-upstream-base'
const SETTINGS_STORAGE_KEY = 'goflow.systemSettings'

function normalizeBaseUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (!parsed.protocol || !/^https?:$/.test(parsed.protocol)) {
      return null
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/u, '')
    return parsed.toString().replace(/\/+$/u, '')
  } catch {
    return null
  }
}

function resolveConfiguredFlowBase(): string | null {
  if (typeof window !== 'undefined') {
    const globalUpstream = normalizeBaseUrl((window as any)?.__goflowUpstreamBase)
    if (globalUpstream) return globalUpstream

    try {
      const raw = window.localStorage?.getItem?.(SETTINGS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed.flowServiceUrl === 'string') {
          const normalized = normalizeBaseUrl(parsed.flowServiceUrl)
          if (normalized) return normalized
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Final fallback to environment defaults when running in non-browser contexts.
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_FLOW_SERVICE_URL || process.env.FLOW_SERVICE_URL)
}

function isWorkspaceProxyUrl(target: string | URL): boolean {
  let url: URL
  if (typeof target === 'string') {
    try {
      url = target.startsWith('http') ? new URL(target) : new URL(target, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    } catch {
      return false
    }
  } else {
    url = target
  }
  return url.pathname.startsWith('/api/ws/')
}

// Internal helper to always include credentials (lz_sess cookie) for cross-subdomain calls
async function authFetch(input: string, init: RequestInit = {}) {
  const requestInit: RequestInit = { ...init }

  // Force credentials include to maintain auth cookies when calling Flow service.
  requestInit.credentials = 'include'

  const isProxyCall = typeof input === 'string' && isWorkspaceProxyUrl(input)
  if (isProxyCall) {
    const upstreamBase = resolveConfiguredFlowBase()
    if (upstreamBase) {
      const headers = new Headers(requestInit.headers as HeadersInit | undefined)
      headers.set(FLOW_UPSTREAM_HEADER, upstreamBase)
      requestInit.headers = headers
    }
  }

  return fetch(input, requestInit)
}

// Get current marking for a workflow
export async function fetchMarking(flowServiceUrl: string, workflowId: string) {
  const resp = await authFetch(`${flowServiceUrl}/api/marking/get?id=${encodeURIComponent(workflowId)}`)
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
  // New endpoint returns only enabled transitions: { success: boolean, data: Transition[] }
  const resp = await authFetch(`${flowServiceUrl}/api/transitions/enabled?id=${encodeURIComponent(workflowId)}`)
  if (!resp.ok) throw new Error(`Failed to fetch enabled transitions: ${resp.status}`)
  return resp.json()
}

// Fire an enabled transition
export async function fireTransition(flowServiceUrl: string, workflowId: string, transitionId: string, bindingIndex: number = 0, formData?: any) {
  const resp = await authFetch(`${flowServiceUrl}/api/transitions/fire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cpnId: workflowId, transitionId, bindingIndex, ...(formData !== undefined ? { formData } : {}) }),
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
  const resp = await authFetch(`${flowServiceUrl}/api/simulation/step?id=${encodeURIComponent(workflowId)}`, {
    method: 'POST',
  });
  if (!resp.ok) throw new Error(`Failed to step simulation: ${resp.status}`);
  return resp.json();
}
// Proceed multiple simulation steps
export async function simulationSteps(flowServiceUrl: string, workflowId: string, steps: number) {
  const safe = Math.max(1, Math.min(steps || 1, 1000))
  const resp = await authFetch(`${flowServiceUrl}/api/simulation/steps?id=${encodeURIComponent(workflowId)}&steps=${safe}`, {
    method: 'POST',
  })
  if (!resp.ok) throw new Error(`Failed to fast-forward simulation: ${resp.status}`)
  return resp.json()
}
// Reset workflow to its initial marking
export async function resetWorkflow(flowServiceUrl: string, workflowId: string) {
  const resp = await authFetch(`${flowServiceUrl}/api/cpn/reset?id=${encodeURIComponent(workflowId)}`, { method: 'POST' });
  if (!resp.ok) throw new Error(`Failed to reset workflow: ${resp.status}`);
  return resp.json();
}
// petriClient.ts
// HTTP client for Petri net workflow API

export async function fetchWorkflowList(flowServiceUrl: string) {
  const resp = await authFetch(`${flowServiceUrl}/api/cpn/list`);
  if (!resp.ok) throw new Error(`Failed to fetch workflow list: ${resp.status}`);
  return resp.json();
}

export async function fetchWorkflow(flowServiceUrl: string, id: string) {
  const resp = await authFetch(`${flowServiceUrl}/api/cpn/get?id=${encodeURIComponent(id)}`);
  if (!resp.ok) throw new Error(`Failed to fetch workflow: ${resp.status}`);
  return resp.json();
}

export async function saveWorkflow(flowServiceUrl: string, workflowData: any) {
  const base = flowServiceUrl.replace(/\/$/, '')
  // Debug: log incoming URL and composed base to help diagnose missing port issues
  try {
    // eslint-disable-next-line no-console
    console.debug('[petri-client] saveWorkflow called', { flowServiceUrl, base, stack: (new Error()).stack })
  } catch (e) {
    // ignore
  }
  // Strip CDN-backed jsonSchema bodies to keep payload lean. Retain only { name } for schemas
  // whose $id (or inferred path) matches the configured dictionaryUrl. Allow opt-out with _local flag.
  let payload = workflowData
  try {
    if (workflowData && Array.isArray(workflowData.jsonSchemas)) {
      // Determine dictionaryUrl from localStorage (system settings) or fallback constant.
      const LS_KEY = 'goflow.systemSettings'
      const FALLBACK_DICTIONARY = 'https://cdn.statically.io/gh/tracodict/jschema/main/ep299/'
      let dictionaryUrl = FALLBACK_DICTIONARY
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(LS_KEY)
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed.dictionaryUrl === 'string' && parsed.dictionaryUrl.trim()) {
              dictionaryUrl = parsed.dictionaryUrl
            }
          }
        } catch { /* ignore */ }
      }
      const root = (dictionaryUrl || '').replace(/\/+$/, '')
      const seen = new Set<string>()
      payload = { ...workflowData, jsonSchemas: workflowData.jsonSchemas
        .map((js: any) => {
          if (!js || typeof js !== 'object') return null
          const name = js.name
          if (!name || typeof name !== 'string') return null
          if (seen.has(name)) return null // drop duplicates silently (keep first)
          seen.add(name)
          const schema = js.schema
          // Heuristic: treat as CDN-backed if schema exists and either:
          // 1. schema.$id starts with dictionary root OR contains '/{firstLetter}/{name}.schema'
          // 2. schema has marker _cdn === true
          // Skip stripping if schema._local === true (user edited / custom)
          let isCdn = false
          if (schema && typeof schema === 'object') {
            const first = name[0]?.toLowerCase() || ''
            const pattern = `/${first}/${name}.schema`
            if ((schema as any)._local) {
              isCdn = false
            } else if ((schema as any)._cdn === true) {
              isCdn = true
            } else if (typeof (schema as any).$id === 'string') {
              const id: string = (schema as any).$id
              if (id.startsWith(root)) isCdn = true
              else if (id.includes(pattern)) isCdn = true
            }
          }
          if (isCdn) return { name }
          return { name, schema }
        })
        .filter(Boolean) }
    }
  } catch { /* non-fatal sanitization issues ignored */ }
  const resp = await authFetch(`${flowServiceUrl}/api/cpn/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  const resp = await authFetch(`${flowServiceUrl}/api/cpn/create`, {
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
  const resp = await authFetch(`${flowServiceUrl}/api/cpn/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!resp.ok) throw new Error(`Failed to delete workflow: ${resp.status}`)
  return resp.json()
}

// Update color sets
export async function updateColorSets(flowServiceUrl: string, id: string, colorSets: string[]) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await authFetch(`${flowServiceUrl}/api/cpn/colorsets`, {
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
  const resp = await authFetch(`${flowServiceUrl}/api/cpn/validate?id=${encodeURIComponent(workflowId)}`)
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

// ---- Case-based API helpers ----
export async function createCase(flowServiceUrl: string, payload: { id?: string; cpnId: string; name?: string; description?: string; variables?: Record<string,any> }) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await authFetch(`${flowServiceUrl}/api/cases/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  })
  if (!resp.ok) throw new Error(`Failed to create case: ${resp.status}`)
  return resp.json()
}
export async function startCase(flowServiceUrl: string, caseId: string) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/cases/start?id=${encodeURIComponent(caseId)}`, { method: 'POST' })
  if (!resp.ok) throw new Error(`Failed to start case: ${resp.status}`)
  return resp.json()
}
export async function executeAllCase(flowServiceUrl: string, caseId: string) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/cases/executeall?id=${encodeURIComponent(caseId)}`, { method: 'POST' })
  if (!resp.ok) throw new Error(`Failed to execute all: ${resp.status}`)
  return resp.json()
}
export async function fetchCaseEnabledTransitions(flowServiceUrl: string, caseId: string) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/cases/transitions/enabled?id=${encodeURIComponent(caseId)}`)
  if (!resp.ok) throw new Error(`Failed to fetch case transitions: ${resp.status}`)
  return resp.json()
}
export async function fireCaseTransition(flowServiceUrl: string, caseId: string, transitionId: string, bindingIndex: number = 0, formData?: any) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/cases/fire?id=${encodeURIComponent(caseId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transitionId, bindingIndex, ...(formData !== undefined ? { formData } : {}) })
  })
  if (!resp.ok) throw new Error(`Failed to fire case transition: ${resp.status}`)
  return resp.json()
}
export async function getCase(flowServiceUrl: string, caseId: string) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/cases/get?id=${encodeURIComponent(caseId)}`)
  if (!resp.ok) throw new Error(`Failed to get case: ${resp.status}`)
  return resp.json()
}

export async function suspendCase(flowServiceUrl: string, caseId: string) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/cases/suspend?id=${encodeURIComponent(caseId)}`, { method: 'POST' })
  if (!resp.ok) throw new Error(`Failed to suspend case: ${resp.status}`)
  return resp.json()
}
export async function resumeCase(flowServiceUrl: string, caseId: string) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/cases/resume?id=${encodeURIComponent(caseId)}`, { method: 'POST' })
  if (!resp.ok) throw new Error(`Failed to resume case: ${resp.status}`)
  return resp.json()
}
export async function abortCase(flowServiceUrl: string, caseId: string) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/cases/abort?id=${encodeURIComponent(caseId)}`, { method: 'POST' })
  if (!resp.ok) throw new Error(`Failed to abort case: ${resp.status}`)
  return resp.json()
}
export async function deleteCase(flowServiceUrl: string, caseId: string) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/cases/delete?id=${encodeURIComponent(caseId)}`, { method: 'DELETE' })
  if (!resp.ok) throw new Error(`Failed to delete case: ${resp.status}`)
  return resp.json()
}

// Query cases with filter & sort; body passthrough
export async function queryCases(flowServiceUrl: string, body: any) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/cases/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  })
  if (!resp.ok) throw new Error(`Failed to query cases: ${resp.status}`)
  return resp.json()
}

// ---- Token-centric VIA helpers ----
export async function queryTokens(flowServiceUrl: string, body: any) {
  const resp = await authFetch(`${flowServiceUrl.replace(/\/$/, '')}/api/tokens/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  })
  // 401 handling: provide clearer error for UI
  if (resp.status === 401) {
    throw new ApiError('Unauthorized querying tokens', { status: 401, context: 'queryTokens' })
  }
  if (!resp.ok) throw new Error(`Failed to query tokens: ${resp.status}`)
  return resp.json()
}

// ---- Tool Catalog helpers ----
export async function listTools(flowServiceUrl: string) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await authFetch(`${flowServiceUrl}/api/tools/list`)
  if (!resp.ok) throw new Error(`Failed to list tools: ${resp.status}`)
  return resp.json()
}

export async function registerTool(flowServiceUrl: string, payload: any) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await authFetch(`${flowServiceUrl}/api/tools/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({"endpoint": payload.baseUrl, "name": payload.name, "description": payload.description || "", "icon": payload.icon || "", "mcp": payload.mcp || false})
  })
  if (!resp.ok) {
    let text = ''
    try { text = await resp.text() } catch {}
    throw new ApiError('Register tool failed', { status: resp.status, rawBody: text, context: 'registerTool' })
  }
  return resp.json()
}

export async function listMcpTools(flowServiceUrl: string, params: { baseUrl: string; timeoutMs?: number }) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await authFetch(`${flowServiceUrl}/api/tools/list_mcp_tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({"endpoint": params.baseUrl, "timeoutMs": params.timeoutMs || 5000 })
  })
  if (!resp.ok) {
    let text = ''
    try { text = await resp.text() } catch {}
    throw new ApiError('List MCP tools failed', { status: resp.status, rawBody: text, context: 'listMcpTools' })
  }
  const json = await resp.json().catch(() => ({}))
  // Normalize various possible shapes to a plain array of tools
  const arr = json?.data?.tools || json?.tools || json?.data || json
  return Array.isArray(arr) ? arr : []
}

// List all registered MCP tools (across servers) returning structured entries.
// Strategy: fetch registered servers, then for each server POST to list_mcp_tools endpoint (sample curl pattern)
// Only enabled tools are returned by server when we include enabled=true in query OR we filter locally.
export async function listRegisteredMcpTools(flowServiceUrl: string): Promise<{ baseUrl: string; name: string }[]> {
  const base = flowServiceUrl.replace(/\/$/, '')
  // First get registered servers
  let servers: any[] = []
  try {
    const regResp = await authFetch(`${flowServiceUrl}/api/tools/registered_mcp`)
    if (regResp.ok) {
      const regJson = await regResp.json().catch(()=>({}))
      servers = Array.isArray(regJson?.data?.servers) ? regJson.data.servers : (Array.isArray(regJson) ? regJson : [])
    }
  } catch { /* ignore */ }
  if (!Array.isArray(servers)) servers = []
  const results: { baseUrl: string; name: string }[] = []
  for (const s of servers) {
    const ep = s?.baseUrl || s?.endpoint
    if (!ep) continue
    try {
      const resp = await authFetch(`${flowServiceUrl}/api/tools/list_mcp_tools?enabled=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: ep, timeoutMs: 5000 })
      })
      if (!resp.ok) continue
      const json = await resp.json().catch(()=>({}))
      const arr = json?.data?.tools || json?.tools || json?.data || json
      if (Array.isArray(arr)) {
        for (const t of arr) {
          const name = typeof t === 'string' ? t : t?.name
          const enabled = (typeof t === 'object') ? (t?.enabled ?? t?.Enabled ?? true) : true
          if (!name || enabled === false) continue
          results.push({ baseUrl: ep, name })
        }
      }
    } catch { /* ignore per-endpoint */ }
  }
  return results
}

export async function listRegisteredMcpServers(flowServiceUrl: string) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await authFetch(`${flowServiceUrl}/api/tools/registered_mcp`)
  if (!resp.ok) {
    let text = ''
    try { text = await resp.text() } catch {}
    throw new ApiError('List registered MCP servers failed', { status: resp.status, rawBody: text, context: 'listRegisteredMcpServers' })
  }
  const json = await resp.json().catch(() => ({}))
  const arr = json?.data?.servers || json?.servers || json?.data || json
  return Array.isArray(arr) ? arr : []
}

export async function registerMcpServer(flowServiceUrl: string, payload: { id?: string; name?: string; baseUrl: string; timeoutMs?: number; tools?: Array<{ name: string; enabled: boolean; config?: any }> }) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await authFetch(`${flowServiceUrl}/api/tools/register_mcp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({"endpoint": payload.baseUrl, 
      "id": payload.id,
      "name": payload.name, "timeoutMs": payload.timeoutMs || 5000,
      ...(payload.tools ? { tools: payload.tools } : {}) })
  })
  if (!resp.ok) {
    let text = ''
    try { text = await resp.text() } catch {}
    throw new ApiError('Register MCP server failed', { status: resp.status, rawBody: text, context: 'registerMcpServer' })
  }
  return resp.json()
}

export async function deregisterMcpServer(flowServiceUrl: string, payload: { id?: string; baseUrl?: string }) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await authFetch(`${flowServiceUrl}/api/tools/deregister_mcp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({"endpoint": payload.baseUrl, "id": payload.id })
  })
  if (!resp.ok) {
    let text = ''
    try { text = await resp.text() } catch {}
    throw new ApiError('Deregister MCP server failed', { status: resp.status, rawBody: text, context: 'deregisterMcpServer' })
  }
  return resp.json()
}

// List all cases (server-side)
export async function fetchCaseList(flowServiceUrl: string, opts: { offset?: number; limit?: number } = {}) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const params: string[] = []
  if (typeof opts.offset === 'number') params.push(`offset=${encodeURIComponent(String(opts.offset))}`)
  if (typeof opts.limit === 'number') params.push(`limit=${encodeURIComponent(String(opts.limit))}`)
  const qs = params.length ? `?${params.join('&')}` : ''
  const resp = await authFetch(`${flowServiceUrl}/api/cases/list${qs}`)
  if (!resp.ok) throw new Error(`Failed to list cases: ${resp.status}`)
  return resp.json()
}

// ---- Token transition enablement & firing (VIA) ----
// Determine enabled transitions for a set of tokens bound to a case
// Expected body shape: { caseId: string, tokens: [{ placeId, value }] }
// Server response (planned): { data: { results: [{ enabledTransitions: Transition[] }] } }
export async function tokensEnabled(flowServiceUrl: string, body: { caseId: string; tokens: { placeId: string; value: any }[] }) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await authFetch(`${flowServiceUrl}/api/tokens/enabled`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (resp.status === 401) throw new ApiError('Unauthorized querying enabled transitions', { status: 401, context: 'tokensEnabled' })
  if (!resp.ok) throw new Error(`Failed to fetch enabled transitions: ${resp.status}`)
  return resp.json()
}

// Fire a transition using token-centric endpoint
// Body shape: { caseId, transitionId, tokenBinding: { placeId, value }, input?: any }
export async function fireTokenTransition(flowServiceUrl: string, body: { caseId: string; transitionId: string; tokenBinding: { placeId: string; value: any }; input?: any }) {
  const base = flowServiceUrl.replace(/\/$/, '')
  const resp = await authFetch(`${flowServiceUrl}/api/tokens/fire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (resp.status === 401) throw new ApiError('Unauthorized firing transition', { status: 401, context: 'fireTokenTransition' })
  if (!resp.ok) {
    let text = ''
    try { text = await resp.text() } catch {}
    throw new ApiError('Fire token transition failed', { status: resp.status, rawBody: text, context: 'fireTokenTransition' })
  }
  return resp.json()
}

// Fetch colors list (defined schemas) from the server
export async function fetchColorsList(flowServiceUrl: string) {
  const resp = await authFetch(`${flowServiceUrl}/api/colors/list`)
  if (!resp.ok) throw new Error(`Failed to fetch colors list: ${resp.status}`)
  return resp.json()
}
