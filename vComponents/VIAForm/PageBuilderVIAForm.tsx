'use client'

/**
 * PageBuilder VIAForm Component
 * 
 * This component wraps the base VIAForm component and adds support for
 * script integration via data attributes from the property panel.
 */

import React, { useCallback, useRef, useEffect } from 'react'
import VIAForm, { VIAFormRef } from './VIAForm'
import { VIAFormComponentInterface } from './interface'

// Global script sandbox for executing event scripts
const globalSandbox = {
  executeScript: async (script: string, payload: any, context: any) => {
    if (!script.trim()) return { success: true }
    
    try {
      // Create a safe execution context
      const func = new Function('payload', 'context', 'component', 'page', 'app', `
        ${script}
      `)
      
      // Execute the script
      await func(payload, context, context.component, context.page, context.app)
      return { success: true }
    } catch (error) {
      console.error('Script execution error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
}

export interface PageBuilderVIAFormProps {
  // Standard HTML attributes
  id?: string
  className?: string
  style?: React.CSSProperties
  
  // PageBuilder-specific attributes
  'data-element-id'?: string
  
  // PageBuilder event handlers
  onClick?: (e: React.MouseEvent) => void
  onMouseEnter?: (e: React.MouseEvent) => void
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  draggable?: boolean
  
  // VIA-specific data attributes (from property panel)
  'data-initial-color'?: string
  'data-show-action-buttons'?: string
  'data-height'?: string
  'data-width'?: string
  
  // Event scripts (from property panel)
  'data-ontokenselected-script'?: string
  'data-ontransitionfired-script'?: string
  'data-oncolorchanged-script'?: string
  'data-onmount-script'?: string
  'data-onunmount-script'?: string
  
  // Standard component attributes
  'data-component-type'?: string
  'data-scriptable'?: string
  
  // Preview mode flag
  isPreview?: boolean
}

const PageBuilderVIAForm: React.FC<PageBuilderVIAFormProps> = (props) => {
  const {
    id,
    className = '',
    style = {},
    isPreview = false,
    'data-element-id': elementId,
    // PageBuilder event handlers
    onClick,
    onMouseEnter,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    draggable,
    // VIA data attributes
    'data-initial-color': initialColor = '',
    'data-show-action-buttons': showActionButtons = 'true',
    'data-height': height = '400px',
    'data-width': width = '100%',
    'data-ontokenselected-script': onTokenSelectedScript = '',
    'data-ontransitionfired-script': onTransitionFiredScript = '',
    'data-oncolorchanged-script': onColorChangedScript = '',
    'data-onmount-script': onMountScript = '',
    'data-onunmount-script': onUnmountScript = '',
    ...otherProps
  } = props

  const viaFormRef = useRef<VIAFormRef>(null)
  const componentId = elementId || id || `viaform-${Math.random().toString(36).substr(2, 9)}`

  // Parse boolean values from string attributes
  const parsedShowActionButtons = showActionButtons.toLowerCase() === 'true'

  // Create script execution context
  const createScriptContext = useCallback(() => ({
    component: {
      id: componentId,
      type: 'VIAForm',
      ref: viaFormRef.current,
      // VIA-specific component methods
      selectColor: (color: string) => viaFormRef.current?.selectColor(color),
      fireTransition: (transitionId: string, tokenBinding: any, input?: any) => 
        viaFormRef.current?.fireTransition(transitionId, tokenBinding, input),
      refreshTokens: () => viaFormRef.current?.refreshTokens(),
      getSelectedColor: () => viaFormRef.current?.getSelectedColor(),
      getTokens: () => viaFormRef.current?.getTokens()
    },
    page: {
      navigate: (path: string) => {
        if (typeof window !== 'undefined') {
          window.location.href = path
        }
      },
      getState: () => ({}),
      setState: () => {},
      dispatch: () => {}
    },
    app: {
      getGlobalState: () => ({}),
      setGlobalState: () => {},
      showNotification: (message: string, type = 'info') => {
        console.log(`Notification [${type}]:`, message)
      },
      callWorkflow: async () => ({})
    }
  }), [componentId])

  // Event handlers with script integration
  const handleTokenSelected = useCallback(async (token: any) => {
    if (onTokenSelectedScript && !isPreview) {
      const payload = {
        timestamp: Date.now(),
        componentId,
        eventType: 'tokenSelected',
        token
      }
      const context = createScriptContext()
      await globalSandbox.executeScript(onTokenSelectedScript, payload, context)
    }
  }, [onTokenSelectedScript, isPreview, componentId, createScriptContext])

  const handleTransitionFired = useCallback(async (transitionId: string, result: any) => {
    if (onTransitionFiredScript && !isPreview) {
      const payload = {
        timestamp: Date.now(),
        componentId,
        eventType: 'transitionFired',
        transitionId,
        result
      }
      const context = createScriptContext()
      await globalSandbox.executeScript(onTransitionFiredScript, payload, context)
    }
  }, [onTransitionFiredScript, isPreview, componentId, createScriptContext])

  const handleColorChanged = useCallback(async (color: string) => {
    if (onColorChangedScript && !isPreview) {
      const payload = {
        timestamp: Date.now(),
        componentId,
        eventType: 'colorChanged',
        color
      }
      const context = createScriptContext()
      await globalSandbox.executeScript(onColorChangedScript, payload, context)
    }
  }, [onColorChangedScript, isPreview, componentId, createScriptContext])

  // Lifecycle event handlers
  useEffect(() => {
    // Mount event
    if (onMountScript && !isPreview) {
      const payload = {
        timestamp: Date.now(),
        componentId,
        eventType: 'mount'
      }
      const context = createScriptContext()
      globalSandbox.executeScript(onMountScript, payload, context)
    }

    // Unmount event
    return () => {
      if (onUnmountScript && !isPreview) {
        const payload = {
          timestamp: Date.now(),
          componentId,
          eventType: 'unmount'
        }
        const context = createScriptContext()
        globalSandbox.executeScript(onUnmountScript, payload, context)
      }
    }
  }, [onMountScript, onUnmountScript, isPreview, componentId, createScriptContext])

  // Combine style with dimension overrides
  const combinedStyle = {
    ...style,
    ...(height && { height }),
    ...(width && { width })
  }

  return (
    <VIAForm
      ref={viaFormRef}
      className={className}
      style={combinedStyle}
      elementId={componentId}
      initialColor={initialColor}
      showActionButtons={parsedShowActionButtons}
      // PageBuilder event handlers
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      draggable={draggable}
      // Component event handlers
      onTokenSelected={handleTokenSelected}
      onTransitionFired={handleTransitionFired}
      onColorChanged={handleColorChanged}
      {...otherProps}
    />
  )
}

PageBuilderVIAForm.displayName = 'PageBuilderVIAForm'

// Export component interface for reference
export { VIAFormComponentInterface }
export default PageBuilderVIAForm