# Simulation (Unified Case-Based API)

This document describes the unified simulation model introduced in vNext which replaces the legacy stateless endpoints under `/api/simulation/*`.

## Rationale

Previously simulation operated directly on an in-memory CPN marking via:

```
POST /api/simulation/step?id=<cpnId>
POST /api/simulation/steps?id=<cpnId>&steps=N
```

Limitations:
1. No durable identity for a simulation run (hard to compare, branch, or resume).
2. Mixed semantics with real case execution logic and no space to add metadata (seed, parameters, etc.).
3. Hard to persist or query historical simulation states.

## CaseMode

The `Case` model now includes a `Mode` field:

```
Mode: "run" | "sim"   (type CaseMode)
```

Production executions (user / workflow instances) use `run` (default). Simulation runs use `sim` and leverage the *same* engine pathways (marking, firing, completion detection) while remaining isolated for clarity.

Persistence (`CaseState`) stores `mode` (optional for backward compatibility: empty → `run`). Hash computation includes mode to differentiate states across modes.

## New Simulation Endpoints (All Authenticated Same As Other APIs)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sim/start` | POST | Create and immediately start a simulation case |
| `/api/sim/get?caseId=...` | GET | Fetch current simulation case state |
| `/api/sim/step` | POST | Execute one automatic firing layer (automatic transitions only) |
| `/api/sim/fire` | POST | Explicitly fire a single (typically Manual) transition |
| `/api/sim/run` | POST | Execute repeated automatic steps until quiescent/completed or step limit reached |
| `/api/sim/delete?caseId=...` | DELETE | Delete a terminated (or never-started) simulation case |

### Request / Response Schemas

`POST /api/sim/start`

Request body:
```
{
	"cpnId": "<required>",
	"caseId": "<optional – server generates sim-<ts> if omitted>",
	"name": "optional",
	"description": "optional",
	"variables": { ... }  // optional initial variables
}
```

Response:
```
{
	"success": true,
	"data": {
		"caseId": "sim-kt92...",
		"cpnId": "my-cpn",
		"status": "RUNNING",
		"mode": "sim",
		"currentStep": 0,
		"marking": { /* same shape as /api/cases/marking but inlined */ },
		"enabledTransitions": [
			{"id":"t1","name":"Auto1","kind":"Auto","bindingCount":1},
			{ "id":"t2","name":"ManualX","kind":"Manual","bindingCount":2 }
		]
	}
}
```

`POST /api/sim/step`
```
{ "caseId": "sim-kt92..." }
```
Executes exactly one automatic firing layer (all currently enabled Auto transitions, one binding each, deterministic order) and returns the updated case envelope.

`POST /api/sim/fire`
```
{ "caseId": "sim-kt92...", "transitionId": "tFill", "bindingIndex": 0, "formData": {"field":"value"} }
```
Fields:
* `caseId` (string, required)
* `transitionId` (string, required)
* `bindingIndex` (int, optional; defaults to 0 if omitted). Use when a Manual transition has multiple enabled bindings.
* `formData` (object, optional) – key/value pairs exposed to the transition's action function (Lua) via `formData` global.

Behavior:
1. Fires the specified transition (manual or other non-auto kinds you permit for experimentation) using the selected binding.
2. Automatically triggers the same auto cascade that would occur after a manual firing in a production run (i.e., repeatedly fires enabled Auto transitions until quiescent before responding).
3. Returns the full simulation case envelope (including updated marking and newly enabled transitions after cascade).

`POST /api/sim/run`
```
{ "caseId": "sim-kt92...", "stepLimit": 100 }  // stepLimit optional; <=0 means unlimited until quiescent or complete
```

`GET /api/sim/get?caseId=...` returns same case envelope.

`DELETE /api/sim/delete?caseId=...` returns `{ "deleted": "<caseId>" }` on success.

### Execution Semantics

Each simulation step fires all currently enabled automatic transitions (one binding per transition) in a deterministic order (sorted by transition ID) – identical to production case auto-execution logic.

`/api/sim/run` loops steps until:
1. Step limit reached (if provided), OR
2. A step fires zero transitions (quiescent), OR
3. The case becomes completed.

### Determinism & Future Work

Currently, determinism arises from sorted transition IDs and binding order. A future enhancement may introduce an optional seed parameter for randomized tie-breaking while still reproducible. The `Mode=sim` field allows such metadata to be tracked without affecting production runs.

## Legacy Endpoint & Behavior Deprecation

The old endpoints now return HTTP 410 Gone:

| Legacy | Now |
|--------|-----|
| `POST /api/simulation/step` | `POST /api/sim/step` with simulation case |
| `POST /api/simulation/steps` | `POST /api/sim/run` |

Migration path:
1. Call `/api/sim/start` (optionally capturing `caseId`).
2. Use `/api/sim/step` (automatic layers) and `/api/sim/fire` (manual/explicit transitions) or `/api/sim/run` for multiple automatic layers.
3. Fetch intermediate state with `/api/sim/get`.
4. Delete when finished with `/api/sim/delete`.

### Deprecated: Manual Fire Via `/api/sim/step`

Earlier preview builds temporarily allowed specifying `{"transitionId": "..."}` in the body of `/api/sim/step` to manually fire a transition. This overloading is now deprecated and will be removed in a future release. Replace any usage with `/api/sim/fire`.

Rationale for dedicated endpoint:
* Clear separation of explicit user intent (manual fire) vs. engine-driven progression (automatic layer).
* Simplifies client logic and avoids ambiguity around what constitutes a "step" when a manual transition is involved.

## Persistence Details

`CaseState` gains `mode` (string). When hydrating older records where `mode` is absent, the server defaults to `run` so existing data remains valid.

When a simulation is started through `/api/sim/start` on a persistence-enabled deployment the server writes a snapshot containing `mode=sim` *before* (or along with) the start event. This guarantees that after a process restart the case hydrates with `Mode=sim` and `/api/sim/get` continues to function (no `wrong_mode` error). A regression test (`TestSimulationPersistedMode`) asserts this contract at the API layer.

### Legacy Upgrade Heuristic

Early simulation cases (created before mode snapshots were persisted) may have been stored with `mode:"run"`. To avoid breaking those sessions, the simulation endpoints now apply a best-effort upgrade: if a case ID starts with `sim-` but reports `mode=run`, the server will persist an updated snapshot setting `mode=sim` on first `/api/sim/*` access. If persistence is unavailable the request still fails with `wrong_mode` (cannot safely mutate). This auto-heal path lets in-flight historical simulations continue without manual DB edits.

State hash input now includes a `mode=` line ensuring that simulation and production states with otherwise identical data produce different hashes (avoiding accidental cross-mode deduplication).

## Testing

`test/simulation_api_test.go` covers:
1. CPN load, simulation start, step, run, get, delete.
2. Manual transition firing via `/api/sim/fire` with automatic cascade validation.
3. Deprecated legacy endpoint (`/api/simulation/step`) returning 410.

Additional regression and determinism tests can be added as the random/seed feature is introduced.

`TestSimulationPersistedMode` validates that simulation mode is surfaced in the API response for a newly started simulation case and is intended to be extended to cover restart hydration scenarios once test harness includes a restart cycle.

## Example Flow

```
POST /api/cpn/load      # load a CPN definition
POST /api/sim/start {"cpnId":"order-cpn"} -> caseId: sim-abc
POST /api/sim/fire {"caseId":"sim-abc","transitionId":"tManual","formData":{"v":10}}
POST /api/sim/step {"caseId":"sim-abc"}
POST /api/sim/run {"caseId":"sim-abc","stepLimit":50}
GET  /api/sim/get?caseId=sim-abc
DELETE /api/sim/delete?caseId=sim-abc
```

## Future Extensions

Planned enhancements (not yet implemented):
1. `seed` parameter for controlled randomized selection of enabled transitions.
2. Snapshot listing: `/api/sim/list` (filter by cpnId, status).
3. Bulk run / parameter sweep support.
4. Batch manual fire endpoint (multi-transition speculative firing) for advanced UI tooling.

---
Maintainers: update this document when extending simulation parameters or persistence schema.

