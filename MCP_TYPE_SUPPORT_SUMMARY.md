# MCP Type Support & Direct Client Implementation - Summary

## Overview
This document summarizes the implementation of MCP transport type support and the refactoring from flow service calls to direct MCP client usage.

## Changes Implemented

### 1. Type Field Addition

#### `components/builder/mcp-utils.ts`
- **Added** `type?: 'STDIO' | 'SSE' | 'HTTP'` field to `McpEditorState` interface
- This field specifies the transport protocol for MCP communication

#### `components/builder/McpEditor.tsx`
- **Added** Transport Type dropdown in the UI (between Base URL and Timeout fields)
- **Updated** `updateField` function to include `type` in the allowed fields
- Default value is 'HTTP' if not specified
- Options: HTTP, SSE (Server-Sent Events), STDIO

### 2. File Data Parsing Fix

#### `app/api/mcp-cache/route.ts`
- **Fixed** file data extraction to properly unwrap `fileData.data` wrapper
- **Added** validation to ensure MCP config has required `baseUrl` field
- **Enhanced** logging to show config ID and tool count

**Before:**
```typescript
const content = fileData.data || ''
mcpConfigs[fileName] = content
```

**After:**
```typescript
const content = fileData.data || {}
if (typeof content !== 'object' || !content.baseUrl) {
  console.warn('[mcp-cache] Invalid MCP config in', fileName, '- missing baseUrl')
  continue
}
mcpConfigs[fileName] = content
```

### 3. MCP Client Refactoring

#### `lib/mcp-tools.ts`
**Major Changes:**
- **Replaced** flow service URL approach with direct MCP client configuration
- **Added** `McpClientConfig` interface with `baseUrl`, `type`, and `timeoutMs`
- **Refactored** `callTool()` to accept `McpClientConfig` instead of `flowServiceUrl`
- **Refactored** `getPrompt()` to accept `McpClientConfig` instead of `flowServiceUrl`
- **Implemented** HTTP transport with proper timeout handling
- **Added** placeholders for SSE and STDIO transport (to be implemented)

**New Signature:**
```typescript
export async function callTool(
  config: McpClientConfig,
  params: CallToolParams
): Promise<CallToolResponse>
```

**Old Signature:**
```typescript
export async function callTool(
  flowServiceUrl: string,
  params: CallToolParams
): Promise<CallToolResponse>
```

#### HTTP Transport Implementation
- Endpoint: `${baseUrl}/tools/call` for tools
- Endpoint: `${baseUrl}/prompts/get` for prompts
- Uses AbortController for timeout management
- Proper error handling for network issues and timeouts

### 4. Cache Updates

#### `lib/mcp-cache.ts`
- **Added** `type` and `timeoutMs` fields to `McpTool` interface
- **Added** `type` and `timeoutMs` fields to `McpPrompt` interface
- **Updated** `getEnabledTools()` to include type and timeoutMs from config
- **Updated** `getEnabledPrompts()` to include type and timeoutMs from config

### 5. Chat Route Integration

#### `app/api/chat/route.ts`
- **Updated** tool execution to pass MCP config object instead of flow service URL
- **Updated** prompt fetching to pass MCP config object instead of flow service URL

**Tool Execution (Before):**
```typescript
const result = await callTool(FLOW_SERVICE_URL, {
  endpoint: tool.baseUrl,
  name: tool.name,
  arguments: args
})
```

**Tool Execution (After):**
```typescript
const result = await callTool(
  {
    baseUrl: tool.baseUrl,
    type: tool.type,
    timeoutMs: tool.timeoutMs
  },
  {
    endpoint: tool.baseUrl,
    name: tool.name,
    arguments: args
  }
)
```

## Transport Types

### HTTP (Implemented)
- Default transport type
- Uses standard HTTP POST requests
- Endpoints: `/tools/call` and `/prompts/get`
- Includes timeout handling via AbortController

### SSE (Placeholder)
- Server-Sent Events for streaming responses
- Not yet implemented - throws error when selected

### STDIO (Placeholder)
- Standard input/output communication
- Requires command and args configuration
- Not yet implemented - throws error when selected

## Data Flow

### Before (Flow Service Approach)
```
Chat UI → POST /api/chat → callTool(flowServiceUrl) → 
  POST flowServiceUrl/api/tools/call_mcp_tool → MCP Server
```

### After (Direct Client Approach)
```
Chat UI → POST /api/chat → callTool(config) → 
  POST config.baseUrl/tools/call → MCP Server
```

## File Structure

### MCP File Format (.mcp files in GitHub workspace)
```json
{
  "id": "server-id",
  "name": "Server Name",
  "baseUrl": "http://localhost:8000/api/v1/mcp",
  "type": "HTTP",
  "timeoutMs": 8000,
  "tools": [...],
  "resources": [...],
  "prompts": [...],
  "resourceTemplates": [...]
}
```

## Testing Notes

### Manual Testing Required
1. Test HTTP transport with existing MCP servers
2. Verify timeout handling works correctly
3. Test UI dropdown persistence to GitHub
4. Verify cache loading includes type field
5. Test tool execution with different transport types

### Unit Tests to Update
- `tests/mcp-tools.test.ts` needs updating for new `callTool` signature
- Should test HTTP transport timeout behavior
- Should test error handling for unsupported transports

## Future Enhancements

### SSE Transport
- Implement Server-Sent Events handling
- Support streaming responses
- Add reconnection logic

### STDIO Transport
- Add command/args configuration fields to UI
- Implement process spawning and stdio communication
- Handle process lifecycle management

### Error Handling
- Add retry logic for transient failures
- Implement circuit breaker pattern
- Add detailed error messages for debugging

## Breaking Changes

### API Changes
- `callTool()` signature changed - first parameter is now `McpClientConfig` instead of `string`
- `getPrompt()` signature changed - first parameter is now `McpClientConfig` instead of `string`
- Existing code calling these functions must be updated

### Migration Guide
If you have custom code calling these functions:

**Before:**
```typescript
import { callTool } from '@/lib/mcp-tools'

const result = await callTool('http://flow-service', {
  endpoint: 'http://mcp-server',
  name: 'toolName',
  arguments: {}
})
```

**After:**
```typescript
import { callTool } from '@/lib/mcp-tools'

const result = await callTool(
  {
    baseUrl: 'http://mcp-server',
    type: 'HTTP',
    timeoutMs: 8000
  },
  {
    endpoint: 'http://mcp-server',
    name: 'toolName',
    arguments: {}
  }
)
```

## Verification Checklist

- [x] Type field added to McpEditorState interface
- [x] UI dropdown added and functional
- [x] File data parsing fixed (unwraps `data` wrapper)
- [x] McpClientConfig interface defined
- [x] callTool refactored to use config
- [x] getPrompt refactored to use config
- [x] McpTool interface updated with type/timeoutMs
- [x] McpPrompt interface updated with type/timeoutMs
- [x] Cache methods updated to include type/timeoutMs
- [x] Chat route updated for tool execution
- [x] Chat route updated for prompt fetching
- [x] No compilation errors

## Known Limitations

1. **SSE Transport**: Not yet implemented
2. **STDIO Transport**: Not yet implemented
3. **Tests**: Unit tests need updating for new signatures
4. **Backward Compatibility**: Old code using flow service approach will break

## Recommendations

1. Update all existing .mcp files to include `"type": "HTTP"` field
2. Test thoroughly with real MCP servers
3. Implement SSE and STDIO transports as needed
4. Update documentation for MCP server configuration
5. Add integration tests for different transport types
