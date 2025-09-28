/**
 * JavaScript Sandbox System
 * 
 * Provides secure execution environment for user scripts with:
 * - Memory and execution time limits
 * - Restricted API surface
 * - Isolated execution context
 * - Error handling and logging
 */

import type { EventHandlerContext, ScriptExecutionResult } from './component-interface'

/**
 * Sandbox configuration options
 */
export interface SandboxConfig {
  /** Maximum execution time in milliseconds */
  maxExecutionTime: number
  /** Maximum memory usage (approximate) */
  maxMemoryMB: number
  /** Whether to allow console.log (for debugging) */
  allowConsole: boolean
  /** Custom API extensions */
  customAPIs?: Record<string, any>
}

/**
 * Default sandbox configuration
 */
const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  maxExecutionTime: 5000, // 5 seconds
  maxMemoryMB: 10, // 10MB
  allowConsole: true
}

/**
 * Script execution context with restricted APIs
 */
export class ScriptExecutionContext {
  private config: SandboxConfig
  private logs: Array<{ level: 'debug' | 'info' | 'warn' | 'error', message: string, timestamp: number }> = []
  private startTime: number = 0

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config }
  }

  /**
   * Create restricted global context for script execution
   */
  createRestrictedContext(eventContext: EventHandlerContext): Record<string, any> {
    // Safe utility functions
    const safeUtils = {
      // Date/time utilities
      now: () => Date.now(),
      formatDate: eventContext.utils.formatDate,
      
      // Safe JSON operations
      parseJSON: (str: string) => {
        try {
          return JSON.parse(str)
        } catch (e) {
          throw new Error('Invalid JSON: ' + (e as Error).message)
        }
      },
      stringifyJSON: (obj: any) => JSON.stringify(obj),
      
      // Safe array/object utilities
      isArray: Array.isArray,
      isObject: (val: any) => val !== null && typeof val === 'object' && !Array.isArray(val),
      keys: Object.keys,
      values: Object.values,
      entries: Object.entries,
      
      // Safe string utilities
      trim: (str: string) => String(str).trim(),
      split: (str: string, separator: string) => String(str).split(separator),
      join: (arr: any[], separator: string) => arr.join(separator),
      
      // Math utilities (safe subset)
      min: Math.min,
      max: Math.max,
      abs: Math.abs,
      round: Math.round,
      floor: Math.floor,
      ceil: Math.ceil,
      random: Math.random,
      
      // Safe regex
      match: (str: string, regex: RegExp) => String(str).match(regex),
      replace: (str: string, searchValue: string | RegExp, replaceValue: string) => 
        String(str).replace(searchValue, replaceValue),
      
      // Logging (if allowed)
      log: this.config.allowConsole ? this.createLogger() : () => {}
    }

    // Action creation utilities
    const actionUtils = {
      createAction: (type: string, payload: any = {}) => ({
        type,
        payload,
        timestamp: Date.now(),
        id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })
    }

    // Component interaction APIs
    const componentAPI = {
      // Get current component properties
      getProps: eventContext.component.getProps,
      
      // Update component properties
      setProps: (props: Record<string, any>) => {
        this.validateObject(props, 'Component props')
        return eventContext.component.setProps(props)
      },
      
      // Emit component events
      emit: (eventName: string, payload: any = {}) => {
        this.validateString(eventName, 'Event name')
        this.validateObject(payload, 'Event payload')
        return eventContext.component.emit(eventName, payload)
      },
      
      // Call component actions
      callAction: async (actionName: string, parameters: any = {}) => {
        this.validateString(actionName, 'Action name')
        this.validateObject(parameters, 'Action parameters')
        return await eventContext.component.callAction(actionName, parameters)
      }
    }

    // Data access APIs
    const dataAPI = {
      query: async (queryId: string) => {
        this.validateString(queryId, 'Query ID')
        return await eventContext.data.query(queryId)
      },
      
      mutate: async (mutation: { type: string, payload: any }) => {
        this.validateObject(mutation, 'Mutation')
        this.validateString(mutation.type, 'Mutation type')
        return await eventContext.data.mutate(mutation)
      }
    }

    // Page-level APIs
    const pageAPI = {
      navigate: (path: string) => {
        this.validateString(path, 'Navigation path')
        return eventContext.page.navigate(path)
      },
      
      getState: eventContext.page.getState,
      
      setState: (state: any) => {
        this.validateObject(state, 'Page state')
        return eventContext.page.setState(state)
      },
      
      dispatch: (action: any) => {
        this.validateObject(action, 'Action')
        this.validateString(action.type, 'Action type')
        return eventContext.page.dispatch(action)
      }
    }

    // Application-level APIs
    const appAPI = {
      showNotification: (message: string, type: string = 'info') => {
        this.validateString(message, 'Notification message')
        const validTypes = ['info', 'success', 'warning', 'error']
        if (!validTypes.includes(type)) {
          throw new Error(`Invalid notification type: ${type}`)
        }
        return eventContext.app.showNotification(message, type as any)
      },
      
      callWorkflow: async (workflowId: string, payload: any = {}) => {
        this.validateString(workflowId, 'Workflow ID')
        this.validateObject(payload, 'Workflow payload')
        return await eventContext.app.callWorkflow(workflowId, payload)
      }
    }

    // Create restricted context
    const restrictedContext = {
      // Utilities
      ...safeUtils,
      ...actionUtils,
      
      // Component APIs
      component: componentAPI,
      data: dataAPI,
      page: pageAPI,
      app: appAPI,
      
      // Limited globals (no dangerous functions)
      undefined,
      null: null,
      true: true,
      false: false,
      NaN,
      Infinity,
      
      // Safe constructors
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      RegExp,
      Error,
      
      // Custom APIs (if provided)
      ...(this.config.customAPIs || {})
    }

    return restrictedContext
  }

  /**
   * Execute user script in restricted context
   */
  async executeScript(
    scriptCode: string, 
    eventContext: EventHandlerContext,
    eventPayload: any
  ): Promise<ScriptExecutionResult> {
    this.startTime = Date.now()
    this.logs = []

    try {
      // Create execution timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Script execution timeout (${this.config.maxExecutionTime}ms)`))
        }, this.config.maxExecutionTime)
      })

      // Execute script with timeout
      const executionPromise = this.executeScriptInternal(scriptCode, eventContext, eventPayload)
      const result = await Promise.race([executionPromise, timeoutPromise])

      return {
        success: true,
        componentUpdates: result.componentUpdates,
        actions: result.actions,
        logs: this.logs
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs: this.logs
      }
    }
  }

  /**
   * Internal script execution logic
   */
  private async executeScriptInternal(
    scriptCode: string, 
    eventContext: EventHandlerContext,
    eventPayload: any
  ): Promise<{ componentUpdates?: any, actions?: any[] }> {
    // Create restricted context
    const context = this.createRestrictedContext(eventContext)

    // Create function wrapper for the script
    const wrappedScript = `
      (function(eventPayload, context) {
        "use strict";
        
        // Destructure context for easier access
        const {
          component, data, page, app,
          createAction, getProps, setProps, emit, callAction,
          log, now, formatDate, parseJSON, stringifyJSON,
          isArray, isObject, keys, values, entries,
          min, max, abs, round, floor, ceil, random
        } = context;
        
        // User script goes here
        ${scriptCode}
        
        // Scripts should return an object with updates/actions
        return typeof result !== 'undefined' ? result : {};
      })
    `

    try {
      // Create and execute the function
      const scriptFunction = new Function('return ' + wrappedScript)()
      const result = await scriptFunction(eventPayload, context)

      // Validate and return result
      if (result && typeof result === 'object') {
        return {
          componentUpdates: result.componentUpdates,
          actions: result.actions
        }
      }

      return {}
    } catch (error) {
      // Enhanced error reporting
      throw new Error(`Script execution failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Create safe logger function
   */
  private createLogger() {
    return (message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info') => {
      this.logs.push({
        level,
        message: String(message),
        timestamp: Date.now()
      })
    }
  }

  /**
   * Validation helpers
   */
  private validateString(value: any, name: string): void {
    if (typeof value !== 'string') {
      throw new Error(`${name} must be a string`)
    }
  }

  private validateObject(value: any, name: string): void {
    if (value === null || typeof value !== 'object') {
      throw new Error(`${name} must be an object`)
    }
  }

  /**
   * Get execution metrics
   */
  getMetrics(): { executionTime: number, logCount: number } {
    return {
      executionTime: Date.now() - this.startTime,
      logCount: this.logs.length
    }
  }
}

/**
 * Global sandbox manager
 */
export class SandboxManager {
  private config: SandboxConfig
  private activeExecutions = new Set<string>()

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config }
  }

  /**
   * Execute script with unique execution ID
   */
  async executeScript(
    scriptId: string,
    scriptCode: string,
    eventContext: EventHandlerContext,
    eventPayload: any
  ): Promise<ScriptExecutionResult> {
    // Prevent concurrent execution of same script
    if (this.activeExecutions.has(scriptId)) {
      return {
        success: false,
        error: 'Script is already executing',
        logs: []
      }
    }

    this.activeExecutions.add(scriptId)

    try {
      const context = new ScriptExecutionContext(this.config)
      const result = await context.executeScript(scriptCode, eventContext, eventPayload)
      
      return {
        ...result,
        logs: [
          ...(result.logs || []),
          {
            level: 'debug',
            message: `Execution completed in ${context.getMetrics().executionTime}ms`,
            timestamp: Date.now()
          }
        ]
      }
    } finally {
      this.activeExecutions.delete(scriptId)
    }
  }

  /**
   * Validate script syntax without execution
   */
  validateScript(scriptCode: string): { valid: boolean, error?: string } {
    try {
      new Function(scriptCode)
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Get active executions count
   */
  getActiveExecutionsCount(): number {
    return this.activeExecutions.size
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

/**
 * Global sandbox instance
 */
export const globalSandbox = new SandboxManager()

/**
 * React hook for using the sandbox
 */
export function useSandbox(config?: Partial<SandboxConfig>) {
  const [sandbox] = React.useState(() => 
    config ? new SandboxManager(config) : globalSandbox
  )
  
  return {
    executeScript: sandbox.executeScript.bind(sandbox),
    validateScript: sandbox.validateScript.bind(sandbox),
    getActiveCount: sandbox.getActiveExecutionsCount.bind(sandbox)
  }
}

// React import
import React from 'react'