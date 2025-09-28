/**
 * NavigationMenu Component
 * 
 * Enhanced navigation menu component with event system and dynamic configuration.
 * Based on the enhanced-navigation-menu component.
 */

import * as React from "react"
import { EnhancedNavigationMenu } from "../../components/ui/enhanced-navigation-menu"
import type { NavigationMenuEventPayload, MenuState } from "@/lib/types/navigation-menu-interface"
import { BaseEventPayload } from "@/lib/component-interface"
import { MenuInteractionEventPayload } from "./interface"

// Component props interface
export interface NavigationMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  config?: {
    items: Array<{
      id: string
      label: string
      href?: string
      children?: Array<{
        id: string
        label: string
        href?: string
      }>
    }>
  }
  
  // Script integration props
  isPreview?: boolean
  elementId?: string
  
  // Event handlers (for script integration)
  onScriptMenuItemClick?: (payload: MenuInteractionEventPayload) => void
  onScriptMenuStateChange?: (payload: MenuInteractionEventPayload) => void
  onScriptMount?: (payload: BaseEventPayload) => void
  onScriptUnmount?: (payload: BaseEventPayload) => void
}

// NavigationMenu component implementation
const NavigationMenu = React.forwardRef<HTMLDivElement, NavigationMenuProps>(
  ({ 
    config = { items: [] },
    className,
    isPreview = false,
    elementId,
    onScriptMenuItemClick,
    onScriptMenuStateChange,
    onScriptMount,
    onScriptUnmount,
    ...props 
  }, ref) => {
    
    // Generate unique component ID if not provided
    const finalElementId = React.useMemo(() => 
      elementId || `navigation-menu-${Math.random().toString(36).substr(2, 9)}`, 
      [elementId]
    )
    
    // Mount/unmount effects for scriptable components
    React.useEffect(() => {
      if (isPreview && onScriptMount) {
        const payload: BaseEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'mount'
        }
        onScriptMount(payload)
      }
      
      return () => {
        if (isPreview && onScriptUnmount) {
          const payload: BaseEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'unmount'
          }
          onScriptUnmount(payload)
        }
      }
    }, [isPreview, onScriptMount, onScriptUnmount, finalElementId])
    
    // Menu item click handler
    const handleMenuItemClick = React.useCallback((eventPayload: NavigationMenuEventPayload) => {
      if (isPreview && onScriptMenuItemClick) {
        const payload: MenuInteractionEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'menuItemClick',
          menuItem: {
            id: eventPayload.menuItem.id,
            label: eventPayload.menuItem.label,
            href: eventPayload.menuItem.href
          }
        }
        onScriptMenuItemClick(payload)
      }
    }, [isPreview, onScriptMenuItemClick, finalElementId])
    
    // Menu state change handler
    const handleMenuStateChange = React.useCallback((state: MenuState) => {
      if (isPreview && onScriptMenuStateChange) {
        const payload: MenuInteractionEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'menuStateChange',
          menuState: {
            isOpen: state.openMenus.length > 0,
            activeItem: state.activeItem
          }
        }
        onScriptMenuStateChange(payload)
      }
    }, [isPreview, onScriptMenuStateChange, finalElementId])

    return (
      <div
        ref={ref}
        data-component-id={finalElementId}
        data-component-type="NavigationMenu"
        {...props}
      >
        <EnhancedNavigationMenu
          config={config}
          onMenuItemClick={isPreview ? handleMenuItemClick : undefined}
          onMenuStateChange={isPreview ? handleMenuStateChange : undefined}
          className={className}
        />
      </div>
    )
  }
)

NavigationMenu.displayName = "NavigationMenu"

export { NavigationMenu }