# Query Builder Detailed Design

Status: Draft v0.1

Implementation Addendum (2025-09-27):
An initial ad-hoc execution slice is implemented separate from the full visual builder described below. Current capabilities:
- Unified POST /api/ds/datasources/:id/query route.
- Mongo: accepts raw aggregate pipeline JSON (textarea editor) and optional `collection` param.
- Postgres/MySQL: accepts raw SQL text; server appends LIMIT 200 if absent.
- Limits: 200 rows, ~1MB serialized cap (Mongo early break), execution time returned.
- Errors sanitized to avoid leaking credentials.
- Frontend Query tab includes datasource selector, editor (textarea placeholder for future CodeMirror), Run & Clear buttons, and a simple result grid.
- Zustand query store (`stores/query.ts`) tracks editor text, running state, result, error, and keeps last 50 executions in memory.

Deferred (still aligned with original design sections):
1. Visual builder panels (Source/Projection/Filter/etc.)
2. RawEditor generation from visual AST (currently only manual raw input path exists).
3. SQL translation from AST (not yet wired; only user-provided SQL executed).
4. Parameter binding & saved queries persistence.
5. CodeMirror integration for JSON + SQL with linting/autocomplete.
6. Explain / Analyze & pagination cursors.

This document will be revised to merge the minimal ad-hoc path with the planned full builder once the visual panels are implemented.

## 1. Purpose
Provide a unified visual + textual interface to construct a QueryAST (Mongo first, SQL later) without introducing new libraries beyond existing stack.

## 2. Panels
1. SourceSelector: choose datasource + collection/table.
2. ProjectionPanel: pick fields (multi select), optional alias.
3. FilterPanel: list of filter rows -> FilterNode.
4. SortPanel: ordering list.
5. PaginationPanel: limit / offset.
6. RawEditor: toggle view that shows generated representation (Mongo pipeline JSON or SQL). Phase 1: one-way (builder -> raw). Phase 2: partial parse back.
7. PreviewPanel: Executes ad-hoc and shows first page in embedded Table preview.

## 3. State Shape (Frontend)
```ts
interface QueryBuilderState {
  ast: QueryAST
  dirty: boolean
  executing: boolean
  result?: QueryResult
  error?: DatasourceError
}
```

## 4. Builder -> Mongo Translation
```ts
function buildMongoPipeline(ast: QueryAST): any[] {
  const pipeline: any[] = []
  if (ast.filters.length) pipeline.push({ $match: mongoMatch(ast.filters) })
  if (ast.projections.length) pipeline.push({ $project: projectDoc(ast.projections) })
  if (ast.sorts.length) pipeline.push({ $sort: sortDoc(ast.sorts) })
  if (ast.offset) pipeline.push({ $skip: ast.offset })
  if (ast.limit) pipeline.push({ $limit: ast.limit })
  return pipeline
}
```

## 5. Builder -> SQL Translation (Phase 2)
- SELECT <proj list or *> FROM schema.table
- [JOIN clauses]
- WHERE (filters)
- ORDER BY
- LIMIT/OFFSET

Filters convert with simple mapping:
| AST op | SQL | Mongo |
|--------|-----|-------|
| eq | = | { field: value } |
| ne | != | { field: { $ne: value } } |
| in | IN | { field: { $in: [...] } } |
| contains | LIKE %value% | { field: { $regex: value, $options: 'i' } } |
| between | BETWEEN a AND b | { field: { $gte:a,$lte:b } } |

## 6. Parameter Binding
- User can mark value as `{{paramName}}` -> stored literally in FilterNode.value as string; backend performs safe substitution only in value contexts.
- Backend receives AST + param dict -> final pipeline / SQL.

## 7. Validation
- Ensure source selected before execution.
- Limit enforced (default 100, max 1000) client-side.
- Disallow joins in Phase 1.

## 8. UI Components
- Use existing shadcn components (Select, Input, Badge) + small custom chips for filters.

## 9. Future Extensions
- Aggregation group builder.
- Join graph visual canvas.
- Derived fields (expressions) with limited sandboxed eval.

END
