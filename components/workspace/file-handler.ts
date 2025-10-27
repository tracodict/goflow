"use client"

declare global {
  interface Window {
    __goflowOpenFileHandlerInstalled?: boolean
  }
}

import { useWorkspace } from '@/stores/workspace-store'

export function handleFileOpen(path: string, extension: string) {
  const handlers: Record<string, (path: string) => void> = {
    'page': openPageBuilder,
    'ds': openDataSourceEditor,
    'qry': openQueryEditor,
    'cpn': openWorkflowEditor,
    'color': openSchemaEditor,
    'mcp': openMCPToolEditor
  }
  
  const handler = handlers[extension]
  if (handler) {
    handler(path)
  } else {
    console.warn(`No handler for file type: ${extension}`)
  }
}

function openPageBuilder(path: string) {
  // Load page definition and open in page builder
  const { files } = useWorkspace.getState()
  const file = files.get(path)
  
  if (file) {
    try {
      const maybeData = file.data
      const pageData = maybeData && typeof maybeData === 'object' ? maybeData : JSON.parse(file.content)
      // Dispatch to page builder
      window.dispatchEvent(new CustomEvent('goflow-load-page', {
        detail: { path, data: pageData }
      }))
    } catch (error) {
      console.error('Failed to parse page data:', error)
    }
  }
}

function openDataSourceEditor(path: string) {
  // Open data source in data tab
  window.dispatchEvent(new CustomEvent('goflow-switch-tab', {
    detail: { tab: 'data', file: path }
  }))
}

function openQueryEditor(path: string) {
  // Open query editor
  const { files } = useWorkspace.getState()
  const file = files.get(path)
  
  if (file) {
    try {
      const maybeData = file.data
      const queryData = maybeData && typeof maybeData === 'object' ? maybeData : JSON.parse(file.content)
      window.dispatchEvent(new CustomEvent('goflow-open-query', {
        detail: { path, data: queryData }
      }))
    } catch (error) {
      console.error('Failed to parse query data:', error)
    }
  }
}

function openWorkflowEditor(path: string) {
  // Open workflow (Petri net) editor
  const { files } = useWorkspace.getState()
  const file = files.get(path)
  
  if (file) {
    try {
      const maybeData = file.data
      const workflowData = maybeData && typeof maybeData === 'object' ? maybeData : JSON.parse(file.content)
      window.dispatchEvent(new CustomEvent('goflow-open-workflow', {
        detail: { path, data: workflowData }
      }))
    } catch (error) {
      console.error('Failed to parse workflow data:', error)
    }
  }
}

function openSchemaEditor(path: string) {
  // Open schema (color) editor
  const { files } = useWorkspace.getState()
  const file = files.get(path)
  
  if (file) {
    try {
      const maybeData = file.data
      const schemaData = maybeData && typeof maybeData === 'object' ? maybeData : JSON.parse(file.content)
      window.dispatchEvent(new CustomEvent('goflow-open-schema', {
        detail: { path, data: schemaData }
      }))
    } catch (error) {
      console.error('Failed to parse schema data:', error)
    }
  }
}

function openMCPToolEditor(path: string) {
  // Open MCP tool configuration editor
  const { files } = useWorkspace.getState()
  const file = files.get(path)
  
  if (file) {
    try {
      const maybeData = file.data
      const mcpData = maybeData && typeof maybeData === 'object' ? maybeData : JSON.parse(file.content)
      window.dispatchEvent(new CustomEvent('goflow-open-mcp-tool', {
        detail: { path, data: mcpData }
      }))
    } catch (error) {
      console.error('Failed to parse MCP tool data:', error)
    }
  }
}

// Listen for file open events
if (typeof window !== 'undefined' && !window.__goflowOpenFileHandlerInstalled) {
  window.__goflowOpenFileHandlerInstalled = true
  window.addEventListener('goflow-open-file', ((event: CustomEvent) => {
    const { path, extension } = event.detail
    handleFileOpen(path, extension)
  }) as EventListener)
}
