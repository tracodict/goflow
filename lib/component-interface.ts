/**
 * Component Event Interface System
 * 
 * This module defines the standardized interface that all components in the
 * component library must implement to expose events and actions to the 
 * Visual Page Editor's scripting system.
 */

import type { JSONSchema } from '@/jsonjoy-builder/src/types/jsonSchema'

/**
 * Standard event payload that all component events should include
 */
export interface BaseEventPayload {
  /** Timestamp when the event occurred */
  timestamp: number
  /** ID of the component that triggered the event */
  componentId: string
  /** Type of the event (e.g., 'click', 'change', 'submit') */
  eventType: string
}

/**
 * Modifier keys state for user interaction events
 */
export interface ModifierKeys {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
}

/**
 * Extended event payload for user interaction events
 */
export interface InteractionEventPayload extends BaseEventPayload {
  /** Modifier keys pressed during the event */
  modifierKeys: ModifierKeys
  /** Mouse/touch position if applicable */
  position?: {
    x: number
    y: number
  }
}

/**
 * Event definition with metadata and schema
 */
export interface ComponentEvent {
  /** Human-readable description of when this event fires */
  description: string
  /** JSON schema defining the structure of the event payload */
  payload: JSONSchema
  /** Whether this event can be prevented from bubbling */
  preventDefault?: boolean
  /** Whether this event can stop propagation */
  stopPropagation?: boolean
  /** Category of the event for UI organization */
  category?: 'interaction' | 'lifecycle' | 'data' | 'validation'
}

/**
 * Action definition with parameters and return type
 */
export interface ComponentAction {
  /** Human-readable description of what this action does */
  description: string
  /** JSON schema defining the structure of action parameters */
  parameters: JSONSchema
  /** JSON schema defining the return type (optional) */
  returnType?: JSONSchema
  /** Category of the action for UI organization */
  category?: 'state' | 'display' | 'data' | 'navigation'
  /** Whether this action is asynchronous */
  async?: boolean
}

/**
 * Complete component interface definition
 */
export interface ComponentEventInterface {
  /** Unique identifier for the component type */
  componentType: string
  /** Display name for the component */
  displayName: string
  /** Brief description of the component's purpose */
  description: string
  
  /** Standard lifecycle events available on all components */
  lifecycle: {
    onMount?: ComponentEvent
    onUnmount?: ComponentEvent
    onUpdate?: ComponentEvent
    onError?: ComponentEvent
  }
  
  /** Component-specific interactive events */
  events: {
    [eventName: string]: ComponentEvent
  }
  
  /** Actions that can be called on the component */
  actions: {
    [actionName: string]: ComponentAction
  }
  
  /** State properties that can be read from the component */
  state?: {
    [stateName: string]: {
      description: string
      type: JSONSchema
      readonly?: boolean
    }
  }
}

/**
 * Registry for component interfaces
 */
export interface ComponentRegistry {
  [componentType: string]: ComponentEventInterface
}

/**
 * Context provided to event handlers during script execution
 */
export interface EventHandlerContext {
  /** Component instance information */
  component: {
    id: string
    type: string
    getProps: () => Record<string, any>
    setProps: (props: Record<string, any>) => void
    emit: (event: string, payload: any) => void
    callAction: (actionName: string, parameters: any) => Promise<any>
  }
  
  /** Data access utilities */
  data: {
    query: (queryId: string) => Promise<any>
    mutate: (mutation: { type: string, payload: any }) => Promise<any>
    subscribe: (callback: (data: any) => void) => () => void
  }
  
  /** Page-level utilities */
  page: {
    navigate: (path: string) => void
    getState: () => any
    setState: (state: any) => void
    dispatch: (action: any) => void
  }
  
  /** Application utilities */
  app: {
    getGlobalState: () => any
    setGlobalState: (state: any) => void
    showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
    callWorkflow: (workflowId: string, payload: any) => Promise<any>
  }
  
  /** Utility functions */
  utils: {
    formatDate: (date: Date | string, format?: string) => string
    validateSchema: (data: any, schema: JSONSchema) => { valid: boolean, errors?: string[] }
    debounce: <T extends (...args: any[]) => void>(func: T, delay: number) => T
    throttle: <T extends (...args: any[]) => void>(func: T, delay: number) => T
    log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void
  }
}

/**
 * Standard action types for common patterns
 */
export enum StandardActionTypes {
  // Component state actions
  SET_LOADING = 'SET_LOADING',
  SET_DISABLED = 'SET_DISABLED',
  SET_VISIBLE = 'SET_VISIBLE',
  SET_VALUE = 'SET_VALUE',
  
  // Page state actions
  PAGE_NAVIGATE = 'PAGE_NAVIGATE',
  PAGE_REFRESH = 'PAGE_REFRESH',
  PAGE_SET_STATE = 'PAGE_SET_STATE',
  
  // Data actions
  DATA_FETCH = 'DATA_FETCH',
  DATA_MUTATE = 'DATA_MUTATE',
  DATA_REFRESH = 'DATA_REFRESH',
  
  // UI actions
  UI_SHOW_MODAL = 'UI_SHOW_MODAL',
  UI_HIDE_MODAL = 'UI_HIDE_MODAL',
  UI_SHOW_NOTIFICATION = 'UI_SHOW_NOTIFICATION',
  
  // Workflow actions
  WORKFLOW_TRIGGER = 'WORKFLOW_TRIGGER'
}

/**
 * Action creator function type
 */
export type ActionCreator<T = any> = (type: string, payload: T) => {
  type: string
  payload: T
  timestamp: number
  id: string
}

/**
 * Event handler function type
 */
export type EventHandler<TPayload = any> = (
  eventPayload: TPayload,
  context: EventHandlerContext
) => Promise<void> | void

/**
 * Script execution result
 */
export interface ScriptExecutionResult {
  /** Whether the script executed successfully */
  success: boolean
  /** Error message if execution failed */
  error?: string
  /** Immediate component updates to apply */
  componentUpdates?: {
    [componentId: string]: Record<string, any>
  }
  /** Actions to dispatch to the state management system */
  actions?: Array<{
    type: string
    payload: any
  }>
  /** Console output from the script */
  logs?: Array<{
    level: 'debug' | 'info' | 'warn' | 'error'
    message: string
    timestamp: number
  }>
}

/**
 * Helper function to create action creators
 */
export function createActionCreator<T = any>(): ActionCreator<T> {
  return (type: string, payload: T) => ({
    type,
    payload,
    timestamp: Date.now(),
    id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  })
}

/**
 * Helper function to validate event payload against schema
 */
export function validateEventPayload(payload: any, schema: JSONSchema): {
  valid: boolean
  errors?: string[]
} {
  // This will be implemented with a JSON schema validator
  // For now, return a basic validation
  return { valid: true }
}

/**
 * Helper function to create component event definition
 */
export function defineEvent(
  description: string,
  payloadSchema: JSONSchema,
  options?: {
    preventDefault?: boolean
    stopPropagation?: boolean
    category?: ComponentEvent['category']
  }
): ComponentEvent {
  return {
    description,
    payload: payloadSchema,
    preventDefault: options?.preventDefault,
    stopPropagation: options?.stopPropagation,
    category: options?.category || 'interaction'
  }
}

/**
 * Helper function to create component action definition
 */
export function defineAction(
  description: string,
  parametersSchema: JSONSchema,
  options?: {
    returnType?: JSONSchema
    category?: ComponentAction['category']
    async?: boolean
  }
): ComponentAction {
  return {
    description,
    parameters: parametersSchema,
    returnType: options?.returnType,
    category: options?.category || 'state',
    async: options?.async || false
  }
}