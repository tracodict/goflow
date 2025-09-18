# Tools transition: usage, validation, and integration tests

This guide explains how to use Tools transitions (built-in and MCP), how argument validation works, and how to try them via curl and integration tests.

## Build and test modes

- Default build: only MCP tools are available via the `mcp:` prefix (no eino-ext built-ins).
- Built-ins enabled: add the build tag `einoext`.
- Integration tests: add the build tag `integration` for live tests; they’re opt-in via env vars.

Examples:

- Build:
	- `go build ./...`
	- `go build -tags einoext ./...`
- Unit Tests:
	- `go test ./...` (no built-ins)
	- `go test -tags einoext ./...` (includes Tools unit tests with deterministic stubs)
- Integration Tests (real built-ins/MCP; opt-in):
	- `go test -tags "einoext integration" ./...` (offline httprequest test runs; others skip)
	- `ENABLE_DDG_INTEGRATION=1 go test -tags "einoext integration" ./...` (enable DuckDuckGo)
	- `ENABLE_MCP_INTEGRATION=1 MCP_ENDPOINT=https://data.lizhao.net/api/mcp go test -tags "einoext integration" ./...` (enable MCP Yahoo Finance tests)

## Modeling Tools in CPN

Transition with a single built-in tool (with optional config):

```json
{
	"id": "t_tools",
	"name": "Search",
	"kind": "Tools",
	"Tools": [
		{ "name": "duckduckgo", "config": {}}
	]
}
```

Transition mixing a built-in and an MCP tool:

```json
{
	"id": "t_mix",
	"name": "Mix",
	"kind": "Tools",
	"Tools": [
		{ "name": "duckduckgo", "config": {} },
		{ "name": "mcp:https://your-mcp-endpoint/api/mcp:your_tool_name" }
	]
}
```

Notes:
- Single-tool transitions auto-synthesize a tool call from the first input token object.
- If input is already a tool-calls message, the engine validates and executes it as-is.
- Mixed sets preserve array order.
- If a tool’s inputSchema is known, arguments are validated before invocation.

### Tool arguments and validation

When a tool advertises an `inputSchema`, the engine validates the JSON args before invoking the tool.

Examples:
- `duckduckgo` expects something like `{ "query": "golang" }`.
- `httprequest_get` expects `{ "url": "https://example.com" }` and optional headers.
- MCP tools (e.g., Yahoo Finance) define their schema; see `docs/tests/llm-mcp-yf.json`.

The tool result is exposed as a message-like object on the context variable `tool_result`, which includes a `content` string containing the tool’s JSON response.

## HTTP API quick start

Assuming the server is running (`cmd/server`) and your case includes a Tools transition.

1) (Optional) Register MCP tools for discovery:

POST /api/tools/register-mcp

```json
{
	"id": "yf",
	"name": "Yahoo Finance MCP",
	"endpoint": "https://data.lizhao.net/api/mcp",
	"only": ["yahoo_quote"]
}
```

2) List tools for inspection:

GET /api/tools

3) Trigger a Tools transition by adding an input token matching the expected args.

Single `duckduckgo` transition input token:

```json
{"query": "golang"}
```

`tool_result` can be mapped to an output place using an output arc expression.

### Exact examples (duckduckgo + data.lizhao MCP)

- Minimal mixed CPN: see `docs/tests/llm-tools.json`. The Tools array includes a built-in DuckDuckGo tool with an empty config and an MCP Yahoo Finance tool:

```json
{
	"id": "t_tools",
	"name": "Search and Call",
	"kind": "Tools",
	"Tools": [
		{ "name": "duckduckgo", "config": {} },
		{ "name": "mcp:https://data.lizhao.net/api/mcp:yahoo_quote" }
	]
}
```

- Input token examples:
	- For DuckDuckGo: `{ "query": "golang" }`
	- For MCP Yahoo Quote: `{ "symbol": ["AAPL", "MSFT"] }`

Notes on configuration:
- Each built-in tool accepts a `config` object. Currently supported keys include:
	- duckduckgo: `tool_name`, `tool_desc` (optional; defaults provided by the tool)
- MCP tools do not use `config` here; their argument schema is enforced at call time.

## Example CPNs

- Minimal built-in + MCP mix: `docs/tests/llm-tools.json`
- MCP tool schemas: `docs/tests/llm-mcp-yf.json`
- ReAct-style demo integrating LLM + Tools: `docs/tests/llm-react.json`

## Integration tests

We include integration tests behind the `integration` tag:

- Local HTTP exercise of the real `httprequest_get` built-in (offline)
- Optional `duckduckgo` test (set `ENABLE_DDG_INTEGRATION=1`)
- Optional MCP Yahoo Finance test (set `ENABLE_MCP_INTEGRATION=1` and optionally `MCP_ENDPOINT`)

Run:

```
go test -tags "einoext integration" ./...
ENABLE_DDG_INTEGRATION=1 go test -tags "einoext integration" ./...
ENABLE_MCP_INTEGRATION=1 MCP_ENDPOINT=https://data.lizhao.net/api/mcp go test -tags "einoext integration" ./...
```

## Troubleshooting

- Unknown built-in tool: ensure you compiled with `-tags einoext`.
- MCP tool not found: verify the endpoint and tool name (`mcp:<endpoint>:<toolName>`) and server connectivity.
- Validation failure: fix the input JSON to match the tool’s `inputSchema`.
