// FileStore API Client - Based on filestore.sh server API patterns
// This replaces the deprecated datasource-client.ts

// Internal helper to always include credentials (lz_sess cookie) for cross-subdomain calls
async function authFetch(input: string, init: RequestInit = {}) {
  return fetch(input, { credentials: 'include', ...init })
}

export interface DataSource {
  id: string
  name: string
  type: 'gcs' | 's3' | 'mongodb' | 'postgres' | 'mysql'
  description?: string
  config: Record<string, any>
  credentials: Record<string, any>
  enabled: boolean
  createdAt?: string
  updatedAt?: string
  // Test status fields (added dynamically by store)
  test_status?: 'healthy' | 'error' | 'unknown'
  test_latency_ms?: number
  test_error?: string
  last_tested_at?: string
}

export interface QueryDefinition {
  id: string
  name: string
  data_source_id: string
  query_type: 'folder' | 'sql' | 'select'
  query?: string
  description?: string
  parameters?: Record<string, any>
  filters?: {
    maxFileSize?: number
    allowedExtensions?: string[]
    [key: string]: any
  }
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface QueryExecutionResult {
  success: boolean
  data: {
    results: any[]
    total_count: number
    execution_time_ms: number
    columns?: Array<{ name: string; type: string }>
    metadata?: Record<string, any>
  }
  message: string
}

export interface QueryResult {
  columns: string[]
  rows: any[]
  meta: {
    executionMs: number
    datasourceId: string
    [key: string]: any
  }
}

export interface DataSourceTestResult {
  ok: boolean
  latencyMs: number
  error?: string
}

export interface DataSourceTestRequest {
  override?: Record<string, any>
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: any
    try {
      errorData = await response.json()
    } catch {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    if (errorData.error) {
      throw new Error(errorData.error.message || 'API Error')
    }
    throw new Error(errorData.message || 'Request failed')
  }
  
  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error?.message || data.message || 'Request failed')
  }
  
  return data.data
}

// ============= Data Source Management APIs =============

export async function createDataSource(flowServiceUrl: string, payload: Partial<DataSource>): Promise<DataSource> {
  // Generate ID if not provided (matching filestore.sh pattern)
  const datasourcePayload = {
    ...payload,
    id: payload.id || `ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    enabled: payload.enabled ?? true
  }
  
  const response = await authFetch(`${flowServiceUrl}/api/datasources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datasourcePayload)
  })
  return handleResponse<DataSource>(response)
}

export async function getDataSource(flowServiceUrl: string, id: string): Promise<DataSource> {
  const response = await authFetch(`${flowServiceUrl}/api/datasources/${id}`)
  return handleResponse<DataSource>(response)
}

export async function updateDataSource(flowServiceUrl: string, id: string, payload: Partial<DataSource>): Promise<DataSource> {
  const response = await authFetch(`${flowServiceUrl}/api/datasources/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return handleResponse<DataSource>(response)
}

export async function deleteDataSource(flowServiceUrl: string, id: string): Promise<{ data_source_id: string }> {
  const response = await authFetch(`${flowServiceUrl}/api/datasources/${id}`, {
    method: 'DELETE'
  })
  return handleResponse<{ data_source_id: string }>(response)
}

export async function listDataSources(flowServiceUrl: string, params?: {
  type?: DataSource['type']
  enabled?: boolean
  limit?: number
  offset?: number
}): Promise<{
  data_sources: DataSource[]
  total_count: number
  limit: number
  offset: number
}> {
  const searchParams = new URLSearchParams()
  if (params?.type) searchParams.set('type', params.type)
  if (params?.enabled !== undefined) searchParams.set('enabled', params.enabled.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.offset) searchParams.set('offset', params.offset.toString())
  
  const url = `${flowServiceUrl}/api/datasources${searchParams.toString() ? `?${searchParams}` : ''}`
  const response = await authFetch(url)
  return handleResponse<{
    data_sources: DataSource[]
    total_count: number
    limit: number
    offset: number
  }>(response)
}

export async function testDataSource(flowServiceUrl: string, id: string, testRequest?: DataSourceTestRequest): Promise<DataSourceTestResult> {
  const response = await authFetch(`${flowServiceUrl}/api/datasources/${id}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testRequest || {})
  })
  return handleResponse<DataSourceTestResult>(response)
}

// ============= Query Definition APIs =============

export async function createQueryDefinition(flowServiceUrl: string, payload: Partial<QueryDefinition>): Promise<QueryDefinition> {
  // Generate ID if not provided (matching filestore.sh pattern)
  const queryPayload = {
    ...payload,
    id: payload.id || `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    enabled: payload.enabled ?? true
  }
  
  const response = await authFetch(`${flowServiceUrl}/api/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(queryPayload)
  })
  return handleResponse<QueryDefinition>(response)
}

export async function getQueryDefinition(flowServiceUrl: string, id: string): Promise<QueryDefinition> {
  const response = await authFetch(`${flowServiceUrl}/api/queries/${id}`)
  return handleResponse<QueryDefinition>(response)
}

export async function updateQueryDefinition(flowServiceUrl: string, id: string, payload: Partial<QueryDefinition>): Promise<QueryDefinition> {
  const response = await authFetch(`${flowServiceUrl}/api/queries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return handleResponse<QueryDefinition>(response)
}

export async function deleteQueryDefinition(flowServiceUrl: string, id: string): Promise<{ query_id: string }> {
  const response = await authFetch(`${flowServiceUrl}/api/queries/${id}`, {
    method: 'DELETE'
  })
  return handleResponse<{ query_id: string }>(response)
}

export async function listQueryDefinitions(flowServiceUrl: string, params?: {
  data_source_id?: string
  query_type?: QueryDefinition['query_type']
  enabled?: boolean
  limit?: number
  offset?: number
}): Promise<{
  queries: QueryDefinition[]
  total_count: number
  limit: number
  offset: number
}> {
  const searchParams = new URLSearchParams()
  if (params?.data_source_id) searchParams.set('data_source_id', params.data_source_id)
  if (params?.query_type) searchParams.set('query_type', params.query_type)
  if (params?.enabled !== undefined) searchParams.set('enabled', params.enabled.toString())
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.offset) searchParams.set('offset', params.offset.toString())
  
  const url = `${flowServiceUrl}/api/queries${searchParams.toString() ? `?${searchParams}` : ''}`
  const response = await authFetch(url)
  return handleResponse<{
    queries: QueryDefinition[]
    total_count: number
    limit: number
    offset: number
  }>(response)
}

export async function executeQuery(flowServiceUrl: string, id: string, params?: Record<string, any>): Promise<QueryResult> {
  const response = await authFetch(`${flowServiceUrl}/api/queries/${id}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params: params || {} })
  })
  return handleResponse<QueryResult>(response)
}

// Add PATCH method for partial updates
export async function patchQueryDefinition(flowServiceUrl: string, id: string, updates: Partial<QueryDefinition>): Promise<QueryDefinition> {
  const response = await authFetch(`${flowServiceUrl}/api/queries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  return handleResponse<QueryDefinition>(response)
}

// Add ad-hoc query execution
export async function executeAdhocQuery(flowServiceUrl: string, ast: any, params?: Record<string, any>): Promise<QueryResult> {
  const response = await authFetch(`${flowServiceUrl}/api/query/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ast, params: params || {} })
  })
  return handleResponse<QueryResult>(response)
}

export async function validateQuery(flowServiceUrl: string, payload: {
  name: string
  description?: string
  data_source_id: string
  query_type: QueryDefinition['query_type']
  query_config: Record<string, any>
  parameters?: Record<string, any>
}): Promise<{
  valid: boolean
  validation_errors?: string[]
  estimated_result_count?: number
}> {
  const response = await authFetch(`${flowServiceUrl}/api/queries/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return handleResponse<{
    valid: boolean
    validation_errors?: string[]
    estimated_result_count?: number
  }>(response)
}