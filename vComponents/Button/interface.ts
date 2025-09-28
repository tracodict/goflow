/**
 * Button Component Interface
 * 
 * Defines the events, actions, and state that the Button component
 * exposes to the Visual Page Editor scripting system.
 */

import { ComponentEventInterface, defineEvent, defineAction } from "@/lib/component-interface"

// Define JSON schemas for events and actions
const ButtonEventSchemas = {
  // Base event schema
  base: {
    type: "object" as const,
    properties: {
      timestamp: { type: "number" as const },
      componentId: { type: "string" as const },
      eventType: { type: "string" as const }
    },
    required: ["timestamp", "componentId", "eventType"]
  },
  
  // Click event schema
  click: {
    type: "object" as const,
    properties: {
      timestamp: { type: "number" as const },
      componentId: { type: "string" as const },
      eventType: { type: "string" as const },
      modifierKeys: {
        type: "object" as const,
        properties: {
          ctrl: { type: "boolean" as const },
          shift: { type: "boolean" as const },
          alt: { type: "boolean" as const },
          meta: { type: "boolean" as const }
        },
        required: ["ctrl", "shift", "alt", "meta"]
      },
      position: {
        type: "object" as const,
        properties: {
          x: { type: "number" as const },
          y: { type: "number" as const }
        },
        required: ["x", "y"]
      }
    },
    required: ["timestamp", "componentId", "eventType", "modifierKeys"]
  }
}

const ButtonActionSchemas = {
  // Set loading state
  setLoading: {
    type: "object" as const,
    properties: {
      loading: { type: "boolean" as const },
      message: { type: "string" as const }
    },
    required: ["loading"]
  },
  
  // Set disabled state
  setDisabled: {
    type: "object" as const,
    properties: {
      disabled: { type: "boolean" as const }
    },
    required: ["disabled"]
  },
  
  // Set visibility
  setVisible: {
    type: "object" as const,
    properties: {
      visible: { type: "boolean" as const }
    },
    required: ["visible"]
  }
}

const ButtonStateSchemas = {
  loading: { type: "boolean" as const },
  disabled: { type: "boolean" as const },
  visible: { type: "boolean" as const }
}

// Component interface definition
export const ButtonComponentInterface: ComponentEventInterface = {
  componentType: 'Button',
  displayName: 'Button',
  description: 'Interactive button component that can trigger actions and workflows',
  
  lifecycle: {
    onMount: defineEvent(
      'Fired when the button component is mounted',
      ButtonEventSchemas.base,
      { category: 'lifecycle' }
    ),
    onUnmount: defineEvent(
      'Fired when the button component is unmounted',
      ButtonEventSchemas.base,
      { category: 'lifecycle' }
    )
  },
  
  events: {
    onClick: defineEvent(
      'Fired when the button is clicked',
      ButtonEventSchemas.click,
      { 
        category: 'interaction',
        preventDefault: true
      }
    )
  },
  
  actions: {
    setLoading: defineAction(
      'Set the loading state of the button',
      ButtonActionSchemas.setLoading,
      { 
        category: 'state',
        async: false
      }
    ),
    setDisabled: defineAction(
      'Set the disabled state of the button',
      ButtonActionSchemas.setDisabled,
      { 
        category: 'state',
        async: false
      }
    ),
    setVisible: defineAction(
      'Set the visibility of the button',
      ButtonActionSchemas.setVisible,
      { 
        category: 'state',
        async: false
      }
    )
  },
  
  state: {
    loading: {
      description: 'Whether the button is in loading state',
      type: ButtonStateSchemas.loading
    },
    disabled: {
      description: 'Whether the button is disabled',
      type: ButtonStateSchemas.disabled
    },
    visible: {
      description: 'Whether the button is visible',
      type: ButtonStateSchemas.visible
    }
  }
}