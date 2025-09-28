"use client"

import React, { useState, useRef, forwardRef, useImperativeHandle, useCallback, useEffect } from 'react'
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock ScriptSandbox for now
class ScriptSandbox {
  async executeScript(script: string, payload: any, context: any) {
    // Simple script execution - in real implementation this would be properly sandboxed
    try {
      const func = new Function('payload', 'context', script)
      return func(payload, context)
    } catch (error) {
      console.error('Script execution error:', error)
      throw error
    }
  }
}

import type { 
  MenuItem, 
  NavigationMenuConfig, 
  MenuState, 
  NavigationMenuEventPayload,
  MenuItemScriptContext 
} from '@/lib/types/navigation-menu-interface'
import { NavigationMenuEventInterface } from '@/lib/types/navigation-menu-interface'

interface EnhancedNavigationMenuProps {
  config?: NavigationMenuConfig
  onMenuItemClick?: (payload: NavigationMenuEventPayload) => void
  onMenuStateChange?: (state: MenuState) => void
  className?: string
}

export const EnhancedNavigationMenu = forwardRef<
  any, 
  EnhancedNavigationMenuProps
>(({ config = { items: [] }, onMenuItemClick, onMenuStateChange, className }, ref) => {
  // Initialize with safe default config
  const safeDefaultConfig = {
    orientation: 'horizontal' as const,
    showIcons: true,
    showBadges: false,
    ...config,
    items: Array.isArray(config?.items) ? config.items : []
  }
  
  const [menuConfig, setMenuConfig] = useState<NavigationMenuConfig>(safeDefaultConfig)
  const [menuState, setMenuState] = useState<MenuState>({
    openMenus: safeDefaultConfig.defaultOpen || [],
    activeItem: undefined,
    hoveredItem: undefined
  })
  const [componentId] = useState(() => `nav-menu-${Math.random().toString(36).substr(2, 9)}`)
  const containerRef = useRef<HTMLElement>(null)
  const scriptSandbox = useRef(new ScriptSandbox())

  // Debug: lifecycle + config changes
  useEffect(() => {
    console.debug('[EnhancedNavigationMenu] mount', { itemCount: menuConfig.items.length, items: menuConfig.items })
    return () => console.debug('[EnhancedNavigationMenu] unmount')
  }, [])

  useEffect(() => {
    console.debug('[EnhancedNavigationMenu] config changed', { itemCount: menuConfig.items.length, items: menuConfig.items })
  }, [menuConfig])

  // Sync internal state with config prop changes
  useEffect(() => {
    // Ensure config has valid structure
    const safeConfig = {
      orientation: 'horizontal' as const,
      showIcons: true,
      showBadges: false,
      ...config,
      items: Array.isArray(config?.items) ? config.items : []
    }
    
    setMenuConfig(safeConfig)
    setMenuState({
      openMenus: safeConfig.defaultOpen || [],
      activeItem: undefined,
      hoveredItem: undefined
    })
  }, [config])

  // Update menu state and notify listeners
  const updateMenuState = useCallback((newState: Partial<MenuState>) => {
    setMenuState(prevState => {
      const updatedState = { ...prevState, ...newState }
      onMenuStateChange?.(updatedState)
      return updatedState
    })
  }, [onMenuStateChange])

  // Execute menu item script
  const executeMenuItemScript = useCallback(async (
    menuItem: MenuItem, 
    eventPayload: NavigationMenuEventPayload
  ) => {
    if (!menuItem.script) return

    try {
      // Create script context
      const context: MenuItemScriptContext = {
        component: {
          id: componentId,
          getConfig: () => menuConfig,
          setConfig: (newConfig: Partial<NavigationMenuConfig>) => {
            setMenuConfig(prev => ({ ...prev, ...newConfig }))
          },
          getState: () => menuState,
          setState: updateMenuState,
          emit: (event: string, payload: any) => {
            console.log(`Navigation menu event: ${event}`, payload)
          }
        },
        navigation: {
          navigateTo: (path: string, options?: { newTab?: boolean }) => {
            if (options?.newTab) {
              window.open(path, '_blank', 'noopener,noreferrer')
            } else {
              window.location.href = path
            }
          },
          goBack: () => window.history.back(),
          goForward: () => window.history.forward(),
          getCurrentPath: () => window.location.pathname
        },
        ui: {
          showNotification: ({ type, message }) => {
            // In real implementation, this would use a toast system
            console.log(`Notification [${type}]: ${message}`)
            alert(`${type.toUpperCase()}: ${message}`)
          },
          openModal: (modalId: string, props?: any) => {
            console.log(`Opening modal: ${modalId}`, props)
          },
          closeModal: (modalId: string) => {
            console.log(`Closing modal: ${modalId}`)
          }
        },
        user: {
          id: 'current-user-id',
          name: 'Current User',
          email: 'user@example.com',
          roles: ['user'],
          permissions: ['read', 'write']
        },
        workflow: {
          createCase: (workflowId: string, data?: any) => Promise.resolve('case-' + Math.random().toString(36).substr(2, 9)),
          executeAction: (actionId: string, params?: any) => Promise.resolve({ success: true, params })
        },
        data: {
          query: (queryId: string, params?: any) => Promise.resolve({ queryId, params }),
          mutate: (mutation: any) => Promise.resolve({ success: true, mutation }),
          subscribe: (callback: Function) => () => console.log('Unsubscribed')
        },
        utils: {
          formatDate: (date: Date) => date.toLocaleDateString(),
          validateSchema: (data: any, schema: any) => ({ valid: true }),
          log: (message: string, level = 'info') => {
            console.log(`[${level.toUpperCase()}] Navigation Menu: ${message}`)
          }
        }
      }

      // Execute the script based on type
      if (menuItem.scriptType === 'navigation' && menuItem.href) {
        context.navigation.navigateTo(menuItem.href)
      } else if (menuItem.scriptType === 'workflow') {
        // Parse script for workflow actions
        await scriptSandbox.current.executeScript(menuItem.script, eventPayload, context)
      } else {
        // Custom script execution
        await scriptSandbox.current.executeScript(menuItem.script, eventPayload, context)
      }

    } catch (error) {
      console.error('Error executing menu item script:', error)
    }
  }, [componentId, menuConfig, menuState, updateMenuState])

  // Handle menu item click
  const handleMenuItemClick = useCallback(async (
    menuItem: MenuItem, 
    path: string[], 
    event: React.MouseEvent
  ) => {
    if (menuItem.disabled) return

    // Update active item state
    updateMenuState({ activeItem: menuItem.id })

    // Create event payload
    const eventPayload: NavigationMenuEventPayload = {
      timestamp: Date.now(),
      componentId,
      menuItem,
      action: 'click',
      path,
      modifierKeys: {
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey
      }
    }

    // Execute menu item script if present
    if (menuItem.script) {
      await executeMenuItemScript(menuItem, eventPayload)
    }

    // Notify parent component
    onMenuItemClick?.(eventPayload)

    // Navigate if href is present and no script handled navigation
    if (menuItem.href && !menuItem.script) {
      if (event.ctrlKey || event.metaKey) {
        window.open(menuItem.href, '_blank', 'noopener,noreferrer')
      } else {
        window.location.href = menuItem.href
      }
    }
  }, [executeMenuItemScript, onMenuItemClick, updateMenuState])

  // Expose interface methods via ref
  useImperativeHandle(ref, () => ({
    // Menu state management
    openMenu: ({ menuId }: { menuId: string }) => {
      updateMenuState({
        openMenus: [...menuState.openMenus, menuId]
      })
    },
    closeMenu: ({ menuId }: { menuId: string }) => {
      updateMenuState({
        openMenus: menuState.openMenus.filter(id => id !== menuId)
      })
    },
    closeAllMenus: () => {
      updateMenuState({ openMenus: [] })
    },
    setActiveItem: ({ itemId }: { itemId: string }) => {
      updateMenuState({ activeItem: itemId })
    },

    // Component metadata
    componentInterface: NavigationMenuEventInterface,
    componentId,
    getConfig: () => menuConfig,
    getState: () => menuState
  }), [componentId, menuConfig, menuState, updateMenuState])

  // Render menu item recursively
  const renderMenuItem = (item: MenuItem, path: string[] = [], depth = 0): React.ReactNode => {
    const itemPath = [...path, item.id]
    const hasChildren = Array.isArray(item.children) && item.children.length > 0
    const isOpen = menuState.openMenus.includes(item.id)
    const isActive = menuState.activeItem === item.id

    if (hasChildren) {
      return (
        <NavigationMenuPrimitive.Item key={item.id} value={item.id}>
          <NavigationMenuPrimitive.Trigger
            onPointerEnter={() => {
              if (menuConfig.trigger === 'hover') updateMenuState({ hoveredItem: item.id })
            }}
            onPointerLeave={() => {
              if (menuConfig.trigger === 'hover') updateMenuState({ hoveredItem: undefined })
            }}
            data-active={isActive || undefined}
            data-open={isOpen || undefined}
            className={cn(
              "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50",
              item.disabled && "opacity-50 cursor-not-allowed",
              isActive && "bg-accent/50"
            )}
            disabled={item.disabled}
          >
            {menuConfig.showIcons && item.icon && (
              <span className="mr-2 h-4 w-4" dangerouslySetInnerHTML={{ __html: item.icon }} />
            )}
            {item.label}
            {menuConfig.showBadges && item.badge && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {item.badge}
              </span>
            )}
            <ChevronDown
              className="relative top-[1px] ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </NavigationMenuPrimitive.Trigger>
          <NavigationMenuPrimitive.Content className="absolute top-full left-0 w-full sm:w-auto">
            <div className="m-0 grid gap-3 p-4 md:w-[300px] lg:w-[400px] bg-popover text-popover-foreground rounded-md shadow-lg border data-[debug]:border-red-500" data-debug={process.env.NODE_ENV !== 'production' ? 'true' : undefined}>
              {Array.isArray(item.children) && item.children.length > 0 ? item.children.map(child => (
                <a
                  key={child.id}
                  href={child.href || '#'}
                  className={cn(
                    "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                    child.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                  )}
                  onClick={(e) => {
                    e.preventDefault()
                    if (!child.disabled) {
                      handleMenuItemClick(child, [...itemPath, child.id], e)
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    {menuConfig.showIcons && child.icon && (
                      <span className="h-4 w-4 shrink-0" dangerouslySetInnerHTML={{ __html: child.icon }} />
                    )}
                    <div className="text-sm font-medium leading-none">{child.label}</div>
                    {menuConfig.showBadges && child.badge && (
                      <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {child.badge}
                      </span>
                    )}
                  </div>

                </a>
              )) : (
                <div className="text-xs text-muted-foreground italic">
                  {Array.isArray(item.children) ? 'No child items (array empty)' : 'Children not an array'}
                </div>
              )}
            </div>
          </NavigationMenuPrimitive.Content>
        </NavigationMenuPrimitive.Item>
      )
    }

    return (
      <NavigationMenuPrimitive.Item key={item.id}>
        <NavigationMenuPrimitive.Link
          className={cn(
            "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50",
            item.disabled && "opacity-50 cursor-not-allowed",
            isActive && "bg-accent/50"
          )}
          href={item.href}
          onClick={(e) => {
            e.preventDefault()
            handleMenuItemClick(item, itemPath, e)
          }}
        >
          {menuConfig.showIcons && item.icon && (
            <span className="mr-2 h-4 w-4" dangerouslySetInnerHTML={{ __html: item.icon }} />
          )}
          {item.label}
          {menuConfig.showBadges && item.badge && (
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {item.badge}
            </span>
          )}
          {item.href && (
            <ExternalLink className="ml-2 h-3 w-3" />
          )}
        </NavigationMenuPrimitive.Link>
      </NavigationMenuPrimitive.Item>
    )
  }

  return (
    <NavigationMenuPrimitive.Root
      ref={containerRef}
      className={cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className)}
      orientation={menuConfig.orientation || 'horizontal'}
    >
      <NavigationMenuPrimitive.List className="group flex flex-1 list-none items-center justify-center space-x-1">
        {Array.isArray(menuConfig?.items) ? menuConfig.items.map(item => renderMenuItem(item)) : null}
      </NavigationMenuPrimitive.List>
      <div className="absolute left-0 top-full flex w-full justify-center">
        <NavigationMenuPrimitive.Viewport className="origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]" />
      </div>
    </NavigationMenuPrimitive.Root>
  )
})

EnhancedNavigationMenu.displayName = "EnhancedNavigationMenu"

export { NavigationMenuEventInterface }