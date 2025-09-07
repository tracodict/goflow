## Storage & Persistence Execution Plan (Derived from Model v2.1)

Scope: Implement append-only event + compact state architecture robust for both long-lived and serverless deployments.

### Epic S1: Event & State Foundations (MVP Serverless Compatible)

User Story S1.1: Define Core Event Model
- Tasks:
	- S1.1.1 Draft Go structs (CaseEvent, TransitionEvent, TokenEvent, WorkItemEvent) with JSON/BSON tags.
	- S1.1.2 Enumerate event type constants.
	- S1.1.3 Implement canonical serialization (ensure stable hashing order).
- Tests:
	- S1.1.A Round-trip marshal/unmarshal equality.
	- S1.1.B Validation: unsupported type rejected.

User Story S1.2: Compact Case State Document
- Tasks:
	- S1.2.1 Define `CaseState` struct (caseId, workflowId, lastSeq, status, markingCompressed, variables, stateHash, updatedAt, version).
	- S1.2.2 Implement compression util (convert marking → multiset representation).
	- S1.2.3 Compute stateHash (sha256 canonical JSON).
- Tests:
	- S1.2.A Compression + expand returns original marking.
	- S1.2.B Hash changes when token added; unchanged when order differs.

User Story S1.3: Atomic Apply Operation
- Tasks:
	- S1.3.1 Define interface `CaseStateStore.Apply(caseID, opId, buildFn)`.
	- S1.3.2 Mongo implementation: transaction inserting events then conditional update of case_state with lastSeq.
	- S1.3.3 Idempotency (unique index (caseId, opId)).
- Tests:
	- S1.3.A Concurrent Apply (race) → exactly one success, other retries succeed.
	- S1.3.B Duplicate opId → second call returns existing state, no new events.
	- S1.3.C Crash simulation: abort transaction leaves no partial writes.

User Story S1.4: Engine Integration (Write Path)
- Tasks:
	- S1.4.1 Replace direct marking mutation in case manager with Apply wrapper.
	- S1.4.2 BuildFn constructs events + applies to in-memory clone to produce new state.
	- S1.4.3 FormData & hierarchy events emitted.
- Tests:
	- S1.4.A Fire transition via API persists TRANSITION_FIRED + TOKEN_CONSUMED/PRODUCED.
	- S1.4.B Hierarchical child completion emits SUBWORKFLOW_* events.

User Story S1.5: Read Path (Get State)
- Tasks:
	- S1.5.1 Implement GetState(caseId) from case_state.
	- S1.5.2 Fallback: reconstruct if missing (lookup events seq order).
- Tests:
	- S1.5.A Fresh case retrieval returns expected marking.
	- S1.5.B Missing state doc + events reconstructs identical state.

User Story S1.6: Persisted Workflow & Case Registry
- Rationale: After enabling event/state persistence, workflows (CPNs) and case metadata must also be durably stored so list & get APIs survive process restarts.
- Tasks:
	- S1.6.1 Introduce collections: `workflows` (cpnId, name, description, definitionJSON, createdAt) and `cases_meta` (caseId, cpnId, name, description, status, createdAt, startedAt, completedAt, variables subset) or reuse `case_state` for metadata reads.
	- S1.6.2 On LoadCPN API: upsert workflow document (idempotent) in Mongo when persistence enabled.
	- S1.6.3 On CreateCasePersisted: persist case metadata (either separate collection or extend existing state doc initial write) so `/api/cases/get` functions after restart before any transitions.
	- S1.6.4 Add `/api/cases/list` endpoint (simple list & pagination over in-memory or persisted store fallback to manager) returning case summaries.
	- S1.6.5 Wire server startup: if persistence enabled, warm in-memory manager from `case_state` (optional optimization later).
	- S1.6.6 Add abstraction for persistence detection to handlers (already partially via PersistedManager) to persist CPN metadata.
- Tests:
	- S1.6.A Load CPN then restart server (simulated) -> `/api/cpn/list` returns workflow.
	- S1.6.B Create case then restart -> `/api/cases/get?id=...` returns case.
	- S1.6.C `/api/cases/list` returns at least the created case.
	- S1.6.D Idempotent LoadCPN does not duplicate records.
	- S1.6.E Pagination on `/api/cases/list?limit=...&offset=...` stable.

### Epic S2: Query & Optimization (VIA – View / Inspect / Action)

Goal: Provide cross‑workflow visibility and actionable token-centric operations aligned to VIA pattern.

Scope Additions vs S1:
- New read/query endpoints (colors, tokens, enabled-per-token, fire wrapper).
- Token identity & hashing for stable references.
- Optional aggregation & grouping for UI tables.

Data Model Extensions:
- token_events: add fields { valueHash, color, producedTs, consumedTs? } (producedTs=existing ts, consumedTs from matching CONSUMED event, maintained via update or separate lookup).
- Indexes:
	1. token_events { color:1, producedTs:-1 }
	2. token_events { workflowId:1, caseId:1, placeId:1, producedTs:-1 }
	3. token_events { valueHash:1, workflowId:1, caseId:1 }
	4. transition_events { workflowId:1, caseId:1, transitionId:1, ts:-1 }
- In‑memory adjacency cache: placeId -> []transitionId (input arcs).

Deterministic Token Identity:
- Historical: Mongo _id of PRODUCED token_event.
- Live: synthetic id = sha256(workflowId|caseId|placeId|valueHash|firstProducedSeq).

New Endpoints:
1. GET  /api/colors/list
2. POST /api/tokens/query
3. GET  /api/tokens/inspect
4. POST /api/tokens/enabled
5. POST /api/tokens/fire (wrapper; convenience)

User Story S2.1: List Colors
- Tasks:
	- Aggregate distinct colors from workflows + token_events + (optional) live markings.
	- Param includeEmpty (default true) to hide colors with zero live & historical tokens.
	- Cache 30s (etag via sha256 of sorted color list + counts).
- Tests:
	- S2.1.A Newly loaded workflow color appears.
	- S2.1.B includeEmpty=false filters unused colors.

User Story S2.2: Token Query (Global View)
- Request (POST /api/tokens/query): filter (workflowIds, caseIds, placeIds, color, valueContains, status=LIVE|HIST|ANY, time range), group (keys, agg=count), sort, pagination (cursor).
- LIVE tokens from case_state (expand marking); HIST from token_events (PRODUCED records); unify for ANY.
- Cursor: base64(lastProducedTs,_id).
- Group executes aggregation pipeline; returns buckets + sample.
- Tests:
	- S2.2.A Color filter matches only selected color.
	- S2.2.B Pagination stable after mid-stream inserts.
	- S2.2.C Group counts match flat query.

User Story S2.3: Token Inspect
- GET /api/tokens/inspect?tokenId=...&workflowId=...&caseId=...
- Resolves lifecycle (produced, consumed) + current status + full value.
- Live tokens mapped via synthetic id then earliest event for provenance.
- Tests:
	- S2.3.A Live token shows produced only.
	- S2.3.B After consumption includes consumedTs.

User Story S2.4: Enabled Transitions per Token
- POST /api/tokens/enabled with array of token descriptors.
- For each: ensure workflow loaded; reconstruct case if needed; evaluate only transitions whose input arcs reference token’s place; return binding candidates.
- Tests:
	- S2.4.A Token in start place lists expected transition.
	- S2.4.B Consumed token yields none.

User Story S2.5: Fire Transition via Token Context
- POST /api/tokens/fire (fields: workflowId, caseId, transitionId, tokenBinding{placeId,value}, formData).
- Resolves bindingIndex by matching token value to candidate binding; delegates to existing fire logic.
- Tests:
	- S2.5.A Manual transition fires with formData.
	- S2.5.B Invalid tokenBinding returns 400.

User Story S2.6: Value Hashing & Large Payload Optimization
- Compute valueHash (sha256 canonical JSON) for every token; reuse in queries, synthetic IDs.
- Threshold-based blob externalization deferred to S3 (moved from old S2.3) to reduce scope.
- Tests:
	- S2.6.A Identical values share hash.
	- S2.6.B Query by valueHash returns all instances.

User Story S2.7: Multiset Compression (Deferred From Old S2.2)
- Introduce count in compressed marking only if empirical duplication > threshold; mark as stretch.
- Tests (conditional): same as prior S2.2.A/B when implemented.

User Story S2.8: State Integrity Verification (Moved From Old S2.4, now optional)
- CLI / verify endpoint to recompute stateHash from events; out of critical path.
- Tests: tamper detection.

Non-Functional Targets (S2):
- tokens/query p95 < 120ms at 100k events (indexed).
- tokens/enabled (50 tokens batch) p95 < 80ms with adjacency cache.
- colors/list p95 < 30ms (cached).

Risks & Mitigations:
- Large live token enumeration -> paginate & optional place filters.
- Expensive valueContains -> optional precomputed lower-cased field + index if hotspot.
- Transition enablement explosion -> adjacency pruning; cap tokens/enabled batch size.

Deliverables (S2):
- Handlers: colors_list.go, tokens_query.go, tokens_inspect.go, tokens_enabled.go, tokens_fire.go.
- Cache: adjacency_cache.go, colors_cache.go.
- Docs: CORE_APIs update; Model v2.2 additions (valueHash, tokenId spec).
- Tests: api_tokens_query_test.go, api_tokens_enabled_test.go, api_tokens_fire_test.go.

Out of Scope (push to S3+):
- Blob storage for large token values.
- Real-time subscriptions.
- Multiset compression (unless needed early for perf).

Completion Criteria:
- All new endpoints documented & passing tests.
- Query latency benchmarks recorded.
- ValueHash populated for new token events.

Unit Test Plan (Epic S2):
- colors/list
	- T_COLORS_01 Load single workflow -> returns its color set names.
	- T_COLORS_02 Load two workflows w/ overlapping color name -> deduplicated.
	- T_COLORS_03 Persistence enabled restart -> colors restored from workflows collection.
	- T_COLORS_04 includeEmpty=false hides color absent from any workflow (future when token events integrated).
- tokens/query (to implement later when token_events added)
	- T_TOKENS_01 Filter by color returns only matching tokens.
	- T_TOKENS_02 Pagination stable across insert between page fetches.
	- T_TOKENS_03 Group by color+workflowId counts match flat list.
	- T_TOKENS_04 status=LIVE excludes consumed tokens.
- tokens/inspect
	- T_INSPECT_01 Live token returns producedTs only.
	- T_INSPECT_02 After consumption returns consumedTs.
	- T_INSPECT_03 Unknown tokenId -> 404.
- tokens/enabled
	- T_ENABLED_01 Token at start place returns expected transition list.
	- T_ENABLED_02 Consumed (historical) token returns empty list.
	- T_ENABLED_03 Batch request (multiple tokens) returns parallel arrays, no duplication.
- tokens/fire
	- T_FIRE_01 Manual transition fired via tokenBinding (value match) succeeds.
	- T_FIRE_02 Invalid tokenBinding returns 400.
	- T_FIRE_03 Value mismatch (no binding) returns informative error.
- Value Hashing
	- T_HASH_01 Identical JSON values share valueHash.
	- T_HASH_02 Different JSON values produce distinct valueHash.
	- T_HASH_03 Query by valueHash (later) returns all matches.


### Epic S3: GraphQL & Advanced Sync

User Story S3.1: GraphQL Schema
- Tasks:
	- S3.1.1 Define schema (tokens, cases, transitionFirings, caseState).
	- S3.1.2 Implement resolvers translating to Mongo queries.
	- S3.1.3 Cursor-based pagination.
- Tests:
	- S3.1.A Schema introspection valid.
	- S3.1.B Resolver returns expected page order.

User Story S3.2: Subscriptions (Non-Serverless Mode)
- Tasks:
	- S3.2.1 WebSocket server bridging change streams to GraphQL subscription payloads.
	- S3.2.2 Fallback polling for serverless.
- Tests:
	- S3.2.A Subscription receives new transitions within SLA.
	- S3.2.B Polling fallback returns updated stateHash.

User Story S3.3: Leadership & High Contention
- Tasks:
	- S3.3.1 Implement `cases_leases` doc with TTL; Acquire/renew pattern.
	- S3.3.2 Only holder performs writes; others proxy or retry.
- Tests:
	- S3.3.A Two writers: only lease owner commits.
	- S3.3.B Lease expiration allows takeover.

### Epic S4: Observability & Maintenance

User Story S4.1: Metrics & Logging
- Tasks:
	- S4.1.1 Emit metrics (apply_latency_ms, conflicts, idempotent_hits, state_size_bytes).
	- S4.1.2 Structured logs for each Apply with opId, seqDelta.
- Tests:
	- S4.1.A Metrics present under load test.

User Story S4.2: Archival Pipeline
- Tasks:
	- S4.2.1 CLI task to move cold events (terminal cases) to object storage (JSON lines) + manifest.
	- S4.2.2 Remove archived events after verification.
- Tests:
	- S4.2.A Sample case archived; manifest lists counts.
	- S4.2.B Post-archive queries still reconstruct via restored path.

### Epic S5: Security & Idempotency Hardening

User Story S5.1: Idempotency Guarantees
- Tasks:
	- S5.1.1 Unique index (caseId, opId) with descriptive error mapping to 200 idempotent success.
	- S5.1.2 Middleware injecting opId if absent (UUID v7).
- Tests:
	- S5.1.A Rapid duplicate submits produce one event batch.

User Story S5.2: Data Protection
- Tasks:
	- S5.2.1 Optional field-level encryption for token payload values flagged sensitive.
	- S5.2.2 Key rotation procedure doc.
- Tests:
	- S5.2.A Encrypted field unreadable without key; decrypt path returns original.

### Cross-Cutting Non-Functional Goals
- Latency: Apply p95 < 30ms with local Mongo (target); test harness benchmark.
- Cold Start: GetState O(1) with median < 5ms plus network.
- Conflict Rate: <2% under simulated concurrent writes (10 parallel invocations on same case).

### Risk Mitigation Matrix
| Risk | Mitigation |
|------|------------|
| High contention causing retries | Backoff + lease (S3.3) |
| State doc bloat | Compression + hashing (S2.2/S2.3) |
| Replay cost in serverless | Compact state load (S1.2) |
| Duplicate processing | opId uniqueness (S1.3/S5.1) |
| Data corruption | stateHash + verification job (S2.4) |
| Large JSON tokens | Hash + blob store (S2.3) |

### Deliverables Summary
- New packages: `internal/storage/events`, `internal/storage/mongo`.
- Interfaces: CaseStateStore, EventAppender.
- CLI tools: verify-state, archive-events.
- Docs updates: CORE_APIs (token query), Model (version bump), README snippet.

---
End of StoragePlan
