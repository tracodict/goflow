# MCP Cache Usage Guide

## Overview

The MCP cache system loads `.mcp` configuration files from the `MCPTools/` folder in your workspace and provides fast access to MCP tools and prompts for the chat agent.

## How It Works

### 1. MCP Configuration Files

Store your MCP server configurations as `.mcp` files in the `MCPTools/` folder:

```
workspace/
  MCPTools/
    github.mcp
    filesystem.mcp
    custom-server.mcp
```

### 2. Cache Loading

The cache automatically loads when you send a chat message with a `workspaceId`:

```typescript
POST /api/chat
{
  "workspaceId": "tracodict-goflow-main",
  "messages": [...]
}
```

### 3. Manual Cache Loading

You can manually load the cache:

```bash
curl -X POST http://localhost:3000/api/mcp-cache \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": "tracodict-goflow-main"}'
```

Response:
```json
{
  "success": true,
  "message": "Loaded 3 MCP configurations from workspace",
  "data": {
    "totalConfigs": 3,
    "totalTools": 15,
    "totalPrompts": 5,
    "totalResources": 8
  }
}
```

### 4. Query Cache

Get cache statistics:
```bash
curl http://localhost:3000/api/mcp-cache?type=stats
```

Get all enabled tools:
```bash
curl http://localhost:3000/api/mcp-cache?type=tools
```

Get all enabled prompts:
```bash
curl http://localhost:3000/api/mcp-cache?type=prompts
```

## Example .mcp File Structure

```json
{
  "name": "GitHub MCP Server",
  "baseUrl": "http://localhost:3000/mcp/github",
  "enabled": true,
  "tools": [
    {
      "name": "search_repositories",
      "description": "Search GitHub repositories",
      "enabled": true,
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string" }
        }
      }
    }
  ],
  "prompts": [
    {
      "name": "code-review",
      "description": "Review code for quality",
      "enabled": true,
      "arguments": [
        {
          "name": "language",
          "description": "Programming language",
          "required": true
        }
      ]
    }
  ]
}
```

## Chat Integration

### Using MCP Prompts

```typescript
POST /api/chat
{
  "workspaceId": "github:haymant|flowtrade@goflow-1762411746032",
  "mcpPromptName": "setup_trading_workspace",
  "mcpPromptArgs": {
    "symbol": "AAPL"
  },
  "messages": [
    { "role": "user", "content": "Set up my trading workspace" }
  ]
}
```

### Using MCP Tools

Tools are automatically available to the LLM. The agent will use them as needed:

```typescript
POST /api/chat
{
  "workspaceId": "github:haymant|flowtrade@goflow-1762411746032",
  "messages": [
    { "role": "user", "content": "Get AAPL stock quote" }
  ]
}
```

The LLM will automatically call the `yahoo_quote` tool (from T1.mcp) or `ibkr_get_contract_details` tool (from IBKR.mcp) if they're enabled in the cache.

### Example: Trading Workflow

With the IBKR.mcp and T1.mcp files loaded, the chat agent can:

```typescript
POST /api/chat
{
  "workspaceId": "github:haymant|flowtrade@goflow-1762411746032",
  "messages": [
    { 
      "role": "user", 
      "content": "Connect to IBKR, get my portfolio positions, and show me the latest quote for AAPL" 
    }
  ]
}
```

The agent will automatically:
1. Call `ibkr_connect` tool
2. Call `ibkr_get_positions` tool
3. Call `yahoo_quote` tool with symbol "AAPL"
4. Format and return the results

## Workspace Providers

The system supports both GitHub and filesystem workspace providers:

- **GitHub**: Reads `.mcp` files from GitHub repository
- **Filesystem**: Reads `.mcp` files from local filesystem

Set via `WORKSPACE_PROVIDER` environment variable (`github` or `fs`).

## Troubleshooting

### No tools found

1. Check if `.mcp` files exist in `MCPTools/` folder
2. Verify files are valid JSON
3. Check if tools/prompts have `enabled: true` (or not explicitly `false`)
4. Manually load cache: `POST /api/mcp-cache` with workspaceId

### Cache not updating

The cache loads automatically on first chat request. To reload:
```bash
curl -X DELETE http://localhost:3000/api/mcp-cache  # Clear cache
curl -X POST http://localhost:3000/api/mcp-cache -d '{"workspaceId":"..."}' # Reload
```

### Authentication issues

The MCP cache endpoint (`/api/mcp-cache`) is public by default. Workspace file access respects authentication based on the workspace provider.
