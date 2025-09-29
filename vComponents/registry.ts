/**
 * Component Registry
 * 
 * Central registry for all components in the vComponents directory.
 * This file is responsible for registering all components so they appear
 * in the component library of the PageBuilder.
 */

import { MousePointer, Navigation, Table, FolderTree } from 'lucide-react'
import { ButtonComponent, ButtonComponentInterface } from './Button'
import { NavigationMenuComponent } from './NavigationMenu'
import { DataGridComponent } from './DataGrid'
import { S3ExplorerComponent } from './S3Explorer'

// Define the component registration interface
export interface ComponentRegistration {
  name: string
  category: string
  description: string
  icon: any // Lucide icon component
  template: {
    tagName: string
    attributes: Record<string, string>
    styles: Record<string, any>
    content: string
  }
  interface?: any // Component interface for scripting
}

// Registry of all available components organized by category
export const componentRegistry: Record<string, ComponentRegistration[]> = {
  form: [
    {
      name: 'Button',
      category: 'Form',
      description: 'Interactive button with scripting support',
      icon: MousePointer,
      template: {
        tagName: 'div',
        attributes: {
          'data-component-type': 'Button',
          'data-scriptable': 'true'
        },
        styles: {
          padding: '12px 24px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          margin: '8px 0',
          display: 'inline-block',
          textAlign: 'center' as const
        },
        content: 'Click me'
      },
      interface: ButtonComponentInterface
    }
  ],
  navigation: [
    {
      name: 'NavigationMenu',
      category: 'Navigation',
      description: 'Enhanced navigation menu with scripting support',
      icon: Navigation,
      template: {
        tagName: 'div',
        attributes: {
          'data-component-type': 'NavigationMenu',
          'data-scriptable': 'true',
          'data-config': JSON.stringify({ 
            items: [
              {
                id: "home",
                label: "Home",
                href: "/Home"
              },

              {
                id: "services",
                label: "Services",
                children: [
                  {
                    id: "rfq",
                    label: "RFQ",
                    href: "/svc/rfq"
                  },
                  {
                    id: "quote",
                    label: "Quote",
                    href: "/svc/quote"
                  }
                ]
              },
              {
                id: "help",
                label: "Help",
                href: "/help"
              },
            ]
          })
        },
        styles: {
          padding: '8px 0',
          margin: '8px 0',
          display: 'block',
          width: '100%'
        },
        content: ''
      }
    }
  ],
  data: [
    {
      name: 'DataGrid',
      category: 'Data',
      description: 'Interactive data grid with query integration',
      icon: Table,
      template: {
        tagName: 'div',
        attributes: {
          'data-component-type': 'data-grid',
          'data-scriptable': 'true',
          'data-query-name': ''
        },
        styles: {
          width: '100%',
          minHeight: '200px',
          margin: '8px 0',
          border: '1px solid #e5e7eb',
          borderRadius: '6px'
        },
        content: ''
      }
    },
    {
      name: 'S3Explorer',
      category: 'Data',
      description: 'Interactive S3 file explorer with browsing capabilities',
      icon: FolderTree,
      template: {
        tagName: 'div',
        attributes: {
          'data-component-type': 's3-explorer',
          'data-scriptable': 'true',
          'data-query-name': ''
        },
        styles: {
          width: '100%',
          minHeight: '300px',
          margin: '8px 0',
          border: '1px solid #e5e7eb',
          borderRadius: '6px'
        },
        content: ''
      }
    }
  ]
}

// Get all components as a flat array
export function getAllComponents(): ComponentRegistration[] {
  return Object.values(componentRegistry).flat()
}

// Get components by category
export function getComponentsByCategory(category: string): ComponentRegistration[] {
  return componentRegistry[category] || []
}

// Get component by name
export function getComponentByName(name: string): ComponentRegistration | undefined {
  return getAllComponents().find(component => component.name === name)
}

// Register a new component
export function registerComponent(component: ComponentRegistration): void {
  if (!componentRegistry[component.category]) {
    componentRegistry[component.category] = []
  }
  componentRegistry[component.category].push(component)
}

// Get all available categories
export function getCategories(): string[] {
  return Object.keys(componentRegistry)
}

// Export property configurations
export { propertyTabRegistry, getPropertyConfig } from './property-config-registry'