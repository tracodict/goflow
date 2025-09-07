# LLM Integration Plan (Epics → Stories → Tests)

Aligned with GoEino.md and Eino docs, this plan drives LLM support in go-petri-flow.

## Epics

1) LLM Transition Execution
- Execute transitions of kind LLM by building messages and calling a provider.
- Output tokens match place color sets (string/json/product).

2) Provider Abstraction & Env Config
- Minimal Eino-like ChatModel interface.
- OpenAI-compatible default client with env configuration.

3) Template & Options
- Render messages via a simple ChatTemplate-like mechanism.
- Support temperature/topP/maxTokens/stop/model overrides.

4) Tools & Multi-turn (Phase 3)
- Optional tool calls and iterative loops.

5) Orchestration Parity Helpers (Phase 4)
- Builders to compile Eino-like chains/workflows to CPN.

## User Stories & Acceptance

Story A: As a developer, I can define an LLM transition and get a response token.
- Given env provider config, when t(kind=LLM) fires with a user query, then an answer token is produced.
- AC: No secrets persisted; logs show provider/model; errors don’t crash engine.

Story B: As an operator, I can configure provider via env.
- AC: LLM_MODEL_* envs set the default client; missing key returns clear error.

Story C: As a modeler, I can round-trip LLM fields in CPN JSON.
- AC: Transition JSON includes LlmTemplate, LlmVars, LlmOptions, LlmTools, Stream and survives parse→export.

Story D: As a tester, I can run unit tests and a curl e2e flow.
- AC: Unit tests pass (env loader, request shaping); a bash script shows how to load a demo CPN and interact.

## Detailed Tasks

T1. Extend Transition & Parser (Phase 1)
- Add LLM fields to Transition.
- Update CPN parser and serializer to round-trip fields.
- Tests: round-trip JSON with LLM fields.

T2. LLM Abstraction & Env Loader (Phase 1)
- Create internal/llm with BaseChatModel, Message, Options.
- Env loader reads LLM_MODEL_*.
- OpenAI-compatible client (Generate).
- Tests: env mapping, request payload via httptest.

T3. Engine hook (Phase 1.5)
- Introduce executor stub for LLM transitions (no-op by default, behind flag) to avoid breaking flows.
- Future PR wires actual call.

T4. E2E scripts (Phase 1)
- Bash scripts to load a sample CPN and call APIs; parameterized via env.

## Test Plan

Unit
- Env loader: defaults, overrides, validation.
- OpenAI client: shapes POST /chat/completions body correctly (model/messages/options).
- Parser round-trip for LLM fields.

Integration (later)
- LLM transition fires and emits token (with mocked provider).

## Rollout

- Phase 1 (this PR): T1, T2, T4 + unit tests. Engine wiring deferred.
- Phase 2+: Template resources, options, streaming.

## Risks
- Provider variability → normalize on OpenAI-compatible first.
- Secrets → env-only, never persisted.
