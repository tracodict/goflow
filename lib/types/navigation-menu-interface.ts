// Enhanced Navigation Menu Component Interface Types
export interface MenuItem {
  id: string
  label: string
  href?: string
  disabled?: boolean
  icon?: string
  badge?: string | number
  script?: string
  scriptType?: 'navigation' | 'workflow' | 'custom'
  children?: MenuItem[]
  metadata?: {
    description?: string
    tags?: string[]
    [key: string]: any
  }
}

export interface NavigationMenuEventPayload {
  timestamp: number
  componentId: string
  menuItem: MenuItem
  action: 'click' | 'hover' | 'focus'
  path: string[] // Path to the menu item (for nested items)
  modifierKeys: {
    ctrl: boolean
    shift: boolean
    alt: boolean
  }
}

export interface MenuState {
  openMenus: string[]
  activeItem?: string
  hoveredItem?: string
}

export interface NavigationMenuConfig {
  items: MenuItem[]
  orientation?: 'horizontal' | 'vertical'
  trigger?: 'click' | 'hover'
  defaultOpen?: string[]
  className?: string
  showIcons?: boolean
  showBadges?: boolean
}

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
  workflow: {
    createCase: (workflowId: string, data?: any) => Promise<string>
    executeAction: (actionId: string, params?: any) => Promise<any>
  }
  data: {
    query: (queryId: string, params?: any) => Promise<any>
    mutate: (mutation: any) => Promise<any>
    subscribe: (callback: Function) => () => void
  }
  ui: {
    showNotification: (options: { type: 'success' | 'error' | 'info' | 'warning', message: string }) => void
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
  utils: {
    formatDate: (date: Date) => string
    validateSchema: (data: any, schema: any) => { valid: boolean; errors?: string[] }
    log: (message: string, level?: 'info' | 'warn' | 'error') => void
  }
}

// Component Event Interface for Enhanced Navigation Menu
export const NavigationMenuEventInterface = {
  componentType: "NavigationMenu",
  displayName: "Menu",
  description: "Advanced navigation menu with nested menu support, custom scripting, and full accessibility built on Radix UI primitives",
  category: "radix",
  version: "1.0.0",
  
  events: {
    onMenuItemClick: {
      description: "Fired when a menu item is clicked",
      category: "interaction",
      payload: {
        type: "object",
        properties: {
          timestamp: { type: "number" },
          componentId: { type: "string" },
          menuItem: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              href: { type: "string" },
              script: { type: "string" },
              scriptType: { 
                type: "string", 
                enum: ["navigation", "workflow", "custom"] 
              }
            }
          },
          action: { type: "string", enum: ["click", "hover", "focus"] },
          path: { 
            type: "array", 
            items: { type: "string" },
            description: "Path to nested menu item"
          },
          modifierKeys: {
            type: "object",
            properties: {
              ctrl: { type: "boolean" },
              shift: { type: "boolean" },
              alt: { type: "boolean" }
            }
          }
        },
        required: ["timestamp", "componentId", "menuItem", "action", "path"]
      }
    },
    onMenuStateChange: {
      description: "Fired when menu open/close state changes",
      category: "state",
      payload: {
        type: "object",
        properties: {
          timestamp: { type: "number" },
          componentId: { type: "string" },
          openMenus: {
            type: "array",
            items: { type: "string" },
            description: "IDs of currently open menus"
          },
          activeItem: { type: "string", description: "Currently active menu item ID" }
        }
      }
    }
  },

  lifecycle: {
    onMount: {
      description: "Fired when the navigation menu component is mounted",
      category: "lifecycle",
      payload: {
        type: "object",
        properties: {
          timestamp: { type: "number" },
          componentId: { type: "string" }
        }
      }
    },
    onUnmount: {
      description: "Fired when the navigation menu component is unmounted",
      category: "lifecycle", 
      payload: {
        type: "object",
        properties: {
          timestamp: { type: "number" },
          componentId: { type: "string" }
        }
      }
    }
  },
  
  actions: {
    setMenuItems: {
      description: "Update the menu items configuration",
      category: "state",
      async: false,
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                href: { type: "string" },
                disabled: { type: "boolean" },
                icon: { type: "string" },
                script: { type: "string" },
                children: { type: "array" }
              },
              required: ["id", "label"]
            }
          }
        },
        required: ["items"]
      }
    },
    openMenu: {
      description: "Programmatically open a specific menu",
      category: "control",
      async: false,
      parameters: {
        type: "object",
        properties: {
          menuId: { type: "string", description: "ID of menu to open" }
        },
        required: ["menuId"]
      }
    },
    closeMenu: {
      description: "Programmatically close a specific menu",
      category: "control",
      async: false,
      parameters: {
        type: "object",
        properties: {
          menuId: { type: "string", description: "ID of menu to close" }
        },
        required: ["menuId"]
      }
    },
    closeAllMenus: {
      description: "Close all open menus",
      category: "control",
      async: false,
      parameters: {
        type: "object",
        properties: {}
      }
    },
    setActiveItem: {
      description: "Set the active menu item",
      category: "control",
      async: false,
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "ID of item to make active" }
        },
        required: ["itemId"]
      }
    }
  },

  state: {
    menuConfig: {
      description: "Current navigation menu configuration including items and settings",
      readonly: false,
      type: {
        type: "object",
        properties: {
          items: { type: "array" },
          orientation: { type: "string", enum: ["horizontal", "vertical"] },
          showIcons: { type: "boolean" },
          showBadges: { type: "boolean" }
        }
      }
    },
    menuState: {
      description: "Current state of the navigation menu including open items and active selection",
      readonly: true,
      type: {
        type: "object", 
        properties: {
          openMenus: { type: "array", items: { type: "string" } },
          activeItem: { type: "string" },
          hoveredItem: { type: "string" }
        }
      }
    }
  }
}