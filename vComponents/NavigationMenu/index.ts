// NavigationMenu vComponent exports

export { NavigationMenu } from './NavigationMenu'
export { PageBuilderNavigationMenu } from './PageBuilderNavigationMenu'
export type { MenuInteractionEventPayload } from './interface'

// Register the NavigationMenu component for dynamic rendering in PageElement
import { registerComponentRenderer, createComponentRenderer } from '../component-renderer-registry'

registerComponentRenderer(
  createComponentRenderer(
    'NavigationMenu',
    () => require('./PageBuilderNavigationMenu').PageBuilderNavigationMenu,
    10 // Priority 10 for core components
  )
)

// Component registration information
export const NavigationMenuComponent = {
  name: 'NavigationMenu',
  category: 'Navigation',
  description: 'Enhanced navigation menu with scripting support',
  icon: 'Navigation',
  version: '1.0.0'
}