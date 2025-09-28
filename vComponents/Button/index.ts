/**
 * Button Component - Main Export
 * 
 * Exports all public APIs for the Button component including
 * the component itself, interface definition, and types.
 */

export { Button, buttonVariants } from './Button'
export { PageBuilderButton } from './PageBuilderButton'
export { ButtonComponentInterface } from './interface'
export type { ButtonProps } from './Button'
export type { PageBuilderButtonProps } from './PageBuilderButton'

// Register the Button component for dynamic rendering in PageElement
import { registerComponentRenderer, createComponentRenderer } from '../component-renderer-registry'

registerComponentRenderer(
  createComponentRenderer(
    'Button',
    () => require('./PageBuilderButton').PageBuilderButton,
    10 // Priority 10 for core components
  )
)

// Component registration information
export const ButtonComponent = {
  name: 'Button',
  category: 'Form',
  description: 'Interactive button with scripting support',
  icon: 'MousePointer', // Lucide icon name
  template: {
    tagName: 'div',
    attributes: {
      'data-component-type': 'Button',
      'data-scriptable': 'true'
    },
    styles: {
      display: 'inline-block',
      margin: '8px 0'
    },
    content: 'Button'
  }
}