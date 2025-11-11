# CPN Workflow Streaming API Design

## Overview

This design outlines how to wrap a CPN (Colored Petri Net) workflow's execution with a streaming API endpoint, enabling the `useStream` hook (from `components/chat/Chat.tsx`) to call it and receive streaming responses with each token produced during workflow execution.

## Backend API Endpoint Design

### Endpoint
- **URL**: `/api/workflow/execute`
- **Method**: POST
- **Content-Type**: `application/json`

### Request Body
```json
{
  "workflowId": "example-workflow",
  "inputs": { "key": "value" },
  "model": "cpn-executor"  // Optional, for consistency with chat API
}
```

### Response
- **Content-Type**: `text/event-stream` (Server-Sent Events)
- **Format**: Streaming SSE events or AIStream-compatible tokens
- **Events**:
  - `delta`: Incremental tokens/outputs from workflow execution
  - `error`: Error messages
  - `done`: Completion signal

## Backend Implementation (Go)

### Handler Structure
```go
package handlers

import (
    "encoding/json"
    "fmt"
    "net/http"
    "your-project/cpn"  // Import your CPN execution logic
)

// WorkflowExecuteRequest represents the API request
type WorkflowExecuteRequest struct {
    WorkflowID string                 `json:"workflowId"`
    Inputs     map[string]interface{} `json:"inputs"`
    Model      string                 `json:"model,omitempty"`
}

// WorkflowExecuteHandler handles streaming workflow execution
func WorkflowExecuteHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req WorkflowExecuteRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }

    // Set headers for SSE streaming
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.WriteHeader(http.StatusOK)

    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "Streaming not supported", http.StatusInternalServerError)
        return
    }

    // Load and execute the CPN workflow
    wf, err := cpn.LoadCPN(req.WorkflowID)
    if err != nil {
        sendSSE(w, "error", err.Error())
        return
    }

    // Execute workflow with a callback to stream each token/output
    err = wf.Execute(req.Inputs, func(token string) {
        // Stream each token as an SSE event (compatible with useStream)
        sendSSE(w, "delta", token)  // Or use AIStream format: fmt.Fprintf(w, "0:\"%s\"\n", escapedToken)
        flusher.Flush()
    })

    if err != nil {
        sendSSE(w, "error", err.Error())
    } else {
        sendSSE(w, "done", "")
    }
}

// Helper to send SSE events
func sendSSE(w http.ResponseWriter, eventType, data string) {
    fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, data)
}
```

### Key Implementation Notes
- The `wf.Execute` method should accept a callback function that yields tokens as they are produced during workflow execution.
- Use Server-Sent Events (SSE) for simplicity and compatibility with `useStream`.
- Alternatively, adapt to AIStream format (e.g., `0:"token"`) if preferred.
- Handle workflow loading errors, execution errors, and completion gracefully.

## Frontend Integration

### Extending `useStream` for Workflows
Create a variant of the `useStream` hook specifically for workflow execution:

```typescript
// In components/chat/Chat.tsx or a new file
function useWorkflowStream(onDelta: (delta: string) => void) {
  return async (workflowId: string, inputs: Record<string, any>) => {
    const res = await fetch('/api/workflow/execute', {
      method: 'POST',
      body: JSON.stringify({ workflowId, inputs }),
      headers: { 'content-type': 'application/json' },
    })
    
    if (!res.ok) throw new Error('Workflow execution failed')
    
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      
      // Parse SSE events (reuse logic from useStream)
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''  // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          try {
            const parsed = JSON.parse(data)
            if (parsed.delta) {
              onDelta(parsed.delta)
            }
          } catch {
            // Handle raw text or other formats
            onDelta(data)
          }
        }
      }
    }
  }
}
```

### Usage in Components
```typescript
const runWorkflow = useWorkflowStream((delta) => {
  // Append delta to UI, e.g., update a workflow output display
  setOutput(prev => prev + delta)
})

const onExecuteWorkflow = async () => {
  await runWorkflow('example-workflow', { inputKey: 'value' })
}
```

## Considerations

### Performance
- Ensure workflow execution is non-blocking and yields tokens efficiently to avoid buffering delays.
- Consider implementing backpressure if the workflow produces tokens faster than the client can consume them.

### Error Handling
- Stream errors as SSE events for immediate client-side feedback.
- Include timeout handling for long-running workflows.

### Security
- Validate workflow IDs and inputs to prevent unauthorized access or injection attacks.
- Implement rate limiting and authentication as needed.

### Testing
- Test with simple workflows that produce incremental outputs.
- Verify compatibility with existing `useStream` parsing logic.

## Integration with Existing Chat System

This design allows CPN workflows to be executed in a streaming manner, similar to AI chat responses. The `useWorkflowStream` hook can be integrated into the chat panel or other components to provide real-time feedback during workflow execution.</content>
<parameter name="filePath">/home/data/git/tracodict/goflow/goDesign/StreamServer.md
