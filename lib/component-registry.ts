/**
 * Component Registry System
 * 
 * Manages registration and discovery of component interfaces for the
 * Visual Page Editor scripting system.
 */

import type { 
  ComponentEventInterface, 
  ComponentRegistry,
  ComponentEvent,
  ComponentAction 
} from './component-interface'

/**
 * Global component registry instance
 */
class ComponentRegistryManager {
  private registry: ComponentRegistry = {}
  private listeners: Array<(registry: ComponentRegistry) => void> = []

  /**
   * Register a component interface
   */
  register(componentInterface: ComponentEventInterface): void {
    this.registry[componentInterface.componentType] = componentInterface
    this.notifyListeners()
  }

  /**
   * Unregister a component interface
   */
  unregister(componentType: string): void {
    delete this.registry[componentType]
    this.notifyListeners()
  }

  /**
   * Get a specific component interface
   */
  get(componentType: string): ComponentEventInterface | undefined {
    return this.registry[componentType]
  }

  /**
   * Get all registered components
   */
  getAll(): ComponentRegistry {
    return { ...this.registry }
  }

  /**
   * Get all component types
   */
  getTypes(): string[] {
    return Object.keys(this.registry)
  }

  /**
   * Check if a component type is registered
   */
  has(componentType: string): boolean {
    return componentType in this.registry
  }

  /**
   * Get all events for a component type
   */
  getEvents(componentType: string): Record<string, ComponentEvent> | undefined {
    const component = this.registry[componentType]
    return component ? { ...component.lifecycle, ...component.events } : undefined
  }

  /**
   * Get all actions for a component type
   */
  getActions(componentType: string): Record<string, ComponentAction> | undefined {
    return this.registry[componentType]?.actions
  }

  /**
   * Get components by category
   */
  getByCategory(category: string): ComponentEventInterface[] {
    return Object.values(this.registry).filter(component => 
      component.description.toLowerCase().includes(category.toLowerCase()) ||
      component.displayName.toLowerCase().includes(category.toLowerCase())
    )
  }

  /**
   * Search components by text
   */
  search(query: string): ComponentEventInterface[] {
    const searchTerm = query.toLowerCase()
    return Object.values(this.registry).filter(component =>
      component.displayName.toLowerCase().includes(searchTerm) ||
      component.description.toLowerCase().includes(searchTerm) ||
      component.componentType.toLowerCase().includes(searchTerm)
    )
  }

  /**
   * Get component interface as JSON schema for validation
   */
  getSchema(componentType: string): any {
    const component = this.registry[componentType]
    if (!component) return null

    return {
      type: 'object',
      properties: {
        events: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries({ ...component.lifecycle, ...component.events }).map(
              ([eventName, event]) => [eventName, event.payload]
            )
          )
        },
        actions: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(component.actions).map(
              ([actionName, action]) => [actionName, action.parameters]
            )
          )
        },
        state: component.state ? {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(component.state).map(
              ([stateName, state]) => [stateName, state.type]
            )
          )
        } : undefined
      }
    }
  }

  /**
   * Subscribe to registry changes
   */
  subscribe(listener: (registry: ComponentRegistry) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.registry = {}
    this.notifyListeners()
  }

  /**
   * Export registry as JSON
   */
  export(): string {
    return JSON.stringify(this.registry, null, 2)
  }

  /**
   * Import registry from JSON
   */
  import(json: string): void {
    try {
      const imported = JSON.parse(json) as ComponentRegistry
      this.registry = { ...this.registry, ...imported }
      this.notifyListeners()
    } catch (error) {
      throw new Error('Invalid registry JSON format')
    }
  }

  /**
   * Validate component interface before registration
   */
  private validateInterface(componentInterface: ComponentEventInterface): void {
    if (!componentInterface.componentType) {
      throw new Error('Component interface must have a componentType')
    }
    if (!componentInterface.displayName) {
      throw new Error('Component interface must have a displayName')
    }
    if (!componentInterface.description) {
      throw new Error('Component interface must have a description')
    }
    
    // Validate events
    for (const [eventName, event] of Object.entries(componentInterface.events)) {
      if (!event.description) {
        throw new Error(`Event ${eventName} must have a description`)
      }
      if (!event.payload) {
        throw new Error(`Event ${eventName} must have a payload schema`)
      }
    }
    
    // Validate actions
    for (const [actionName, action] of Object.entries(componentInterface.actions)) {
      if (!action.description) {
        throw new Error(`Action ${actionName} must have a description`)
      }
      if (!action.parameters) {
        throw new Error(`Action ${actionName} must have a parameters schema`)
      }
    }
  }

  /**
   * Notify all listeners of registry changes
   */
  private notifyListeners(): void {
    const registry = this.getAll()
    this.listeners.forEach(listener => {
      try {
        listener(registry)
      } catch (error) {
        console.error('Error in registry listener:', error)
      }
    })
  }
}

/**
 * Global registry instance
 */
export const componentRegistry = new ComponentRegistryManager()

/**
 * Decorator for auto-registering components
 */
export function registerComponent(componentInterface: ComponentEventInterface) {
  return function <T extends { new (...args: any[]): any }>(constructor: T) {
    // Register the component interface
    componentRegistry.register(componentInterface)
    
    // Return the constructor unchanged
    return constructor
  }
}

/**
 * Hook for React components to access registry
 */
export function useComponentRegistry() {
  const [registry, setRegistry] = React.useState<ComponentRegistry>(
    componentRegistry.getAll()
  )

  React.useEffect(() => {
    const unsubscribe = componentRegistry.subscribe(setRegistry)
    return unsubscribe
  }, [])

  return {
    registry,
    getComponent: (type: string) => componentRegistry.get(type),
    getEvents: (type: string) => componentRegistry.getEvents(type),
    getActions: (type: string) => componentRegistry.getActions(type),
    search: (query: string) => componentRegistry.search(query),
    getByCategory: (category: string) => componentRegistry.getByCategory(category)
  }
}

/**
 * Utility function to create component documentation
 */
export function generateComponentDocs(componentType: string): string {
  const component = componentRegistry.get(componentType)
  if (!component) {
    return `Component type "${componentType}" not found.`
  }

  let docs = `# ${component.displayName}\n\n`
  docs += `${component.description}\n\n`
  
  // Events section
  const allEvents = { ...component.lifecycle, ...component.events }
  if (Object.keys(allEvents).length > 0) {
    docs += `## Events\n\n`
    for (const [eventName, event] of Object.entries(allEvents)) {
      docs += `### ${eventName}\n`
      docs += `${event.description}\n\n`
      docs += `**Category:** ${event.category || 'interaction'}\n\n`
      docs += `**Payload Schema:**\n`
      docs += `\`\`\`json\n${JSON.stringify(event.payload, null, 2)}\n\`\`\`\n\n`
    }
  }
  
  // Actions section
  if (Object.keys(component.actions).length > 0) {
    docs += `## Actions\n\n`
    for (const [actionName, action] of Object.entries(component.actions)) {
      docs += `### ${actionName}\n`
      docs += `${action.description}\n\n`
      docs += `**Category:** ${action.category || 'state'}\n`
      docs += `**Async:** ${action.async ? 'Yes' : 'No'}\n\n`
      docs += `**Parameters Schema:**\n`
      docs += `\`\`\`json\n${JSON.stringify(action.parameters, null, 2)}\n\`\`\`\n\n`
      if (action.returnType) {
        docs += `**Return Type Schema:**\n`
        docs += `\`\`\`json\n${JSON.stringify(action.returnType, null, 2)}\n\`\`\`\n\n`
      }
    }
  }
  
  // State section
  if (component.state && Object.keys(component.state).length > 0) {
    docs += `## State Properties\n\n`
    for (const [stateName, state] of Object.entries(component.state)) {
      docs += `### ${stateName}\n`
      docs += `${state.description}\n\n`
      docs += `**Type:** \`${state.readonly ? 'readonly ' : ''}${JSON.stringify(state.type)}\`\n\n`
    }
  }
  
  return docs
}

/**
 * Development helper to log registry contents
 */
export function logRegistry(): void {
  console.group('Component Registry')
  const registry = componentRegistry.getAll()
  for (const [type, component] of Object.entries(registry)) {
    console.group(component.displayName)
    console.log('Type:', type)
    console.log('Description:', component.description)
    console.log('Events:', Object.keys({ ...component.lifecycle, ...component.events }))
    console.log('Actions:', Object.keys(component.actions))
    if (component.state) {
      console.log('State:', Object.keys(component.state))
    }
    console.groupEnd()
  }
  console.groupEnd()
}

// React import for the hook
import React from 'react'