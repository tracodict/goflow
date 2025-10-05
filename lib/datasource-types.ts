export type DatasourceType = 'mongo' | 'postgres' | 'mysql' | 's3' | 'gcs'

export interface DatasourceSummary {
  id: string
  name: string
  type: DatasourceType
  status?: 'unknown' | 'healthy' | 'error'
  lastTestMs?: number
}

export interface DatasourceDetail extends DatasourceSummary {
  configPublic: Record<string, any>
}

export interface QueryAST {
  id?: string
  datasourceId: string
  engine: 'mongo' | 'sql'
  source: { collection?: string; table?: string; schema?: string }
  projections: { field: string; alias?: string }[]
  filters: FilterNode[]
  sorts: { field: string; direction: 'asc'|'desc' }[]
  limit?: number
  offset?: number
  joins?: JoinNode[]
  raw?: string
  params?: Record<string, any>
}

export interface FilterNode { field: string; op: FilterOp; value: any }
export type FilterOp = 'eq'|'ne'|'lt'|'lte'|'gt'|'gte'|'in'|'contains'|'between'
export interface JoinNode { type: 'inner'|'left'; leftField: string; rightDatasourceId?: string; rightSource: { table?: string; collection?: string }; rightField: string }

export interface QueryResultColumn { name: string; type?: string }
export interface QueryResult { columns: QueryResultColumn[]; rows: any[]; meta: { executionMs:number; datasourceId:string; cached?:boolean } }
export interface DatasourceError { message: string; code?: string; retriable?: boolean }

// S3-specific types
export type S3Provider = 'amazon' | 'google' | 'minio' | 'digitalocean'

export interface S3Config {
  provider: S3Provider
  region?: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string // For non-AWS providers like MinIO
  pathStyle?: boolean // For non-AWS providers
}

export interface S3File {
  key: string
  size: number
  lastModified: Date
  etag: string
  isFolder: boolean
  contentType?: string
}

export interface S3QueryResult {
  files: S3File[]
  prefix: string
  totalFiles: number
  meta: { executionMs: number; datasourceId: string }
}
