# RAG Retriever Transition Design

## Overview
Add a new transition kind `Retriever` enabling a workflow to perform Retrieval-Augmented Generation (RAG) style document fetch within the Petri engine. A Retriever transition invokes an Eino retriever component (implementing `Retrieve(ctx, query string, opts ...Option) ([]*schema.Document, error)`) to obtain documents for a textual query taken from input tokens. The retrieved documents are emitted as a JSON token for downstream LLM transitions or other processing.

## Goals
- Simple integration: minimal required config in workflow JSON.
- Deterministic auto-fire semantics similar to `Tools` and `LLM` kinds.
- Pluggable retriever provider (Dify now, others later) with environment-driven runtime configuration.
- Safe JSON encoding of retrieved documents (array of {id, content, metadata}).
- Testability with mock retriever.

## Non-Goals (Now)
- Multi-query batch retrieval.
- Re-ranking pipelines or hybrid fusion logic.
- Incremental streaming of documents.
- Caching layer (can be layered later via Tools or Auto transition).

## Transition Model Additions
Extend `internal/models/transition.go`:
```go
const (
    ...
    TransitionKindRetriever TransitionKind = "Retriever"
)

type Transition struct {
    ...
    // Retriever-specific
    RetrieverProvider string            `json:"RetrieverProvider,omitempty"` // e.g. "dify" (future: "milvus", "vikingdb", etc.)
    RetrieverOptions  map[string]string `json:"RetrieverOptions,omitempty"`  // Optional per-transition overrides (e.g., topK)
    RetrieverQueryVar string            `json:"RetrieverQueryVar,omitempty"` // Name of bound input variable holding query text (defaults: first IN arc variable)
}
```

## Semantics
- Auto-fire: `IsAuto()` updated OR add explicit helper `IsRetriever()` and include in engine auto candidate set.
- Input arcs: At least one IN arc providing the query string variable. If `RetrieverQueryVar` empty, engine selects the first IN arc variable.
- Output arcs: One or more OUT arcs referencing variable `retrieved` (engine-defined) or a Lua transform thereof.
- Retrieved document structure (internal):
```go
type RetrievedDoc struct { ID string `json:"id"`; Content string `json:"content"`; Meta map[string]any `json:"metadata,omitempty"` }
```
Engine marshals `[]RetrievedDoc` into a plain Go slice of maps before feeding Lua / arc expressions.

## Runtime Configuration (Dify)
Environment variables (read at engine init or first use):
- `DIFY_ENDPOINT`
- `DIFY_DATASET_API_KEY`
- `DIFY_DATASET_ID`

Factory builds a Dify retriever if all present; otherwise transition firing errors (fail closed) producing log + no token.

## Registry
Add `internal/retriever` package with:
```go
type Interface interface { Retrieve(ctx context.Context, query string) ([]*schema.Document, error) }

func Get(provider string) (Interface, error)
```
Backed by lazy init for Dify provider using eino-ext component.

## Engine Changes
1. During evaluation loop, include Retriever transitions in auto-fire candidates.
2. Firing steps:
   - Bind query var value; coerce to string.
   - Acquire provider instance.
   - Call Retrieve with optional topK (parse from `RetrieverOptions["topK"]`).
   - Map documents -> slice of map[string]any {id, content, metadata} assigned to variable name `retrieved` in evaluation context.
   - Execute output arc expressions as usual.

## Error Handling
- Retrieval error: log, do not produce output token; transition may be retried later if guard remains true (idempotent assumption).
- Empty result: still emit empty list token (downstream LLM might handle fallback prompt).

## Test Plan
Unit test `retriever_transition_test.go`:
- Mock retriever returning two docs.
- Workflow with places: Query (string), Results (json).
- Insert query token; run engine step; assert Results place has one token with array length 2.
- Error path: mock returns error; assert no results token.

## Sample Workflow JSON (`docs/Guide/examples/RAG.json`)
```json
{
  "id": "rag-sample-1",
  "name": "Simple RAG Retrieval",
  "colorSets": [
    "colset STR = string;",
    "colset J = json;"
  ],
  "places": [
    { "id": "Query", "name": "Query", "colorSet": "STR" },
    { "id": "Results", "name": "Results", "colorSet": "J" }
  ],
  "transitions": [
    {
      "id": "t_retrieve",
      "name": "RetrieveDocs",
      "kind": "Retriever",
      "guardExpression": "query ~= nil and #query > 0",
      "RetrieverProvider": "dify",
      "RetrieverQueryVar": "query",
      "RetrieverOptions": { "topK": "5" }
    }
  ],
  "arcs": [
    { "id": "a_in_q", "sourceId": "Query", "targetId": "t_retrieve", "direction": "IN", "expression": "query" },
    { "id": "a_out_res", "sourceId": "t_retrieve", "targetId": "Results", "direction": "OUT", "expression": "return retrieved" }
  ],
  "initialMarking": {
    "Query": [ { "value": "What is RAG?", "timestamp": 0 } ]
  },
  "endPlaces": [ "Results" ]
}
```

## Future Extensions
- Multi-provider cascade (e.g., dense + sparse -> union).
- Re-ranker Auto transition template.
- Caching layer with TTL.
- Partial streaming of docs to support progressive LLM prompting.

## Open Questions
- Should retrieval errors block token consumption? (For now: they do not consume input token—leave it so transition can retry.)
- Consider guard-level rate limiting; out of scope for first pass.

## Environment Configuration & Sample

Set the following environment variables before running a workflow containing a `Retriever` transition with `RetrieverProvider: "dify"`:

```
export DIFY_ENDPOINT=https://your-dify-endpoint
export DIFY_DATASET_API_KEY=sk-xxxxx
export DIFY_DATASET_ID=dataset_xxxxx
```

Sample workflow JSON: see `docs/Guide/examples/RAG.json` (auto-fires `RetrieveDocs` and stores the result array in place `Results`).

Downstream LLM transition can consume the `Results` token via an IN arc expression variable (e.g., `docs`) and reference it inside template `{{docs}}`.

