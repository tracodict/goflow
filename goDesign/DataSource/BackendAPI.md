# Backend API Detailed Specification

Status: Draft v0.1
Base Prefix: `/api/ds`
All responses JSON. Auth: existing session cookie middleware.
Errors: non-2xx -> `{ error: { message, code?, details? } }`.

## 1. Datasource Endpoints

### 1.1 Create
POST /datasources
```json
{
  "type": "mongo",
  "name": "Primary Mongo",
  "config": { "uri": "mongodb+srv://...", "database": "app" }
}
```
Response 201:
```json
{ "id":"ds_123","name":"Primary Mongo","type":"mongo" }
```

### 1.2 List
GET /datasources
```json
{ "datasources": [ {"id":"ds_123","name":"Primary Mongo","type":"mongo"} ] }
```

### 1.3 Get Detail
GET /datasources/:id
```json
{ "id":"ds_123","name":"Primary Mongo","type":"mongo","configPublic": {"database":"app"} }
```

### 1.4 Update
PATCH /datasources/:id
Body: partial (same shape as create config) – secrets rotated fully if present.
Response 200: `{ "id":"ds_123" }`

### 1.5 Delete
DELETE /datasources/:id -> `{ "ok": true }`

### 1.6 Test
POST /datasources/:id/test
Body optional override: `{ "override": {"uri":"..."} }`
Response: `{ "ok": true, "latencyMs": 42 }`

### 1.7 Structure
GET /datasources/:id/structure?refresh=1
Mongo Response:
```json
{ "structure": { "databases": [ { "name":"app","collections":[{"name":"users","sampleFields":[{"path":"_id","type":"ObjectId"}]} ] } ] } }
```

## 2. Query Endpoints

### 2.1 Create Saved Query
POST /queries
```json
{ "name":"List Users", "ast": { /* QueryAST */ } }
```
Response: `{ "id":"q_456","name":"List Users" }`

### 2.2 Get / Update
GET /queries/:id -> `{ "id":"q_456","name":"List Users","ast":{...} }`
PATCH /queries/:id -> `{ "id":"q_456" }`

### 2.3 Execute Saved
POST /queries/:id/run
```json
{ "params": { "email":"alice@example.com" } }
```
Response:
```json
{ "columns":[{"name":"email","type":"string"}],"rows":[{"email":"alice@example.com"}],"meta":{"executionMs":7,"datasourceId":"ds_123"} }
```

### 2.4 Execute Ad-hoc
POST /query/execute
```json
{ "ast": { /* QueryAST */ }, "params": { } }
```
Same response envelope.

## 3. Mock Support
If `DATASOURCE_MOCK_ENABLED=1` and request header `X-Datasource-Mock=1` or query `?mock=1`:
- Bypass real driver.
- Use seeded dataset provider.

Mock endpoints:
GET /mock/datasets -> `{ "datasets":["sample_mongo_basic"] }`
POST /mock/seed `{ "dataset":"sample_mongo_basic" }` -> `{ "ok":true }`

## 4. Error Codes (Proposed)
| Code | Meaning | Typical HTTP |
|------|---------|--------------|
| DS_NOT_FOUND | Datasource missing | 404 |
| DS_INVALID_CONFIG | Validation failure | 400 |
| DS_AUTH_FAILED | Connection auth error | 401/400 |
| DS_UNREACHABLE | Network/connectivity | 502 |
| QUERY_INVALID | AST validation fail | 400 |
| QUERY_EXEC_ERROR | Runtime DB error | 500 |
| MOCK_DISABLED | Mock requested but disabled | 403 |

## 5. Rate Limits (Advisory)
- Test endpoint: 10 / minute / datasource / user.
- Execute: 60 / minute / user (Phase 1 simple; enforce by middleware later).

## 6. Security Considerations
- Reject raw pipeline containing `$where` (Mongo) by default (config flag later).
- Limit document size in response (stream + truncate after N MB future).
- Parameter substitution only for literal values (no field name injection).

## 7. Versioning
- Prefix future breaking fields with `_` or add `v` query parameter if necessary; initial version unversioned.

END
