# ReAct Agent E2E: ChatTemplate → Messages → ChatModel → Tools → Answer

This guide walks through an end-to-end flow using the example CPN `docs/tests/llm-react.json`:
- Define a chat template (system + chat_history placeholder + user message).
- Construct final messages sent to the chat model.
- Configure and run the chat model via environment variables.
- Maintain tools in a persisted Tool Catalog (including MCP httpstream tools).
- Configure and use a ReAct loop combining LLM and tools.

> Note: Tool Catalog APIs are part of the design and may be implemented in a follow-up PR. This guide shows the intended usage.

## 0) Start server

```bash
export MONGO_URI="mongodb://localhost:27017"
export MONGO_DB="go_petri_flow_llm_react"
export LLM_MODEL_PROVIDER=groq
export LLM_MODEL_TYPE=OpenAI
export LLM_MODEL_NAME="openai/gpt-oss-120b"
export LLM_MODEL_BASE_URL="https://api.groq.com/openai/v1"
export LLM_MODEL_API_KEY="<your_api_key>"

export FLOW_SVC="http://localhost:8082"
./bin/server -noauth -port 8082 &
```

## 1) Load ReAct CPN with ChatTemplate

```bash
curl -sS -X POST {$FLOW_SVC}/api/cpn/load \
	-H 'Content-Type: application/json' \
	--data-binary @docs/tests/llm-react.json | jq
```

## 2) Create and start a case

```bash
curl -sS -X POST {$FLOW_SVC}/api/cases/create \
	-H 'Content-Type: application/json' \
	-d '{"id":"case-react-1","cpnId":"llm-react","name":"ReAct Demo"}' | jq

curl -sS -X POST {$FLOW_SVC}/api/cases/start?id=case-react-1 | jq
```

## 3) Tool Catalog: register tools (HTTP and MCP httpstream)

Register a DuckDuckGo web search tool (name must match LlmTools in llm-react.json):
```bash
curl -sS -X POST {$FLOW_SVC}/api/tools/register \
	-H 'Content-Type: application/json' \
	-d '{
		"id":"duckduckgo_search",
		"name":"duckduckgo_search",
		"type":"http",
		"description":"DuckDuckGo web search",
		"inputSchema": {"type":"object","properties":{"q":{"type":"string"}},"required":["q"]},
		"outputSchema": {"type":"object"},
		"config": {"method":"GET","url":"https://api.duckduckgo.com/?q={q}&format=json&no_redirect=1&no_html=1", "headers":{"Accept":"application/json"},"timeoutMs":8000},
		"enabled": true
	}' | jq
```

Discover tools from a real MCP httpstream server and register Yahoo Finance tools:

First, discover tools from the MCP server over SSE using the helper CLI (HTTP tools/list endpoint is not exposed):
```bash
go build -o ./bin/mcp-list ./cmd/mcp-list
./bin/mcp-list -base https://data.lizhao.net/api/mcp -o /tmp/mcp-tools.json
jq '.tools[] | {name, inputSchema}' /tmp/mcp-tools.json
```

Register the yahoo_quote tool into the Tool Catalog using the discovered schema:
```bash
curl -sS -X POST {$FLOW_SVC}/api/tools/register \
	-H 'Content-Type: application/json' \
	-d '{
		"id":"yahoo_quote",
		"name":"yahoo_quote",
		"type":"mcp-httpstream",
		"description":"Get essential symbol information via MCP",
		"inputSchema": {
			"type":"object",
			"properties":{
				"symbol":{"anyOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}]},
				"options":{"type":"object","properties":{"fields":{"type":"array","items":{"type":"string"}},"return":{"type":"string","enum":["object","array"]}},"additionalProperties":false}
			},
			"required":["symbol"],
			"additionalProperties":false,
			"$schema":"http://json-schema.org/draft-07/schema#"
		},
		"config": {
			"baseUrl":"https://data.lizhao.net/api/mcp",
			"toolName":"yahoo_quote"
		},
		"enabled": true
	}' | jq
```

Optionally register other Yahoo Finance tools (search, historical, chart, etc.) using their schemas from the same list.

Add an MCP httpstream example (generic calc):
```bash
curl -sS -X POST {$FLOW_SVC}/api/tools/register \
	-H 'Content-Type: application/json' \
	-d '{
		"id":"mcp-calc",
		"name":"mcp-calc",
		"type":"mcp-httpstream",
		"description":"MCP calc over httpstream",
		"config": {"baseUrl":"https://mcp.example/stream","headers":{"Authorization":"Bearer ${MCP_TOKEN}"}},
		"enabled": true
	}' | jq
```

List tools:
```bash
curl -sS {$FLOW_SVC}/api/tools/list | jq
```

Test tools (dry-run):
```bash
# HTTP tool
curl -sS -X POST {$FLOW_SVC}/api/tools/test \
	-H 'Content-Type: application/json' \
	-d '{"id":"duckduckgo_search","input":{"q":"fast llm inference"}}' | jq

# MCP Yahoo quote
curl -sS -X POST {$FLOW_SVC}/api/tools/test \
	-H 'Content-Type: application/json' \
	-d '{"id":"yahoo_quote","input":{"symbol":["AAPL","MSFT"],"options":{"fields":["symbol","regularMarketPrice","regularMarketChangePercent"],"return":"array"}}}' | jq
```

## 4) Define chat template and construct messages

`llm-react.json` uses a JSON `LlmTemplate`:
```json
{
	"messages": [
		{"type": "system", "text": "You are a research assistant. Provide concise, accurate answers."},
		{"type": "placeholder", "key": "chat_history", "append": true},
		{"type": "user", "text": "Question: {q}"}
	]
}
```

At runtime, the engine resolves variables and injects history to produce final messages, e.g.:
```json
[
	{"role":"system","content":"You are a research assistant. Provide concise, accurate answers."},
	{"role":"user","content":"Question: What are the top 3 recent papers about fast inference of LLMs?"}
]
```

## 5) Configure ChatModel and run

The server reads env vars to configure an OpenAI-compatible client. To trigger the LLM step:
```bash
curl -sS -X POST {$FLOW_SVC}/api/tokens/enabled \
	-H 'Content-Type: application/json' \
	-d '{"tokens":[{"caseId":"case-react-1","placeId":"p_q"}]}' | jq

# Suppose transition id is "t_llm" and a binding exists; fire it via /api/tokens/fire using the token value matching.
curl -sS -X POST {$FLOW_SVC}/api/tokens/fire \
	-H 'Content-Type: application/json' \
	-d '{
		"caseId": "case-react-1",
		"transitionId": "t_llm",
		"tokenPlaceId": "p_q",
		"tokenValue": "What are the top 3 recent papers about fast inference of LLMs?"
	}' | jq
```

If the LLM returns `tool_calls`, they are emitted to `p_calls` by `t_llm`.

## 6) ReAct: execute tools and loop

Execute the tools transition (auto or manual, depending on your implementation):
```bash
curl -sS '{$FLOW_SVC}/api/cases/transitions/enabled?id=case-react-1' | jq
```

If `ExecuteTools` is manual, fire it:
```bash
curl -sS -X POST {$FLOW_SVC}/api/cases/fire \
	-H 'Content-Type: application/json' \
	-d '{"caseId":"case-react-1","transitionId":"t_tools","bindingIndex":0}' | jq
```

Tool execution semantics (by design):
- Resolve each tool call to a Tool Catalog entry (`search-web`, `mcp-calc`, ...).
- Execute: http tool via templated request; mcp-httpstream via streaming session.
- Produce a "tool" message (role=tool) to `p_toolmsg`.
- Loop back into `t_llm` by consuming `p_toolmsg` as part of history.

Repeat until the LLM no longer produces tool_calls or a max step limit is reached. Then the final `answer` is emitted to `p_ans`.

## 7) Inspect final answer

```bash
curl -sS '{$FLOW_SVC}/api/marking/get?cpnId=llm-react' | jq
```

You should see a token in place `p_ans`.

## Notes
- Secrets: keep API keys in env or a vault; do not persist in the Tool Catalog.
- MCP discovery: mcp-httpstream tools can expose a capabilities endpoint; the Tool Catalog may optionally cache tool schemas for validation. Example discovery endpoint used above: https://data.lizhao.net/api/mcp/tools/list
- Streaming: you can disable streaming initially; add SSE later for manual steps.
