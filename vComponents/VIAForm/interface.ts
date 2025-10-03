/**
 * VIAForm Component Interface
 * 
 * Defines the events, actions, and state that the VIAForm component
 * exposes to the Visual Page Editor scripting system.
 */

import { ComponentEventInterface, defineEvent, defineAction } from "@/lib/component-interface"

// Define JSON schemas for events and actions
const VIAFormEventSchemas = {
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
  
  // Token selected event
  tokenSelected: {
    type: "object" as const,
    properties: {
      timestamp: { type: "number" as const },
      componentId: { type: "string" as const },
      eventType: { type: "string" as const },
      token: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          caseId: { type: "string" as const },
          placeId: { type: "string" as const },
          value: {},
          color: { type: "string" as const }
        },
        required: ["id", "caseId", "placeId", "value"]
      }
    },
    required: ["timestamp", "componentId", "eventType", "token"]
  },

  // Transition fired event
  transitionFired: {
    type: "object" as const,
    properties: {
      timestamp: { type: "number" as const },
      componentId: { type: "string" as const },
      eventType: { type: "string" as const },
      transitionId: { type: "string" as const },
      tokenBinding: {
        type: "object" as const,
        properties: {
          placeId: { type: "string" as const },
          value: {}
        },
        required: ["placeId", "value"]
      },
      success: { type: "boolean" as const }
    },
    required: ["timestamp", "componentId", "eventType", "transitionId", "tokenBinding", "success"]
  },

  // Color changed event
  colorChanged: {
    type: "object" as const,
    properties: {
      timestamp: { type: "number" as const },
      componentId: { type: "string" as const },
      eventType: { type: "string" as const },
      color: { type: "string" as const }
    },
    required: ["timestamp", "componentId", "eventType", "color"]
  }
}

const VIAFormActionSchemas = {
  // Select color/schema action
  selectColor: {
    type: "object" as const,
    properties: {
      color: { type: "string" as const }
    },
    required: ["color"]
  },

  // Fire transition action
  fireTransition: {
    type: "object" as const,
    properties: {
      transitionId: { type: "string" as const },
      tokenBinding: {
        type: "object" as const,
        properties: {
          placeId: { type: "string" as const },
          value: {}
        },
        required: ["placeId", "value"]
      },
      input: {}
    },
    required: ["transitionId", "tokenBinding"]
  },

  // Refresh tokens action
  refreshTokens: {
    type: "object" as const,
    properties: {}
  }
}

const VIAFormStateSchemas = {
  selectedColor: { type: "string" as const },
  loading: { type: "boolean" as const },
  error: { type: "string" as const }
}

export const VIAFormComponentInterface: ComponentEventInterface = {
  componentType: "VIAForm",
  displayName: "VIA Form",
  description: "View, Inspect, and Act on workflow tokens by color/schema",
  
  lifecycle: {
    onMount: defineEvent(
      'Fired when the VIAForm component is mounted',
      VIAFormEventSchemas.base,
      { category: 'lifecycle' }
    ),
    onUnmount: defineEvent(
      'Fired when the VIAForm component is unmounted',
      VIAFormEventSchemas.base,
      { category: 'lifecycle' }
    )
  },
  
  events: {
    onTokenSelected: defineEvent(
      "Fired when a token is selected in the grid",
      VIAFormEventSchemas.tokenSelected,
      { category: 'interaction' }
    ),
    
    onTransitionFired: defineEvent(
      "Fired when a transition is executed",
      VIAFormEventSchemas.transitionFired,
      { category: 'interaction' }
    ),

    onColorChanged: defineEvent(
      "Fired when the selected color/schema changes",
      VIAFormEventSchemas.colorChanged,
      { category: 'data' }
    )
  },

  actions: {
    selectColor: defineAction(
      "Programmatically select a color/schema",
      VIAFormActionSchemas.selectColor,
      { category: 'state', async: false }
    ),

    fireTransition: defineAction(
      "Fire a transition with the given token binding and input",
      VIAFormActionSchemas.fireTransition,
      { category: 'data', async: true }
    ),

    refreshTokens: defineAction(
      "Refresh the token list for the current color",
      VIAFormActionSchemas.refreshTokens,
      { category: 'data', async: true }
    ),

    getSelectedColor: defineAction(
      "Get the currently selected color/schema",
      { type: "object" as const, properties: {} },
      { category: 'state', async: false }
    ),

    getTokens: defineAction(
      "Get the current list of tokens",
      { type: "object" as const, properties: {} },
      { category: 'data', async: false }
    )
  },

  state: {
    selectedColor: {
      description: 'Currently selected color/schema',
      type: VIAFormStateSchemas.selectedColor
    },
    loading: {
      description: 'Whether the form is loading data',
      type: VIAFormStateSchemas.loading
    },
    error: {
      description: 'Current error message if any',
      type: VIAFormStateSchemas.error
    }
  }
}