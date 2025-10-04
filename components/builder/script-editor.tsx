"use client"

import React, { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PlayCircle, Save, X, AlertCircle, CheckCircle } from 'lucide-react'
import { globalSandbox } from '../../lib/script-sandbox'
import { createMockEventContext } from '../../lib/sandbox-examples'
import type { ComponentEventInterface } from '../../lib/component-interface'

export interface ScriptEditorProps {
  /** Component interface definition */
  componentInterface: ComponentEventInterface
  /** Selected event name */
  eventName: string
  /** Current script content */
  script?: string
  /** Script type: event handler or action */
  scriptType: 'event' | 'action'
  /** Available action names for action scripts */
  actionName?: string
  /** Called when script changes */
  onScriptChange: (script: string) => void
  /** Called when script is saved */
  onSave: () => void
  /** Called when editor is closed */
  onClose: () => void
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  componentInterface,
  eventName,
  script = '',
  scriptType,
  actionName,
  onScriptChange,
  onSave,
  onClose
}) => {
  const [currentScript, setCurrentScript] = useState(script)
  const [testResult, setTestResult] = useState<{ success: boolean; result?: any; error?: string } | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const selectedEvent = componentInterface.events[eventName]
  const selectedAction = actionName ? componentInterface.actions[actionName] : null

  const generateScriptTemplate = () => {
    if (scriptType === 'event') {
      return `// Event: ${eventName}
// Description: ${selectedEvent?.description || 'Handle component event'}
function handle${eventName.charAt(0).toUpperCase() + eventName.slice(1)}(eventPayload, context) {
  // Event payload structure:
  ${selectedEvent ? `// ${JSON.stringify(selectedEvent.payload, null, 2).split('\n').map(line => `// ${line}`).join('\n  ')}` : '// No payload schema defined'}
  
  // 1. Create Action
  const action = context.createAction('${eventName.toUpperCase()}', {
    data: eventPayload,
    timestamp: Date.now(),
    componentId: context.component.id
  })
  
  // 2. Dispatch Action
  context.dispatch(action)
  
  // 3. Optional: Return immediate component updates
  return {
    componentUpdates: {
      [context.component.id]: {
        // Add immediate UI updates here
        // loading: true
      }
    }
  }
}`
    } else if (scriptType === 'action' && selectedAction) {
      return `// Action: ${actionName}
// Description: ${selectedAction.description || 'Execute component action'}
function execute${actionName ? actionName.charAt(0).toUpperCase() + actionName.slice(1) : 'Action'}(parameters, context) {
  // Parameters structure:
  ${`// ${JSON.stringify(selectedAction.parameters, null, 2).split('\n').map(line => `// ${line}`).join('\n  ')}`}
  
  // Execute action logic here
  const result = context.component.${actionName}(parameters)
  
  // Return result
  return result
}`
    }
    return '// Write your script here...'
  }

  const handleScriptChange = (value: string) => {
    setCurrentScript(value)
    onScriptChange(value)
    setTestResult(null) // Clear test results when script changes
  }

  const handleTest = async () => {
    setIsRunning(true)
    try {
      
      // Create mock context based on component interface
      const mockContext = createMockEventContext()

      // Create mock event payload for testing
      const mockEventPayload = selectedEvent ? {
        timestamp: Date.now(),
        componentId: 'test-component',
        ...generateMockDataForSchema(selectedEvent.payload)
      } : {}

      const result = await globalSandbox.executeScript('test-script', currentScript, mockContext, mockEventPayload)
      
      setTestResult({
        success: true,
        result: result
      })
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsRunning(false)
    }
  }

  const handleUseTemplate = () => {
    const template = generateScriptTemplate()
    setCurrentScript(template)
    onScriptChange(template)
  }

  const generateMockDataForSchema = (schema: any): any => {
    if (!schema || typeof schema !== 'object') return {}
    
    const mockData: any = {}
    if (schema.properties) {
      Object.keys(schema.properties).forEach(key => {
        const prop = schema.properties[key]
        switch (prop.type) {
          case 'string':
            mockData[key] = 'test-value'
            break
          case 'number':
            mockData[key] = 42
            break
          case 'boolean':
            mockData[key] = true
            break
          case 'object':
            mockData[key] = generateMockDataForSchema(prop)
            break
          case 'array':
            mockData[key] = []
            break
          default:
            mockData[key] = null
        }
      })
    }
    return mockData
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              Script Editor
              <Badge variant="secondary">
                {scriptType === 'event' ? eventName : `Action: ${actionName}`}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {scriptType === 'event' 
                ? selectedEvent?.description || 'Edit event handler script'
                : selectedAction?.description || 'Edit action script'
              }
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseTemplate}
            disabled={isRunning}
          >
            Use Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isRunning}
            className="flex items-center gap-1"
          >
            <PlayCircle className="h-4 w-4" />
            {isRunning ? 'Testing...' : 'Test Script'}
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isRunning}
            className="flex items-center gap-1"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Test Result Display */}
        {testResult && (
          <div className={`p-3 rounded-md border ${
            testResult.success 
              ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
              : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">
                {testResult.success ? 'Test Passed' : 'Test Failed'}
              </span>
            </div>
            {testResult.success && testResult.result && (
              <pre className="text-xs bg-black/5 dark:bg-white/5 p-2 rounded overflow-x-auto">
                {JSON.stringify(testResult.result, null, 2)}
              </pre>
            )}
            {!testResult.success && testResult.error && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {testResult.error}
              </p>
            )}
          </div>
        )}

        {/* Code Editor */}
        <div className="border rounded-md overflow-hidden">
          <CodeMirror
            value={currentScript}
            onChange={handleScriptChange}
            height="400px"
            extensions={[javascript()]}
            theme={oneDark}
            placeholder={generateScriptTemplate()}
          />
        </div>

        {/* Schema Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scriptType === 'event' && selectedEvent && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Event Payload Schema</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {scriptType === 'action' && selectedAction && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Action Parameters Schema</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(selectedAction.parameters, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Available Context API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-1">
                <div><code>context.component</code> - Component manipulation</div>
                <div><code>context.data</code> - Data access utilities</div>
                <div><code>context.createAction</code> - Create actions</div>
                <div><code>context.dispatch</code> - Dispatch actions</div>
                <div><code>context.utils</code> - Utility functions</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}