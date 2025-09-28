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