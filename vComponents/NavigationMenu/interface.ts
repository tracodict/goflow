import type { BaseEventPayload } from "@/lib/component-interface"

// Menu-specific event payload interface  
export interface MenuInteractionEventPayload extends BaseEventPayload {
  // Menu item information (for menu item click events)
  menuItem?: {
    id: string
    label: string
    href?: string
  }
  
  // Menu state information (for state change events) 
  menuState?: {
    isOpen: boolean
    activeItem?: string
  }
}

// Complete interface definitions from enhanced-navigation-menu

// Core menu item interface
export interface MenuItem {
  id: string
  label: string
  href?: string
  icon?: string
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
  disabled?: boolean
  children?: MenuItem[]
  script?: string
  scriptType?: 'navigation' | 'workflow' | 'custom'
}

// Navigation menu configuration
export interface NavigationMenuConfig {
  items: MenuItem[]
  orientation?: 'horizontal' | 'vertical'
  showIcons?: boolean
  showBadges?: boolean
  defaultOpen?: string[]
}

// Menu state interface
export interface MenuState {
  openMenus: string[]
  activeItem?: string
  hoveredItem?: string
}

// Event payload for navigation menu events
export interface NavigationMenuEventPayload {
  timestamp: number
  componentId: string
  menuItem: MenuItem
  action: string
  path: string[]
  modifierKeys: {
    ctrl: boolean
    shift: boolean
    alt: boolean
  }
}

// Script context interfaces
export interface MenuItemScriptContext {
  component: {
    id: string
    getConfig: () => NavigationMenuConfig
    setConfig: (config: Partial<NavigationMenuConfig>) => void
    getState: () => MenuState
    setState: (state: Partial<MenuState>) => void
    emit: (event: string, payload: any) => void
  }
  navigation: {
    navigateTo: (path: string, options?: { newTab?: boolean }) => void
    goBack: () => void
    goForward: () => void
    getCurrentPath: () => string
  }
  ui: {
    showNotification: (options: { type: 'info' | 'success' | 'warning' | 'error', message: string }) => void
    openModal: (modalId: string, props?: any) => void
    closeModal: (modalId: string) => void
  }
  user: {
    id: string
    name: string
    email: string
    roles: string[]
    permissions: string[]
  }
  workflow: {
    createCase: (workflowId: string, data?: any) => Promise<string>
    executeAction: (actionId: string, params?: any) => Promise<any>
  }
  data: {
    query: (queryId: string, params?: any) => Promise<any>
    mutate: (mutation: any) => Promise<any>
    subscribe: (callback: Function) => () => void
  }
  utils: {
    formatDate: (date: Date) => string
    validateSchema: (data: any, schema: any) => { valid: boolean }
    log: (message: string, level?: string) => void
  }
}

// Component interface for enhanced navigation menu
export const NavigationMenuEventInterface = {
  events: [
    {
      name: 'menuItemClick',
      description: 'Fired when a menu item is clicked',
      payload: {
        timestamp: 'number',
        componentId: 'string', 
        menuItem: 'MenuItem',
        action: 'string',
        path: 'string[]',
        modifierKeys: 'object'
      }
    },
    {
      name: 'menuStateChange',
      description: 'Fired when menu state changes (open/close, active item)',
      payload: {
        timestamp: 'number',
        componentId: 'string',
        state: 'MenuState'
      }
    }
  ],
  methods: [
    {
      name: 'openMenu',
      description: 'Open a specific menu by ID',
      parameters: { menuId: 'string' }
    },
    {
      name: 'closeMenu', 
      description: 'Close a specific menu by ID',
      parameters: { menuId: 'string' }
    },
    {
      name: 'closeAllMenus',
      description: 'Close all open menus'
    },
    {
      name: 'setActiveItem',
      description: 'Set the active menu item',
      parameters: { itemId: 'string' }
    }
  ]
}