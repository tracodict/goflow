/**
 * Example usage of Enhanced Button with Component Interface
 */

import React from 'react'
import { EnhancedButton } from './enhanced-button'
import type { InteractionEventPayload, BaseEventPayload, EventHandlerContext } from '@/lib/component-interface'

export function ButtonExample() {
  const handleButtonClick = React.useCallback((
    payload: InteractionEventPayload, 
    context: EventHandlerContext
  ) => {
    console.log('Button clicked!', payload)
    
    // Example: Show loading state
    context.component.callAction('setLoading', { loading: true, message: 'Processing...' })
    
    // Example: Show notification after delay
    setTimeout(() => {
      context.app.showNotification('Button action completed!', 'success')
      context.component.callAction('setLoading', { loading: false })
    }, 2000)
  }, [])

  const handleButtonMount = React.useCallback((
    payload: BaseEventPayload,
    context: EventHandlerContext
  ) => {
    console.log('Button mounted!', payload)
    context.utils.log('Button component initialized', 'info')
  }, [])

  const handleButtonUnmount = React.useCallback((
    payload: BaseEventPayload,
    context: EventHandlerContext
  ) => {
    console.log('Button unmounting!', payload)
    context.utils.log('Button component cleanup', 'info')
  }, [])

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Enhanced Button Examples</h2>
      
      <div className="space-y-2">
        <h3 className="text-md font-medium">Regular Button (no scripting)</h3>
        <EnhancedButton
          onClick={() => alert('Regular click handler')}
        >
          Regular Button
        </EnhancedButton>
      </div>

      <div className="space-y-2">
        <h3 className="text-md font-medium">Scriptable Button</h3>
        <EnhancedButton
          componentId="example-button-1"
          scriptable={true}
          onComponentClick={handleButtonClick}
          onComponentMount={handleButtonMount}
          onComponentUnmount={handleButtonUnmount}
        >
          Scriptable Button
        </EnhancedButton>
      </div>

      <div className="space-y-2">
        <h3 className="text-md font-medium">Button Variants</h3>
        <div className="flex gap-2 flex-wrap">
          <EnhancedButton variant="default" scriptable componentId="btn-default">
            Default
          </EnhancedButton>
          <EnhancedButton variant="secondary" scriptable componentId="btn-secondary">
            Secondary
          </EnhancedButton>
          <EnhancedButton variant="outline" scriptable componentId="btn-outline">
            Outline
          </EnhancedButton>
          <EnhancedButton variant="ghost" scriptable componentId="btn-ghost">
            Ghost
          </EnhancedButton>
          <EnhancedButton variant="destructive" scriptable componentId="btn-destructive">
            Destructive
          </EnhancedButton>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-md font-medium">Button States</h3>
        <div className="flex gap-2 flex-wrap">
          <EnhancedButton loading={true} loadingText="Loading...">
            Loading Button
          </EnhancedButton>
          <EnhancedButton disabled={true}>
            Disabled Button
          </EnhancedButton>
        </div>
      </div>
    </div>
  )
}

/**
 * Example of programmatic component action calls
 */
export function ButtonActionExample() {
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  const callButtonAction = React.useCallback(async (actionName: string, params: any) => {
    const button = buttonRef.current
    if (button) {
      // In a real implementation, this would use the component registry
      // to find and call the action on the component instance
      console.log(`Calling action ${actionName} with params:`, params)
    }
  }, [])

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Programmatic Button Actions</h2>
      
      <EnhancedButton
        ref={buttonRef}
        componentId="action-example-button"
        scriptable={true}
      >
        Target Button
      </EnhancedButton>

      <div className="flex gap-2 flex-wrap">
        <button
          className="px-3 py-1 bg-blue-100 rounded text-sm"
          onClick={() => callButtonAction('setLoading', { loading: true })}
        >
          Set Loading
        </button>
        <button
          className="px-3 py-1 bg-blue-100 rounded text-sm"
          onClick={() => callButtonAction('setLoading', { loading: false })}
        >
          Clear Loading
        </button>
        <button
          className="px-3 py-1 bg-blue-100 rounded text-sm"
          onClick={() => callButtonAction('setDisabled', { disabled: true })}
        >
          Disable
        </button>
        <button
          className="px-3 py-1 bg-blue-100 rounded text-sm"
          onClick={() => callButtonAction('setDisabled', { disabled: false })}
        >
          Enable
        </button>
        <button
          className="px-3 py-1 bg-blue-100 rounded text-sm"
          onClick={() => callButtonAction('focus', {})}
        >
          Focus
        </button>
      </div>
    </div>
  )
}