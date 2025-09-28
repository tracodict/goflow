/**
 * Component Renderer Registry
 * 
 * Central registry for mapping component types to their PageBuilder renderer components.
 * This allows dynamic component rendering without hardcoding specific components in PageElement.tsx
 */

import React from 'react'

export interface ComponentRenderer {
  /** The component type identifier (matches data-component-type attribute) */
  componentType: string
  /** Function that returns the PageBuilder wrapper component */
  getComponent: () => React.ComponentType<any>
  /** Priority for rendering (higher numbers render first, useful for overrides) */
  priority?: number
}

interface RendererRegistryEntry extends ComponentRenderer {
  priority: number
}

class ComponentRendererRegistry {
  private renderers = new Map<string, RendererRegistryEntry>()

  /**
   * Register a component renderer
   */
  register(renderer: ComponentRenderer): void {
    const entry: RendererRegistryEntry = {
      ...renderer,
      priority: renderer.priority ?? 0
    }
    
    // Warn if overriding existing renderer
    if (this.renderers.has(renderer.componentType)) {
      console.warn(
        `ComponentRendererRegistry: Overriding existing renderer for "${renderer.componentType}". ` +
        `Previous priority: ${this.renderers.get(renderer.componentType)?.priority}, ` +
        `New priority: ${entry.priority}`
      )
    }
    
    this.renderers.set(renderer.componentType, entry)
  }

  /**
   * Get renderer for a component type
   */
  getRenderer(componentType: string): RendererRegistryEntry | undefined {
    return this.renderers.get(componentType)
  }

  /**
   * Check if a renderer exists for a component type
   */
  hasRenderer(componentType: string): boolean {
    return this.renderers.has(componentType)
  }

  /**
   * Get all registered component types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.renderers.keys())
  }

  /**
   * Clear all registered renderers (mainly for testing)
   */
  clear(): void {
    this.renderers.clear()
  }
}

// Export singleton instance
export const componentRendererRegistry = new ComponentRendererRegistry()

/**
 * Helper function to register a component renderer
 * Use this in component index.ts files for cleaner registration
 */
export function registerComponentRenderer(renderer: ComponentRenderer): void {
  componentRendererRegistry.register(renderer)
}

/**
 * Helper function to create a renderer registration
 */
export function createComponentRenderer(
  componentType: string,
  getComponent: () => React.ComponentType<any>,
  priority?: number
): ComponentRenderer {
  return {
    componentType,
    getComponent,
    priority
  }
}