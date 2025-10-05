# Data Source & Query Platform (Frontend + API Contract)

Status: DRAFT v0.1 (Phase 1 – MongoDB implementation path)
Target Stack: Re‑use existing `goflow` Next.js (App Router), React 19, Zustand stores (where already present), shadcn/radix UI, existing system settings pattern, Petri client patterns. No new global state tech (avoid Redux / Apollo). Keep persistence via existing serverless API routes + backend service.

---
## 1. Goals & Scope

Provide a unified Data Source layer enabling users (builders) to:
1. Register & configure connections (MongoDB first; design allows Postgres/MySQL next).
2. Introspect structures (databases/collections or schemas/tables) + cache hierarchically.
3. Build queries visually (filter, project, sort, limit, join) with fallback to raw editor.
4. Support cross‑datasource joins (deferred; design placeholder) via intermediate “Virtual Query Graph”.
5. Save queries (versioned), parameterize & execute them at runtime (with binding to workflow or UI components).
6. Bind query results to a Table component (initial minimal Table referencing Appsmith TableWidgetV2 features subset) and later other components (charts, forms).
7. Provide mock layer (flag controlled) to allow building without live DB.

Non‑Goals (Phase 1):
* Full SQL dialect coverage (only core SELECT / simple JOIN design placeholder).
* Complex aggregation pipelines optimization.
* Fine‑grained row level security policies (future doc).

---
## 2. Functional Requirements (Consolidated)

### 2.1 Data Source Management
| Feature | Mongo (Phase 1) | Postgres/MySQL (Design) | Notes |
|---------|-----------------|-------------------------|-------|
| Create datasource | Yes (URI or host+port+db+auth) | Yes (host+port+db+auth+ssl) | Uniform form abstraction |
| Secure credential storage | Backend secret storage reference | Same | Frontend never persists raw password locally |
| Test connection | Ping / list db stats | Simple `SELECT 1` | Unified `/datasources/:id/test` |
| Edit / rotate credentials | Yes | Yes | Partial update mask |
| Delete datasource | Yes | Yes | Soft delete optional |
| Structure introspection | List collections & sample fields | Schemas, tables, columns | Cache + TTL |
| Mock datasource add | Yes | Yes | Pre‑seed example collections/tables |

### 2.1.1 Data Sidebar (Builder Left Panel – Implemented)
Compact navigation slice inside existing LeftPanel:
- Collapsible Sections: Datasources, Saved Queries, History.
- Datasources list shows: status dot (healthy/error/unknown), name, type, last test latency (ms) if available.
- Hover actions per datasource: Test (beaker icon), Open in Data Workspace (play icon).
- Toolbar actions: Refresh list, Add datasource.
- Inline creation form (Phase 1) limited to: name + type selector (mongo/postgres/mysql) – advanced connection parameters configured after creation via upcoming Config dialog.
- Emits custom events: `goflow-open-data-workspace` with `{ datasourceId?, view? }` for upper-level navigation.
- Future: Add quick-run saved queries & history click-through.

### 2.2 Query Builder
| Capability | Mongo Implementation | Relational Plan | Notes |
|------------|----------------------|-----------------|-------|
| Select source | collection | table (schema.table) | Auto suggest from introspection cache |
| Projection / Columns | Field multi-select + alias | Column multi-select + alias | Limit 100 default |
| Filters | Field op value (==, !=, in, contains, range) | WHERE clause builder | Unified AST |
| Sorting | Field + direction (multi) | ORDER BY list | |
| Pagination | Skip + Limit w/ total estimation | LIMIT + OFFSET | Cursor (future) |
| Aggregation | Basic group (phase 2) | GROUP BY placeholder | AST extension |
| Joins | N/A in Phase 1 | INNER/LEFT (single) | Cross-datasource join via query graph (deferred) |
| Raw editor toggle | Mongo JSON pipeline | SQL text | Two‑way sync minimal (one‑way from builder to text allowed initially) |
| Parameter binding | `{{vars.name}}` tokens | Same | Reuse existing expression evaluation from forms/workflow if possible |

### 2.3 Query Execution & Binding
* Execute query returns: `{ meta: { executionMs, datasourceId, cached }, columns: [...], rows: [...], raw?: backendRaw }`.
* Error shape: `{ error: { message, code?, details? } }`.
* Cancellable (AbortController front) & idempotent (no side effects Query type = READ).
* Result binding: Table component accepts `data` (array of objects), derives columns unless explicit column config.

### 2.4 Table Component (Phase 1 Subset)
Inspired by `appsmith/src/widgets/TableWidgetV2` but simplified:
| Feature | Include Now | Notes |
|---------|-------------|-------|
| Column auto-generate | Yes | From first result page |
| Manual column re-order | Later | Persist layout in saved query binding meta |
| Sort (client) | Yes | Toggle header sort; if server paginated, delegate |
| Pagination (client) | Yes | Default 25/page (client slice) |
| Server pagination | Later (Phase 1 optional) | Use query builder limit/offset controls |
| Row selection (single) | Yes | Provide `onRowSelect(row)` callback |
| Row actions | Placeholder | Button cell spec future |
| Cell types (text, number, date, image) | Basic auto detect | Formatters map |
| Loading / empty states | Yes | Skeleton + “No data”|
| Theming | Use existing Tailwind + shadcn tokens | |

Props Draft: `TableDataView { data: any[]; loading?: boolean; onRowSelect?: (row:any)=>void; columns?: ColumnSpec[] }` with `ColumnSpec { key: string; label?: string; type?: 'text'|'number'|'date'|'image'; sortable?: boolean }`.

### 2.5 Mock Layer
* Gate via `NEXT_PUBLIC_ENABLE_DATASOURCE_MOCK=1` (frontend) + `DATASOURCE_MOCK_ENABLED=1` (backend) to avoid accidental prod usage.
* Provides deterministic sample data sets (Mongo: `users`, `orders`; Relational: same logical sets) with stable IDs for UI development.
* Query execution short‑circuits to mock provider before real driver.

---
## 3. Architecture Overview

### 3.1 Frontend Layers
1. Datasource Store (Zustand) – holds list, introspection cache, queries, execution states.
2. API Client (`lib/datasource-client.ts`) – thin wrappers around REST endpoints (modeled after existing `petri-client`).
3. Query AST Model – TS types describing a unified logical query (works for both Mongo + SQL).
4. Query Builder UI – composable panels: SourceSelector, ProjectionPanel, FilterPanel, SortPanel, PreviewPanel, RawEditorToggle.
5. Binding Adapter – resolves AST -> backend request payload; for Mongo builds pipeline, for SQL builds SELECT string.
6. Table Component – separate in `components/data/table` reusing existing design tokens.

### 3.2 Data Flow (Create & Run)
User Action → Store Action → API Client → Backend → Response normalized → Store update → Components rerender.

### 3.3 Caching
* Introspection cached in memory + localStorage keyed by datasourceId + versionHash.
* Query results not cached Phase 1 (except optional last result per saved query for optimistic UI).

### 3.4 Error Handling
* Standard envelope: 2xx with `error` object OR non‑2xx with `message`.
* Frontend converts network/abort into structured `DatasourceError { message, retriable?: boolean }`.

---
## 4. Unified Query AST (Draft)

```ts
type QueryAST = {
	id?: string
	datasourceId: string
	engine: 'mongo' | 'sql'
	source: { collection?: string; table?: string; schema?: string }
	projections: { field: string; alias?: string }[]
	filters: FilterNode[]
	sorts: { field: string; direction: 'asc'|'desc' }[]
	limit?: number
	offset?: number
	joins?: JoinNode[] // future
	raw?: string // raw text or JSON pipeline
	params?: Record<string, any>
}
type FilterNode = { field: string; op: 'eq'|'ne'|'lt'|'lte'|'gt'|'gte'|'in'|'contains'|'between'; value: any | any[] }
type JoinNode = { type: 'inner'|'left'; leftField: string; rightDatasourceId?: string; rightSource: { table?: string; collection?: string }; rightField: string }
```

AST → Backend translation (examples):
* Mongo: filters -> `$match`; projections -> `$project`; sorts -> `$sort`; pagination -> `$skip` + `$limit`.
* SQL: SELECT list, FROM, JOIN, WHERE, ORDER, LIMIT/OFFSET.

---
## 5. Backend API Contract (Initial)

Base path (subject to integration with existing API prefix): `/api/ds`.

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|--------------|----------|
| POST | `/datasources` | Create datasource | `{ type:'mongo'|'postgres'|'mysql', name, config:{...} }` | `{ id, name, type }` |
| GET | `/datasources` | List datasources | — | `{ datasources:[...] }` |
| GET | `/datasources/:id` | Get detail (no secrets) | — | `{ id, name, type, configPublic }` |
| PATCH | `/datasources/:id` | Update | partial config | `{ id, ... }` |
| DELETE | `/datasources/:id` | Delete | — | `{ ok:true }` |
| POST | `/datasources/:id/test` | Test connection | optional override | `{ ok:true, latencyMs }` |
| GET | `/datasources/:id/structure` | Introspect structure | `?refresh=1` | `{ structure:{ ... } }` |
| POST | `/datasources/:id/query` | Ad‑hoc engine execution (NEW unified) | Mongo: `{ pipeline, collection }` SQL: `{ sql }` | `{ columns, rows, meta }` |
| POST | `/queries` | Create saved query | `{ ast:QueryAST, name }` | `{ id, name }` |
| GET | `/queries/:id` | Fetch saved query | — | `{ id, ast, name }` |
| PATCH | `/queries/:id` | Update | partial | `{ id }` |
| POST | `/queries/:id/run` | Run saved query | `{ params? }` | `{ columns, rows, meta }` |
| POST | `/query/execute` | Ad‑hoc run (legacy planned) | `{ ast:QueryAST }` | `{ columns, rows, meta }` |
| GET | `/mock/datasets` | List mock sets | — | `{ datasets:[name] }` |
| POST | `/mock/seed` | Ensure mock seeded | `{ dataset }` | `{ ok:true }` |

### 5.1.1 Additional Endpoint Details (Phase 1 Implementation Notes)
| Endpoint | Notes |
|----------|-------|
| GET `/datasources/:id` | Returns redacted public config only (`configPublic`). Secrets never leave server. |
| PATCH `/datasources/:id` | Accepts partial updates; secrets updated atomically (e.g. `auth.password`); server re-tests connection optionally (`?test=1`). |
| DELETE `/datasources/:id` | Soft delete placeholder (current mock: hard remove). |
| POST `/datasources/:id/test` | Performs engine-specific lightweight check (Mongo: connect + `ping`). Returns `{ ok, latencyMs }`. If driver missing (e.g. Postgres not installed) returns `{ ok:false, code:'DRIVER_MISSING' }`. |
| GET `/datasources/:id/structure` | Cache key = datasourceId + versionHash; `?refresh=1` bypasses cache. |

### 5.1.2 Driver Loading Strategy
Server attempts dynamic `import('mongodb')`, `import('pg')`, `import('mysql2/promise')`. If import fails => driver not available; test/introspect returns structured error but does not crash route.

Error shape extensions:
```json
{ "error": { "message": "Driver not installed", "code": "DRIVER_MISSING", "engine": "postgres" } }
```


Headers: if mock enabled and `?mock=1` or header `X-Datasource-Mock=1`, backend uses mock provider.

Environment Flag: `DATASOURCE_MOCK_ENABLED=1` toggles acceptance of mock param; frontend companion `NEXT_PUBLIC_ENABLE_DATASOURCE_MOCK` surfaces UI toggle.

### 5.1 Structure Response (Mongo)
```json
{
	"structure": {
		"databases": [
			{ "name": "app", "collections": [ { "name": "users", "sampleFields": [ {"path":"_id","type":"ObjectId"}, {"path":"email","type":"string"} ] } ] }
		]
	}
}
```

### 5.2 Structure Response (SQL – future)
```json
{ "structure": { "schemas": [ { "name": "public", "tables": [ { "name": "users", "columns": [ {"name":"id","type":"uuid"} ] } ] } ] } }
```

### 5.3 Query Execute Response
```json
{ "columns":[{"name":"email","type":"string"}], "rows":[{"email":"a@example.com"}], "meta":{"executionMs":12,"datasourceId":"ds1","cached":false} }
```

---
## 6. Frontend Module Plan

| Module | File (proposed) | Purpose |
|--------|-----------------|---------|
| Client | `lib/datasource-client.ts` | Fetch wrappers |
| Store | `stores/datasource.ts` | CRUD, cache, query execution state |
| Types | `lib/datasource-types.ts` | AST + entity types |
| Builder UI | `components/data/datasource/` | Creation & edit forms |
| Query Builder | `components/data/query-builder/` | Panels & AST editing |
| Table | `components/data/table/` | Data grid view (subset) |
| Bindings | `components/data/binding/` | Expression integration (future) |
| Sidebar | `components/builder/LeftPanel.tsx` | Datasource list + quick actions (already integrated) |

### 6.1 Configuration Workflow (Phase 1 Real Connection)
1. User creates datasource (name + type) via sidebar Add.
2. Opens Config dialog (to be implemented) listing engine-specific fields:
	- Mongo: either full URI OR host, port, database, username, password, replicaSet?, srv? toggle.
	- Postgres: host, port, database, user, password, sslMode? (disable/prefer/require), schema (default `public`).
	- MySQL: host, port, database, user, password, ssl?.
3. User fills fields and clicks Test connection → calls `POST /datasources/:id/test` with temporary override body (not persisted if test fails).
4. If test passes, user saves → sends PATCH with new config (server stores secrets securely) and optional `?test=1` to validate plus return status.
5. UI updates list; status dot = healthy on success; latency stored in local ephemeral map.
6. Query Builder uses only datasourceId + introspection results; secrets never flow to client again after initial entry.

Validation rules front-end: required fields engine-specific, port numeric, host non-empty, database name constraints (alphanumeric + underscore), URI mutually exclusive with host/port pairs.

### 6.2 Status Determination
`status` field resolved server-side from last successful test timestamp + test result cache. If never tested => `unknown`. Error sets `error` + `status: 'error'`.


---
## 7. Execution Plan

### Phase 1 (MongoDB + Minimal Table)
1. Types & Client scaffolding.
2. Store: list/create/update/delete datasource (Mongo only) + test + introspect.
3. Query AST + simple builder (source, projection, filters, sort, limit).
4. Execute ad-hoc queries; render in Table component.
5. Save query; rerun saved query; param substitution (simple key/value overlay).
6. Mock mode + sample datasets.
7. Docs & polish.
8. Real connection configuration & test flow (this addendum) – minimal driver integration for Mongo; stub for other engines.

### Phase 2 (Relational Foundations: Postgres/MySQL)
1. Extend AST with joins + SQL generator.
2. Introspection adapters (schemas/tables/columns).
3. SQL builder panels (joins + preview SQL text).
4. Pagination server-side; server sort delegation.
5. Table column config persistence.

### Phase 3 (Advanced)
* Aggregations (group, metrics) & function library.
* Cross-datasource joins via Virtual Query Graph.
* Caching layer / materialized previews.
* Row actions / inline edits (mutation queries).

---
## 8. Security & Validation
* Credentials never stored in client; only opaque datasourceId references.
* Query & test routes sanitize error strings to mask credentials.
* Query param binding sanitized: only allow interpolation into value positions (no raw operator injection).
* Rate limit execution endpoint (server) per user & datasource.

---
## 9. Open Questions / TBD
| Area | Question | Proposed Default |
|------|----------|------------------|
| Auth to backend endpoints | Reuse existing session cookie? | Yes, same middleware chain |
| Large result pagination | Implement server cursor? | Defer (Phase 2/3) |
| Cross-datasource join semantics | Pushdown vs memory join | Start with memory join prototype for small sets |

---
## 10. Appendix: Mapping to Appsmith Concepts
| Appsmith Concept | Our Equivalent |
|------------------|----------------|
| Datasource entity | Datasource (same) |
| Action / Query | Saved Query (QueryAST + metadata) |
| Plugin | Engine adapter (mongo/sql) |
| Mock DB | Mock provider (flag) |
| Widget Table | TableDataView |
| Dynamic Binding `{{ }}` | Expression evaluation layer (shared) |

---
## 11. Next Steps (Immediate)
1. Approve API surface.
2. Implement client + store scaffolding.
3. Build Mongo create/test/introspect flow.
4. Ship initial query builder + run + Table bind.
5. Add saved query persistence.
6. Implement config dialog + real connection testing for Mongo (update: sidebar implemented; config pending).

### 11.1 Detailed Specs
* See `QueryBuilder.md` for deep dive on AST editing & translation.
* See `TableComponent.md` for table feature schema & props.
* See `BackendAPI.md` for full endpoint schemas, error codes, mock behaviors.

---

## 12. S3 Data Source Enhancement (Phase 1.5)

### 12.1 Overview
Enhanced S3 data source implementation with separate providers, query-based folder navigation, and file upload capabilities. This extends the current data source architecture to support object storage as first-class data sources.

### 12.2 Provider Separation
Split the current generic "S3" datasource into distinct provider types:

| Provider | Type ID | Description | Configuration |
|----------|---------|-------------|---------------|
| AWS S3 | `aws-s3` | Amazon S3 buckets | Access Key, Secret Key, Region, Bucket |
| Google Cloud Storage | `gcs` | GCS buckets | Service Account JSON, Project ID, Bucket |
| S3-Compatible | `s3-compatible` | MinIO, DigitalOcean Spaces, etc. | Endpoint URL, Access Key, Secret Key, Bucket |

### 12.3 Query Model for Object Storage
Extend the QueryAST to support object storage queries:

```ts
type ObjectStorageQuery = {
  datasourceId: string
  engine: 'object-storage'
  bucket: string
  prefix?: string           // Folder path filter
  delimiter?: string        // Usually '/' for folder navigation
  maxKeys?: number         // Limit results (default 1000)
  recursive?: boolean      // Include all subdirectories
  includeMetadata?: boolean // Return size, lastModified, etc.
  filters?: {
    extension?: string[]   // File extension filter
    sizeMin?: number      // Minimum file size in bytes
    sizeMax?: number      // Maximum file size in bytes
    modifiedAfter?: string // ISO date string
    modifiedBefore?: string // ISO date string
  }
}
```

### 12.4 Backend Persistence Architecture
Move from Next.js API routes to dedicated Go+MongoDB backend service:

#### 12.4.1 Required Backend APIs

Base path: `{flowServiceUrl}/api/ds`

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|--------------|----------|
| POST | `/datasources` | Create datasource | `{ type: 'aws-s3'|'gcs'|'s3-compatible', name, config }` | `{ id, name, type }` |
| GET | `/datasources` | List datasources | — | `{ datasources: [...] }` |
| GET | `/datasources/:id` | Get datasource detail | — | `{ id, name, type, configPublic }` |
| PATCH | `/datasources/:id` | Update datasource | Partial config | `{ id }` |
| DELETE | `/datasources/:id` | Delete datasource | — | `{ ok: true }` |
| POST | `/datasources/:id/test` | Test connection | Optional override config | `{ ok: true, latencyMs }` |
| POST | `/datasources/:id/query` | List objects | `ObjectStorageQuery` | `{ objects: [...], truncated: boolean }` |
| POST | `/datasources/:id/upload` | Upload file(s) | Multipart form with metadata | `{ uploaded: [...] }` |
| DELETE | `/datasources/:id/objects` | Delete objects | `{ keys: string[] }` | `{ deleted: [...] }` |

#### 12.4.2 MongoDB Schema

```js
// Datasources collection
{
  _id: ObjectId,
  type: "aws-s3" | "gcs" | "s3-compatible",
  name: string,
  userId: string,  // Owner reference
  config: {
    // Provider-specific encrypted config
    aws_s3: {
      accessKeyId: string,     // Encrypted
      secretAccessKey: string, // Encrypted
      region: string,
      bucket: string
    },
    gcs: {
      serviceAccountJson: string, // Encrypted
      projectId: string,
      bucket: string
    },
    s3_compatible: {
      endpoint: string,
      accessKeyId: string,     // Encrypted
      secretAccessKey: string, // Encrypted
      bucket: string,
      region?: string
    }
  },
  status: {
    lastTest: Date,
    healthy: boolean,
    error?: string,
    latencyMs?: number
  },
  createdAt: Date,
  updatedAt: Date
}

// Saved Queries collection (enhanced for object storage)
{
  _id: ObjectId,
  name: string,
  userId: string,
  datasourceId: ObjectId,
  queryType: "sql" | "mongodb" | "object-storage",
  query: ObjectStorageQuery | QueryAST,
  createdAt: Date,
  updatedAt: Date,
  lastRun?: Date,
  runCount: number
}
```

### 12.5 Frontend Component Enhancements

#### 12.5.1 Datasource Configuration UI
Enhanced configuration forms for each provider:

```tsx
// AWS S3 Configuration
interface AWSS3Config {
  accessKeyId: string
  secretAccessKey: string
  region: string
  bucket: string
}

// GCS Configuration  
interface GCSConfig {
  serviceAccountJson: string  // JSON key file content
  projectId: string
  bucket: string
}

// S3-Compatible Configuration
interface S3CompatibleConfig {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  region?: string
}
```

#### 12.5.2 Enhanced S3Explorer Component

```tsx
interface S3ExplorerProps {
  datasourceId?: string
  query?: Partial<ObjectStorageQuery>  // Query-based folder navigation
  
  // Navigation features
  enableNavigation?: boolean
  showBreadcrumbs?: boolean
  enableUpload?: boolean
  enableDelete?: boolean
  
  // Display options
  viewMode?: 'list' | 'grid' | 'tree'
  showMetadata?: boolean
  sortBy?: 'name' | 'size' | 'modified'
  sortOrder?: 'asc' | 'desc'
  
  // Event handlers
  onFileSelect?: (file: S3Object) => void
  onFolderNavigate?: (path: string) => void
  onUploadComplete?: (files: S3Object[]) => void
  onError?: (error: string) => void
}
```

### 12.6 File Upload Implementation

#### 12.6.1 Upload API
```ts
// POST /datasources/:id/upload
interface UploadRequest {
  files: File[]           // Multipart form files
  prefix?: string         // Target folder path
  overwrite?: boolean     // Overwrite existing files
  metadata?: Record<string, string>  // Custom metadata
}

interface UploadResponse {
  uploaded: Array<{
    key: string
    size: number
    etag: string
    url?: string  // Public URL if applicable
  }>
  errors?: Array<{
    file: string
    error: string
  }>
}
```

#### 12.6.2 Upload Component
```tsx
const S3Uploader: React.FC<{
  datasourceId: string
  targetPath?: string
  onUploadComplete?: (files: S3Object[]) => void
}> = ({ datasourceId, targetPath, onUploadComplete }) => {
  // Drag & drop file upload with progress
  // Support multiple files
  // Show upload progress per file
  // Handle errors gracefully
}
```

### 12.7 Navigation Features

#### 12.7.1 Folder Navigation
- Breadcrumb navigation showing current path
- Click folders to navigate deeper
- Back/up navigation
- URL-based deep linking to specific paths

#### 12.7.2 Query-Based Exploration
Users can define queries to explore specific portions of buckets:
- Set prefix to start in a specific "folder"
- Apply filters (file type, size, date ranges)
- Save common navigation patterns as queries

### 12.8 Security Considerations

#### 12.8.1 Credential Management
- All cloud provider credentials encrypted at rest in MongoDB
- Credentials never returned to frontend
- Support IAM roles for AWS (future)
- Support service account impersonation for GCS (future)

#### 12.8.2 Access Control
- Per-datasource access control (future)
- Upload/delete permissions configurable per datasource
- File size limits configurable
- Allowed file type restrictions

---

## 13. S3 Enhancement Execution Plan

### Phase 1: Backend Infrastructure (2-3 days)
1. **Database Schema Setup**
   - Create MongoDB collections for enhanced datasources
   - Implement encryption for credentials
   - Add migration scripts for existing S3 datasources

2. **Backend API Implementation**
   - Implement Go handlers for datasource CRUD operations
   - Add provider-specific connection logic (AWS SDK, GCS client)
   - Implement object listing with query filters
   - Add file upload endpoint with multipart support
   - Add test connection endpoints

3. **Provider Abstraction**
   - Create provider interface for consistent API
   - Implement AWS S3 provider
   - Implement GCS provider  
   - Implement S3-compatible provider (MinIO, etc.)

### Phase 2: Frontend Core Components (3-4 days)
1. **Datasource Configuration UI**
   - Create provider-specific configuration forms
   - Add validation for each provider type
   - Integrate with backend test endpoint
   - Update datasource list to show provider types

2. **Enhanced Query Builder**
   - Extend QueryAST for object storage
   - Create object storage query builder UI
   - Add filters for file type, size, date
   - Implement query preview

3. **Core S3Explorer Refactor**
   - Split S3Explorer into provider-agnostic component
   - Implement query-based navigation
   - Add breadcrumb navigation
   - Support different view modes (list/grid)

### Phase 3: Advanced Features (2-3 days)
1. **File Upload Component**
   - Implement drag & drop upload
   - Add upload progress tracking
   - Handle multiple file uploads
   - Error handling and retry logic

2. **Navigation & UX**
   - Implement folder navigation
   - Add search within current folder
   - Sorting and filtering options
   - File preview capabilities (images, text)

3. **Integration & Polish**
   - Update property configuration
   - Add event handlers for all actions
   - Performance optimizations
   - Documentation and examples

### Phase 4: Testing & Deployment (1-2 days)
1. **Testing**
   - Unit tests for all components
   - Integration tests with mock providers
   - End-to-end testing with real cloud accounts

2. **Documentation**
   - Update component documentation
   - Add configuration guides for each provider
   - Create migration guide from old S3 datasources

### Total Estimated Time: 8-12 days

---
END


## 12. S3 Data Source Enhancement (Phase 1.5)

### 12.1 Overview
Enhanced S3 data source implementation with separate providers, query-based folder navigation, and file upload capabilities. This extends the current data source architecture to support object storage as first-class data sources.

### 12.2 Provider Separation
Split the current generic "S3" datasource into distinct provider types:

| Provider | Type ID | Description | Configuration |
|----------|---------|-------------|---------------|
| AWS S3 | `aws-s3` | Amazon S3 buckets | Access Key, Secret Key, Region, Bucket |
| Google Cloud Storage | `gcs` | GCS buckets | Service Account JSON, Project ID, Bucket |
| S3-Compatible | `s3-compatible` | MinIO, DigitalOcean Spaces, etc. | Endpoint URL, Access Key, Secret Key, Bucket |

### 12.3 Query Model for Object Storage
Extend the QueryAST to support object storage queries:

```ts
type ObjectStorageQuery = {
  datasourceId: string
  engine: 'object-storage'
  bucket: string
  prefix?: string           // Folder path filter
  delimiter?: string        // Usually '/' for folder navigation
  maxKeys?: number         // Limit results (default 1000)
  recursive?: boolean      // Include all subdirectories
  includeMetadata?: boolean // Return size, lastModified, etc.
  filters?: {
    extension?: string[]   // File extension filter
    sizeMin?: number      // Minimum file size in bytes
    sizeMax?: number      // Maximum file size in bytes
    modifiedAfter?: string // ISO date string
    modifiedBefore?: string // ISO date string
  }
}
```

### 12.4 Backend Persistence Architecture
Move from Next.js API routes to dedicated Go+MongoDB backend service:

#### 12.4.1 Required Backend APIs

Base path: `{flowServiceUrl}/api/ds`

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|--------------|----------|
| POST | `/datasources` | Create datasource | `{ type: 'aws-s3'|'gcs'|'s3-compatible', name, config }` | `{ id, name, type }` |
| GET | `/datasources` | List datasources | — | `{ datasources: [...] }` |
| GET | `/datasources/:id` | Get datasource detail | — | `{ id, name, type, configPublic }` |
| PATCH | `/datasources/:id` | Update datasource | Partial config | `{ id }` |
| DELETE | `/datasources/:id` | Delete datasource | — | `{ ok: true }` |
| POST | `/datasources/:id/test` | Test connection | Optional override config | `{ ok: true, latencyMs }` |
| POST | `/datasources/:id/query` | List objects | `ObjectStorageQuery` | `{ objects: [...], truncated: boolean }` |
| POST | `/datasources/:id/upload` | Upload file(s) | Multipart form with metadata | `{ uploaded: [...] }` |
| DELETE | `/datasources/:id/objects` | Delete objects | `{ keys: string[] }` | `{ deleted: [...] }` |

#### 12.4.2 MongoDB Schema

```js
// Datasources collection
{
  _id: ObjectId,
  type: "aws-s3" | "gcs" | "s3-compatible",
  name: string,
  userId: string,  // Owner reference
  config: {
    // Provider-specific encrypted config
    aws_s3: {
      accessKeyId: string,     // Encrypted
      secretAccessKey: string, // Encrypted
      region: string,
      bucket: string
    },
    gcs: {
      serviceAccountJson: string, // Encrypted
      projectId: string,
      bucket: string
    },
    s3_compatible: {
      endpoint: string,
      accessKeyId: string,     // Encrypted
      secretAccessKey: string, // Encrypted
      bucket: string,
      region?: string
    }
  },
  status: {
    lastTest: Date,
    healthy: boolean,
    error?: string,
    latencyMs?: number
  },
  createdAt: Date,
  updatedAt: Date
}

// Saved Queries collection (enhanced for object storage)
{
  _id: ObjectId,
  name: string,
  userId: string,
  datasourceId: ObjectId,
  queryType: "sql" | "mongodb" | "object-storage",
  query: ObjectStorageQuery | QueryAST,
  createdAt: Date,
  updatedAt: Date,
  lastRun?: Date,
  runCount: number
}
```

### 12.5 Frontend Component Enhancements

#### 12.5.1 Datasource Configuration UI
Enhanced configuration forms for each provider:

```tsx
// AWS S3 Configuration
interface AWSS3Config {
  accessKeyId: string
  secretAccessKey: string
  region: string
  bucket: string
}

// GCS Configuration  
interface GCSConfig {
  serviceAccountJson: string  // JSON key file content
  projectId: string
  bucket: string
}

// S3-Compatible Configuration
interface S3CompatibleConfig {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  region?: string
}
```

#### 12.5.2 Enhanced S3Explorer Component

```tsx
interface S3ExplorerProps {
  datasourceId?: string
  query?: Partial<ObjectStorageQuery>  // Query-based folder navigation
  
  // Navigation features
  enableNavigation?: boolean
  showBreadcrumbs?: boolean
  enableUpload?: boolean
  enableDelete?: boolean
  
  // Display options
  viewMode?: 'list' | 'grid' | 'tree'
  showMetadata?: boolean
  sortBy?: 'name' | 'size' | 'modified'
  sortOrder?: 'asc' | 'desc'
  
  // Event handlers
  onFileSelect?: (file: S3Object) => void
  onFolderNavigate?: (path: string) => void
  onUploadComplete?: (files: S3Object[]) => void
  onError?: (error: string) => void
}
```

### 12.6 File Upload Implementation

#### 12.6.1 Upload API
```ts
// POST /datasources/:id/upload
interface UploadRequest {
  files: File[]           // Multipart form files
  prefix?: string         // Target folder path
  overwrite?: boolean     // Overwrite existing files
  metadata?: Record<string, string>  // Custom metadata
}

interface UploadResponse {
  uploaded: Array<{
    key: string
    size: number
    etag: string
    url?: string  // Public URL if applicable
  }>
  errors?: Array<{
    file: string
    error: string
  }>
}
```

#### 12.6.2 Upload Component
```tsx
const S3Uploader: React.FC<{
  datasourceId: string
  targetPath?: string
  onUploadComplete?: (files: S3Object[]) => void
}> = ({ datasourceId, targetPath, onUploadComplete }) => {
  // Drag & drop file upload with progress
  // Support multiple files
  // Show upload progress per file
  // Handle errors gracefully
}
```

### 12.7 Navigation Features

#### 12.7.1 Folder Navigation
- Breadcrumb navigation showing current path
- Click folders to navigate deeper
- Back/up navigation
- URL-based deep linking to specific paths

#### 12.7.2 Query-Based Exploration
Users can define queries to explore specific portions of buckets:
- Set prefix to start in a specific "folder"
- Apply filters (file type, size, date ranges)
- Save common navigation patterns as queries

### 12.8 Security Considerations

#### 12.8.1 Credential Management
- All cloud provider credentials encrypted at rest in MongoDB
- Credentials never returned to frontend
- Support IAM roles for AWS (future)
- Support service account impersonation for GCS (future)

#### 12.8.2 Access Control
- Per-datasource access control (future)
- Upload/delete permissions configurable per datasource
- File size limits configurable
- Allowed file type restrictions

