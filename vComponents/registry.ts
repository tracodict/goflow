/**
 * Component Registry
 * 
 * Central registry for all components in the vComponents directory.
 * This file is responsible for registering all components so they appear
 * in the component library of the PageBuilder.
 */

import { MousePointer, Navigation, Table, FolderTree, Eye } from 'lucide-react'
import { ButtonComponent, ButtonComponentInterface } from './Button'
import { NavigationMenuComponent } from './NavigationMenu'
import { DataGridComponent } from './DataGrid'
import { S3ExplorerComponent } from './S3Explorer'
import { VIAFormComponentInterface } from './VIAForm'

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
    },
    {
      name: 'DynamicForm',
      category: 'Form',
      description: 'Schema-driven JSON Schema form (auto layout)',
      icon: Table,
      template: {
        tagName: 'div',
        attributes: {
          'data-component-type': 'DynamicForm',
          'data-scriptable': 'true',
          'data-schema-id': 'example-schema',
          'data-ui-schema': JSON.stringify({ 'ui:order': [] }),
          'data-initial-value': JSON.stringify({})
        },
        styles: {
          width: '100%',
          minHeight: '140px',
          margin: '8px 0',
          border: '1px dashed #cbd5e1',
          borderRadius: '6px',
          padding: '8px',
          background: '#f8fafc'
        },
        content: 'DynamicForm (configure data-schema-id)'
      }
    },
    {
      name: 'FormLauncher',
      category: 'Form',
      description: 'Button that opens a DynamicForm inside a dialog',
      icon: MousePointer,
      template: {
        tagName: 'div',
        attributes: {
          'data-component-type': 'DialogFormLauncher',
          'data-scriptable': 'true',
          'data-schema-id': 'example-schema',
          'data-dialog-title': 'Edit Example',
          'data-bindings': JSON.stringify({ 'name': '$.user.name' }),
          'data-ui-schema': JSON.stringify({ 'ui:order': ['name', '*'] })
        },
        styles: {
          padding: '10px 18px',
          backgroundColor: '#6366f1',
          color: '#ffffff',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'inline-block',
          fontSize: '14px',
          fontWeight: 500,
          userSelect: 'none',
          margin: '8px 0'
        },
        content: 'Open Form Dialog'
      }
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
  ],
  workflow: [
    {
      name: 'VIAForm',
      category: 'Workflow',
      description: 'View, Inspect, and Act on workflow tokens by color/schema',
      icon: Eye,
      template: {
        tagName: 'div',
        attributes: {
          'data-component-type': 'VIAForm',
          'data-scriptable': 'true',
          'data-initial-color': '',
          'data-show-color-selector': 'true',
          'data-show-action-buttons': 'true',
          'data-height': '400px',
          'data-width': '100%'
        },
        styles: {
          width: '100%',
          minHeight: '400px',
          margin: '8px 0',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '0',
          display: 'flex',
          flexDirection: 'column'
        },
        content: ''
      },
      interface: VIAFormComponentInterface
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