'use client'

import React from "react"
import { NavigationMenu } from "./NavigationMenu"
import { globalSandbox } from "@/lib/script-sandbox"
import type { NavigationMenuConfig, NavigationMenuEventPayload, MenuState } from "@/lib/types/navigation-menu-interface"
import type { BaseEventPayload } from "@/lib/component-interface"
import type { MenuInteractionEventPayload } from "./interface"

// Base props interface for NavigationMenu
export interface NavigationMenuProps {
  config?: NavigationMenuConfig
  onMenuItemClick?: (payload: NavigationMenuEventPayload) => void
  onMenuStateChange?: (state: MenuState) => void
  className?: string
}

// Props for PageBuilder wrapper including all event handlers
export interface PageBuilderNavigationMenuProps extends NavigationMenuProps {
  "data-element-id"?: string
  "data-script-click"?: string
  "data-script-menu-item-click"?: string
  "data-script-menu-state-change"?: string
  "data-config"?: string
}

/**
 * PageBuilder wrapper for NavigationMenu component
 * Handles script execution via data attributes
 */
export const PageBuilderNavigationMenu: React.FC<PageBuilderNavigationMenuProps> = ({ 
  "data-element-id": elementId,
  "data-script-click": scriptClick,
  "data-script-menu-item-click": scriptMenuItemClick,
  "data-script-menu-state-change": scriptMenuStateChange,
  "data-config": configString,
  ...props 
}) => {
  // Parse config from JSON string
  const config = React.useMemo(() => {
    if (configString) {
      try {
        const parsed = JSON.parse(configString)
        if (!Array.isArray(parsed.items)) {
          console.warn("NavigationMenu: config.items not an array, replacing with []", parsed.items)
          parsed.items = []
        }
        return parsed
      } catch (e) {
        console.error("Failed to parse data-config JSON for NavigationMenu", e, configString)
        return { items: [] }
      }
    }
    return { items: [] }
  }, [configString])
  // Create context for script execution  
  const createContext = React.useCallback(() => ({
    component: {
      id: elementId || 'navigation-menu',
      type: 'navigation-menu',
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
      }
    },
    app: {
      getGlobalState: () => ({}),
      setGlobalState: (state: any) => {},
      showNotification: (message: string, type = 'info') => {
        console.log(`[${type.toUpperCase()}] ${message}`)
      },
      callWorkflow: async (workflowId: string, payload: any) => ({ success: true })
    },
    utils: {
      formatDate: (date: Date | string, format?: string) => {
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toISOString()
      },
      validateSchema: (data: any, schema: any) => ({ valid: true }),
      debounce: <T extends (...args: any[]) => void>(func: T, delay: number) => func,
      throttle: <T extends (...args: any[]) => void>(func: T, delay: number) => func,
      log: (message: string, level = 'info') => {
        console.log(`[${level.toUpperCase()}] ${message}`)
      }
    }
  }), [elementId, props])

  // Script execution handlers
  const handleScriptClick = React.useCallback(async (payload: BaseEventPayload) => {
    if (scriptClick) {
      const context = createContext()
      const result = await globalSandbox.executeScript('click-handler', scriptClick, context, payload)
      if (!result.success) {
        console.error('onClick script error:', result.error)
      }
    }
  }, [scriptClick, createContext])

  const handleScriptMenuItemClick = React.useCallback(async (payload: MenuInteractionEventPayload) => {
    if (scriptMenuItemClick) {
      const context = createContext()
      const result = await globalSandbox.executeScript('menu-item-click-handler', scriptMenuItemClick, context, payload)
      if (!result.success) {
        console.error('onMenuItemClick script error:', result.error)
      }
    }
  }, [scriptMenuItemClick, createContext])

  const handleScriptMenuStateChange = React.useCallback(async (payload: MenuInteractionEventPayload) => {
    if (scriptMenuStateChange) {
      const context = createContext()
      const result = await globalSandbox.executeScript('menu-state-change-handler', scriptMenuStateChange, context, payload)
      if (!result.success) {
        console.error('onMenuStateChange script error:', result.error)
      }
    }
  }, [scriptMenuStateChange, createContext])

  return (
    <NavigationMenu
      {...props}
      config={config}
      elementId={elementId}
      onScriptMenuItemClick={handleScriptMenuItemClick}
      onScriptMenuStateChange={handleScriptMenuStateChange}
    />
  )
}