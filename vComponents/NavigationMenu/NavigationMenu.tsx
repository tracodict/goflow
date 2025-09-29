/**
 * NavigationMenu Component
 * 
 * Enhanced navigation menu component with event system and dynamic configuration.
 * Integrated implementation with full feature set.
 */

"use client"

import * as React from "react"
import { useState, useRef, useCallback, useImperativeHandle, useEffect, forwardRef } from "react"
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { BaseEventPayload } from "@/lib/component-interface"
import { 
  MenuInteractionEventPayload, 
  MenuItem, 
  NavigationMenuConfig, 
  MenuState, 
  NavigationMenuEventPayload,
  MenuItemScriptContext,
  NavigationMenuEventInterface
} from "./interface"

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

// Component props interface
export interface NavigationMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  config?: NavigationMenuConfig
  
  // Script integration props
  isPreview?: boolean
  elementId?: string
  
  // Event handlers (for script integration)
  onScriptMenuItemClick?: (payload: MenuInteractionEventPayload) => void
  onScriptMenuStateChange?: (payload: MenuInteractionEventPayload) => void
  onScriptMount?: (payload: BaseEventPayload) => void
  onScriptUnmount?: (payload: BaseEventPayload) => void
  
  // Direct event handlers
  onMenuItemClick?: (payload: NavigationMenuEventPayload) => void
  onMenuStateChange?: (state: MenuState) => void
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuPrimitive.Link asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuPrimitive.Link>
    </li>
  )
})
ListItem.displayName = "ListItem"

// NavigationMenu component implementation
const NavigationMenu = forwardRef<any, NavigationMenuProps>(
  ({ 
    config = { items: [] },
    className,
    isPreview = false,
    elementId,
    onScriptMenuItemClick,
    onScriptMenuStateChange,
    onScriptMount,
    onScriptUnmount,
    onMenuItemClick,
    onMenuStateChange,
    ...props 
  }, ref) => {
    
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
    
    // Generate unique component ID if not provided
    const [componentId] = useState(() => 
      elementId || `nav-menu-${Math.random().toString(36).substr(2, 9)}`
    )
    
    const containerRef = useRef<HTMLElement>(null)
    const scriptSandbox = useRef(new ScriptSandbox())

    // Debug: lifecycle + config changes
    useEffect(() => {
      console.debug('[NavigationMenu] mount', { itemCount: menuConfig.items.length, items: menuConfig.items })
      return () => console.debug('[NavigationMenu] unmount')
    }, [])

    useEffect(() => {
      console.debug('[NavigationMenu] config changed', { itemCount: menuConfig.items.length, items: menuConfig.items })
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
    
    // Mount/unmount effects for scriptable components
    useEffect(() => {
      if (isPreview && onScriptMount) {
        const payload: BaseEventPayload = {
          timestamp: Date.now(),
          componentId: componentId,
          eventType: 'mount'
        }
        onScriptMount(payload)
      }
      
      return () => {
        if (isPreview && onScriptUnmount) {
          const payload: BaseEventPayload = {
            timestamp: Date.now(),
            componentId: componentId,
            eventType: 'unmount'
          }
          onScriptUnmount(payload)
        }
      }
    }, [isPreview, onScriptMount, onScriptUnmount, componentId])

    // Update menu state and notify listeners
    const updateMenuState = useCallback((newState: Partial<MenuState>) => {
      setMenuState(prevState => {
        const updatedState = { ...prevState, ...newState }
        onMenuStateChange?.(updatedState)
        
        // Script integration handler
        if (isPreview && onScriptMenuStateChange) {
          const payload: MenuInteractionEventPayload = {
            timestamp: Date.now(),
            componentId: componentId,
            eventType: 'menuStateChange',
            menuState: {
              isOpen: updatedState.openMenus.length > 0,
              activeItem: updatedState.activeItem
            }
          }
          onScriptMenuStateChange(payload)
        }
        
        return updatedState
      })
    }, [onMenuStateChange, isPreview, onScriptMenuStateChange, componentId])

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

      // Script integration handler
      if (isPreview && onScriptMenuItemClick) {
        const payload: MenuInteractionEventPayload = {
          timestamp: Date.now(),
          componentId: componentId,
          eventType: 'menuItemClick',
          menuItem: {
            id: menuItem.id,
            label: menuItem.label,
            href: menuItem.href
          }
        }
        onScriptMenuItemClick(payload)
      }

      // Navigate if href is present and no script handled navigation
      if (menuItem.href && !menuItem.script) {
        if (event.ctrlKey || event.metaKey) {
          window.open(menuItem.href, '_blank', 'noopener,noreferrer')
        } else {
          window.location.href = menuItem.href
        }
      }
    }, [executeMenuItemScript, onMenuItemClick, updateMenuState, isPreview, onScriptMenuItemClick, componentId])

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
                updateMenuState({ hoveredItem: item.id })
              }}
              onPointerLeave={() => {
                updateMenuState({ hoveredItem: undefined })
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
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded">
                  {item.badge.text}
                </span>
              )}
              <ChevronDown
                className="relative top-[1px] ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </NavigationMenuPrimitive.Trigger>
            <NavigationMenuPrimitive.Content>
              <div className="min-w-[250px] max-w-[350px] bg-popover border border-border rounded-md shadow-lg p-2">
                {item.children?.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={(e) => handleMenuItemClick(child, [...itemPath, child.id], e as any)}
                    className={cn(
                      "text-left w-full mb-1 last:mb-0 rounded-md px-3 py-2 transition-colors",
                      "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none",
                      "flex flex-col"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {menuConfig.showIcons && child.icon && (
                        <span className="h-4 w-4 shrink-0" dangerouslySetInnerHTML={{ __html: child.icon }} />
                      )}
                      <span className="text-sm font-medium leading-none truncate">{child.label}</span>
                      {menuConfig.showBadges && child.badge && (
                        <span className="ml-auto inline-block px-1.5 py-0.5 text-[10px] rounded bg-primary text-primary-foreground leading-none">
                          {child.badge.text}
                        </span>
                      )}
                    </span>
                    {child.href && (
                      <span className="mt-1 text-xs text-muted-foreground break-all leading-snug">
                        {child.href}
                      </span>
                    )}
                  </button>
                ))}
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
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded">
                {item.badge.text}
              </span>
            )}
            {item.disabled && (
              <span className="ml-1 text-xs opacity-60">(Disabled)</span>
            )}
          </NavigationMenuPrimitive.Link>
        </NavigationMenuPrimitive.Item>
      )
    }

    return (
      <div
        data-component-id={componentId}
        data-component-type="NavigationMenu"
        {...props}
      >
        <NavigationMenuPrimitive.Root
          ref={containerRef}
          className={cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className)}
          orientation={menuConfig.orientation || 'horizontal'}
        >
          <NavigationMenuPrimitive.List className="group flex flex-1 list-none items-center justify-center space-x-1">
            {Array.isArray(menuConfig?.items) ? menuConfig.items.map(item => renderMenuItem(item)) : null}
          </NavigationMenuPrimitive.List>
          <div className="absolute left-0 top-full flex justify-start">
            <NavigationMenuPrimitive.Viewport className="relative mt-1.5" />
          </div>
        </NavigationMenuPrimitive.Root>
      </div>
    )
  }
)

NavigationMenu.displayName = "NavigationMenu"

export { NavigationMenu }
export { NavigationMenuEventInterface }