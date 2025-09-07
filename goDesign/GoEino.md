# Go Eino Flow — LLM Integration Design and Execution Plan

This document synthesizes the Eino materials in `docs/goDesign/eino/` and lays out a practical plan to support LLM-based workflows in go-petri-flow.

Goals
- First-class LLM transitions in CPNs, aligned with Eino’s ChatTemplate and ChatModel concepts.
- Environment-configurable providers and models (OpenAI-compatible endpoints, Groq, Azure OpenAI, Qwen, DeepSeek, Ollama, etc.).
- Patterns to mirror Eino’s Chain and Workflow orchestration with CPN constructs (places, transitions, arcs, subWorkflows).

References
- ChatModel: docs/goDesign/eino/core_modules/components/chat_model_guide.md
- ChatTemplate: docs/goDesign/eino/core_modules/components/chat_template_guide.md
- Eino overview and orchestration examples: docs/goDesign/eino/Eino.md

## 1) LLM Transition: contract and runtime

Transition kind: LLM
- We already support transition kinds (Auto, Manual, Message, LLM). Here we define LLM semantics.

Execution contract
- Inputs:
    - Context variables from incoming tokens (arc expressions bind variables like `q`, `doc`, etc.).
    - Optional conversation history collected from a designated place (e.g., `p_history`) or from work item notes.
    - Optional system and tool configuration.
- Process:
    - Build messages using an Eino-like ChatTemplate.
    - Invoke a ChatModel (provider configured via env or overridden per transition).
    - Optionally stream or non-stream; collect tool calls if enabled.
- Outputs:
    - Primary: assistant message content (string) or full Eino `schema.Message` as a JSON token (color set `json` or `json<Message>` if defined).
    - Secondary: metadata (usage, reason, tool_calls) optionally stored in a side place or work item.

TransitionJSON additions (non-breaking, optional)
- For `kind: "LLM"` transitions, allow:
    - `LlmTemplate`: string reference to a ChatTemplate resource (inline or external id). If omitted, fall back to a simple `{system?, user}` template.
    - `LlmVars`: map<string,string> variable mapping from binding variables to template variables.
    - `LlmOptions`: object with common options (temperature, topP, maxTokens, stop, model [overrides env]).
    - `LlmTools`: optional list of tool descriptors (names) if tool calling is desired (future phase).
    - `Stream`: bool to enable streaming (future phase; API surfaces SSE or chunked).

Minimal runtime behavior
1) On fire of an LLM transition, resolve variable bindings from input places (current engine logic already matches bindings via arc expressions).
2) Build messages:
     - If `LlmTemplate` is set, render via ChatTemplate with `LlmVars` inputs.
     - Else generate `{system? + user}` using a simple template: system from transition.ActionExpression (optional), user from bound input (e.g., `q`), or a small map `{query: ...}`.
3) Call ChatModel using env-configured provider (Section 2). For OpenAI-compatible providers, use Chat Completions.
4) Convert response to token(s):
     - If output place color set is `string`, emit `response.Content`.
     - If `json`/`json<Message>`, emit structured message (role, content, toolCalls, meta).
     - If a product type, map via ActionExpression (Lua) from response into the desired structure.

Error modes
- Provider/network error: transition fails with `invalid_request` and logs; no state change.
- Template rendering error: same handling.
- Type mismatch to output color set: validation error before commit; fail fire.

## 2) Provider configuration via environment

Environment variables
```bash
export LLM_MODEL_PROVIDER=groq # azure, qwen, deepseek, ollama, openai, etc.
export LLM_MODEL_TYPE=OpenAI  # OpenAI, Anthropic, DeepSeek, Qwen, etc.
export LLM_MODEL_NAME="openai/gpt-oss-120b"
export LLM_MODEL_BASE_URL="https://api.groq.com/openai/v1"
export LLM_MODEL_API_KEY="<secret>"
export LLM_REQUEST_TIMEOUT_MS=20000
```

Runtime mapping
- Build a provider registry that abstracts a minimal Eino-like `BaseChatModel` interface:
    - `Generate(ctx, []*Message, Options) (*Message, error)`
    - `Stream(ctx, []*Message, Options) (StreamReader[*Message], error)` (phase 2)
- Default implementation targets OpenAI-compatible Chat Completions. Many providers (Groq, Azure OpenAI, some Qwen gateways, DeepSeek OpenAI endpoints, Ollama via openai shim) fit this path via Base URL + API key.
- If `LLM_MODEL_TYPE` is non-OpenAI (e.g., Anthropic), switch to a provider-specific client.

Per-transition overrides
- `LlmOptions.model` can override `LLM_MODEL_NAME` for that transition only.
- Future: allow secrets via KMS or runtime vault instead of env.

Security and persistence
- API keys are never persisted. Keys come from env at runtime only.
- We can log provider name and model, but redact keys.

Example (Groq)
```bash
curl https://api.groq.com/openai/v1/chat/completions -s \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LLM_MODEL_API_KEY" \
    -d '{
        "model": "openai/gpt-oss-120b",
        "messages": [{"role": "user", "content": "Explain the importance of fast language models"}]
    }'
```

## 3) Using go-petri-flow to mirror Eino Chain and Workflow

Mapping to CPN constructs
- Chain (ChatTemplate -> ChatModel):
    - Represent as a single LLM transition if template is simple, or two transitions:
        1) Template transition (Auto) produces a `json<Message[]>` token of formatted messages.
        2) LLM transition consumes those messages and emits the assistant message.
- Graph/Agent (tool calls):
    - Add a Tools transition that reads `toolCalls` from the assistant message, executes tools, writes results, then loops back to an LLM transition for the next turn. Use arc expressions to branch on presence of tool calls.
- Workflow (field-level mapping):
    - Use typed color sets (`json<YourStruct>` or `product`) to model node inputs/outputs.
    - Use arc expressions to map fields (e.g., `out = {Query=in.Output, Meta=in.Meta}`) akin to Eino Workflow MapFields.
    - Compose complex flows via `subWorkflows` to mirror Eino’s higher-level workflows.

Example CPN snippet (inline template + LLM)
```json
{
    "transitions": [
        {
            "id": "t_prompt",
            "name": "BuildPrompt",
            "kind": "Auto",
            "actionExpression": "msgs = { {role='system', content='You are helpful.'}, {role='user', content=q} }"
        },
        {
            "id": "t_llm",
            "name": "Chat",
            "kind": "LLM",
            "LlmOptions": {"temperature": 0.2}
        }
    ],
    "arcs": [
        {"sourceId": "p_query", "targetId": "t_prompt", "expression": "q", "direction": "IN"},
        {"sourceId": "t_prompt", "targetId": "p_msgs", "expression": "msgs", "direction": "OUT"},
        {"sourceId": "p_msgs", "targetId": "t_llm", "expression": "msgs", "direction": "IN"},
        {"sourceId": "t_llm", "targetId": "p_answer", "expression": "answer", "direction": "OUT"}
    ]
}
```

Operational notes
- History management: dedicate a place for accumulating messages; arcs append history before LLM.
- Determinism: optionally pin timestamps, temperature, and seeds for tests.
- Observability: log provider/model and timing; optionally store response meta in a side place.

## 4) Execution plan

Phase 0: scaffolding
- Define internal interfaces aligning with Eino’s `BaseChatModel` and `ChatTemplate` (minimal subset needed now).
- Add env configuration loader for LLM provider/model.

Phase 1: core LLM transition
- Implement an LLM executor in the engine/API path invoked when `kind == LLM`.
- Message building: simple inline template support; variables come from binding.
- Provider support: OpenAI-compatible path reading env vars (works with Groq, Azure OpenAI with base URL, etc.).
- Output mapping: to `string` or `json<Message>` tokens.
- Tests: unit (template rendering, provider call stub), integration (CPN with one LLM step).

Phase 2: chat template + options
- Add ChatTemplate resource loading (file/db) and `LlmTemplate` rendering with `LlmVars`.
- Support common options (temperature, topP, stop, maxTokens); allow per-transition override.
- Add streaming option (internal API only initially) and SSE endpoint for manual transitions.

Phase 3: tools and multi-turn
- Add optional `LlmTools` node; on tool_calls, spawn a Tools transition; on completion, loop back to LLM.
- Introduce a simple tool registry (HTTP, CMD, MCP) to align with Eino tools docs.
- Provide a ready-made ReAct-like subWorkflow template.

Phase 4: Eino Workflow parity helpers
- Provide helper builders to compile Eino-like Chain/Workflow definitions into a CPN programmatically.
- Add examples mirroring Eino docs: simple chain, tool-call graph, and field-mapped workflow.

## 5) Acceptance & risks

Acceptance
- Can define a CPN with one LLM transition and get a non-empty, validated answer token using only env configuration.
- Can override model per transition.
- Can export/import the CPN without persisting secrets.

Risks / mitigations
- Provider heterogeneity: standardize on OpenAI-compatible first; branch to provider-specific when necessary.
- Token type mismatch: validate response mapping against place color sets before commit.
- Streaming complexity: start non-streaming; add streaming in a controlled API.

---

Appendix: environment configuration (recap)
```bash
export LLM_MODEL_PROVIDER=groq # azure, qwen, deepseek, ollama, openai, etc.
export LLM_MODEL_TYPE=OpenAI  # Anthropic, DeepSeek, Qwen, etc. when not OpenAI-compatible
export LLM_MODEL_NAME="openai/gpt-oss-120b"
export LLM_MODEL_BASE_URL="https://api.groq.com/openai/v1"
export LLM_MODEL_API_KEY="<secret>"
```



