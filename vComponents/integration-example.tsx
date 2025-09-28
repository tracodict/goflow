/**
 * Integration Example: Using vComponents Registry with ComponentsTab
 * 
 * This file demonstrates how to integrate the new vComponents registry
 * with the existing ComponentsTab to automatically display registered components.
 */

import React from 'react'
import { MousePointer, Type, ImageIcon } from 'lucide-react'
import { componentRegistry, getAllComponents, getComponentsByCategory } from '@/vComponents/registry'

// Example of how to integrate with existing ComponentsTab
export function getUpdatedComponentCategories() {
  // Get existing hardcoded components (to maintain compatibility)
  const existingCategories = [
    {
      key: "typography",
      label: "Typography",
      components: [
        {
          icon: Type,
          name: "Heading",
          description: "Page heading",
          template: {
            tagName: "h1",
            attributes: {},
            styles: {
              fontSize: "36px",
              fontWeight: "bold",
              color: "#1f2937",
              margin: "24px 0 12px 0",
            },
            content: "Main Heading",
          },
        }
        // ... other existing components
      ],
    }
  ]

  // Add vComponents registry components
  const vComponentCategories = Object.entries(componentRegistry).map(([categoryKey, components]) => ({
    key: categoryKey,
    label: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1), // Capitalize first letter
    components: components.map(component => ({
      icon: component.icon,
      name: component.name,
      description: component.description,
      template: component.template
    }))
  }))

  // Merge existing and vComponents
  return [...existingCategories, ...vComponentCategories]
}

// Example of updated ComponentsTab integration
export function IntegratedComponentsTab() {
  const categories = getUpdatedComponentCategories()
  
  return (
    <div className="h-full">
      {/* Display message about new architecture */}
      <div className="p-4 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>New Architecture:</strong> Components from vComponents registry are now automatically available.
          Add new components by registering them in <code>vComponents/registry.ts</code>
        </p>
      </div>
      
      {/* Rest of ComponentsTab implementation would use the merged categories */}
      {categories.map((category, index) => (
        <div key={category.key} className="mb-4">
          <h3 className="font-semibold mb-2">{category.label}</h3>
          <div className="grid grid-cols-2 gap-2">
            {category.components.map((component, componentIndex) => (
              <button
                key={componentIndex}
                className="p-3 border rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-2">
                  <component.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{component.name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{component.description}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Utility function to get component interface for scripting
export function getComponentInterface(componentName: string) {
  const component = getAllComponents().find(comp => comp.name === componentName)
  return component?.interface
}

// Example of how to create a new component programmatically
export function createButtonInstance() {
  const buttonComponent = componentRegistry.form.find(comp => comp.name === 'Button')
  if (!buttonComponent) return null

  return {
    id: `button-${Math.random().toString(36).substr(2, 9)}`,
    type: 'Button',
    template: buttonComponent.template,
    interface: buttonComponent.interface,
    props: {
      scriptable: true,
      variant: 'default',
      children: 'Click me'
    }
  }
}