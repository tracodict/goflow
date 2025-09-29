/**
 * Page Builder Button Component
 * 
 * This component wraps the base Button component and adds support for
 * script integration via data attributes from the property panel.
 */

import * as React from "react"
import { Button, ButtonProps } from "./Button"
import type { BaseEventPayload, InteractionEventPayload } from "./Button"
// Builder store import to allow scripts to mutate other elements (e.g., set DataGrid query)
import { useBuilderStore } from '@/stores/pagebuilder/editor'

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
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

export interface PageBuilderButtonProps extends Omit<ButtonProps, 'onScriptClick' | 'onScriptMount' | 'onScriptUnmount'> {
  // Data attributes from property panel
  'data-onclick-script'?: string
  'data-onmount-script'?: string
  'data-onunmount-script'?: string
  'data-loading'?: string
  'data-disabled'?: string
  'data-loading-text'?: string
  'data-component-type'?: string
  
  // Editor-specific props
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onMouseEnter?: (e: React.MouseEvent) => void
  draggable?: boolean
}

const PageBuilderButton = React.forwardRef<HTMLButtonElement, PageBuilderButtonProps>(
  ({ 
    'data-onclick-script': onClickScript,
    'data-onmount-script': onMountScript,
    'data-onunmount-script': onUnmountScript,
    'data-loading': dataLoading,
    'data-disabled': dataDisabled,
    'data-loading-text': dataLoadingText,
    'data-component-type': componentType,
    loading: propLoading,
    disabled: propDisabled,
    loadingText: propLoadingText,
    // Editor-specific props
    onDragStart,
    onDragOver, 
    onDrop,
    onDragEnd,
    onMouseEnter,
    draggable,
    onClick: editorOnClick,
    style: editorStyle,
    ...props 
  }, ref) => {
    
    // Override props with data attributes if they exist
    const finalLoading = dataLoading === "true" ? true : propLoading
    const finalDisabled = dataDisabled === "true" ? true : propDisabled
    const finalLoadingText = dataLoadingText || propLoadingText
    
    // Create context for script execution
    const createContext = React.useCallback(() => ({
      component: {
        id: props.elementId || 'button',
        type: 'button',
        getProps: () => props,
        setProps: (newProps: Record<string, any>) => {
          console.log('Setting props:', newProps)
        },
        emit: (event: string, payload: any) => {
          console.log(`Event emitted: ${event}`, payload)
        },
        callAction: async (actionName: string, params: any) => {
          console.log(`Action called: ${actionName}`, params)
          return { success: true }
        }
      },
      data: {
        query: async (queryId: string) => ({}),
        mutate: async (mutation: any) => ({}),
        subscribe: (callback: (data: any) => void) => () => {}
      },
      page: {
        navigate: (path: string) => {
          console.log('Navigate to:', path)
        },
        getState: () => ({}),
        setState: (state: any) => {},
        dispatch: (action: any) => {
          console.log('Action dispatched:', action)
        },
        /**
         * Retrieve a builder element by id
         */
        getElement: (id: string) => {
          return useBuilderStore.getState().elements[id]
        },
        /**
         * Low-level helper to update an element using the builder store updateElement API
         */
        updateElement: (id: string, updates: Partial<any>) => {
          const store = useBuilderStore.getState()
            ;(store as any).updateElement(id, updates)
        },
        /**
         * Convenience helper used by scripts to change a single attribute on another element.
         * Example (in data-onclick-script):
         *   const gridId = 'data-grid';
         *   page.updateElementAttribute(gridId, 'data-query-name', 'Mock Query');
         */
        updateElementAttribute: (id: string, attrName: string, value: any) => {
          const store = useBuilderStore.getState()
          const el = store.elements[id]
          if (!el) {
            console.warn('[PageBuilderButton] updateElementAttribute: element not found', id)
            return
          }
          ;(store as any).updateElement(id, {
            attributes: { ...el.attributes, [attrName]: value }
          })
        }
      },
      app: {
        getGlobalState: () => ({}),
        setGlobalState: (state: any) => {},
        showNotification: (message: string, type = 'info') => {
          console.log(`[${type.toUpperCase()}] ${message}`)
        },
        callWorkflow: async (workflowId: string, payload: any) => ({ success: true })
      }
    }), [props])
    
    // Script event handlers
    const handleScriptClick = React.useCallback(async (payload: InteractionEventPayload) => {
      if (onClickScript) {
        const context = createContext()
        const result = await globalSandbox.executeScript(onClickScript, payload, context)
        if (!result.success) {
          console.error('onClick script error:', result.error)
        }
      }
    }, [onClickScript, createContext])
    
    const handleScriptMount = React.useCallback(async (payload: BaseEventPayload) => {
      if (onMountScript) {
        const context = createContext()
        const result = await globalSandbox.executeScript(onMountScript, payload, context)
        if (!result.success) {
          console.error('onMount script error:', result.error)
        }
      }
    }, [onMountScript, createContext])
    
    const handleScriptUnmount = React.useCallback(async (payload: BaseEventPayload) => {
      if (onUnmountScript) {
        const context = createContext()
        const result = await globalSandbox.executeScript(onUnmountScript, payload, context)
        if (!result.success) {
          console.error('onUnmount script error:', result.error)
        }
      }
    }, [onUnmountScript, createContext])

    return (
      <Button
        ref={ref}
        loading={finalLoading}
        disabled={finalDisabled}
        loadingText={finalLoadingText}
        isPreview={componentType === "Button"}
        onScriptClick={handleScriptClick}
        onScriptMount={handleScriptMount}
        onScriptUnmount={handleScriptUnmount}
        data-component-type={componentType}
        // Pass through editor props
        onClick={editorOnClick}
        style={editorStyle}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onMouseEnter={onMouseEnter}
        draggable={draggable}
        {...props}
      />
    )
  }
)

PageBuilderButton.displayName = "PageBuilderButton"

export { PageBuilderButton }