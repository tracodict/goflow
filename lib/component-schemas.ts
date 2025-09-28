/**
 * Pre-defined JSON schemas for common component events and actions
 */

import type { JSONSchema } from '@/jsonjoy-builder/src/types/jsonSchema'
import { NavigationMenuEventInterface } from './types/navigation-menu-interface'
import { componentRegistry } from './component-registry'

// Auto-register the Enhanced Navigation Menu component
componentRegistry.register(NavigationMenuEventInterface as any)

/**
 * Common event payload schemas
 */
export const EventSchemas = {
  /** Basic event with timestamp and component info */
  base: {
    type: 'object',
    properties: {
      timestamp: { type: 'number' },
      componentId: { type: 'string' },
      eventType: { type: 'string' }
    },
    required: ['timestamp', 'componentId', 'eventType']
  } as JSONSchema,

  /** Click event with modifier keys and position */
  click: {
    type: 'object',
    properties: {
      timestamp: { type: 'number' },
      componentId: { type: 'string' },
      eventType: { type: 'string' },
      modifierKeys: {
        type: 'object',
        properties: {
          ctrl: { type: 'boolean' },
          shift: { type: 'boolean' },
          alt: { type: 'boolean' },
          meta: { type: 'boolean' }
        },
        required: ['ctrl', 'shift', 'alt', 'meta']
      },
      position: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        },
        required: ['x', 'y']
      }
    },
    required: ['timestamp', 'componentId', 'eventType', 'modifierKeys']
  } as JSONSchema,

  /** Value change event */
  valueChange: {
    type: 'object',
    properties: {
      timestamp: { type: 'number' },
      componentId: { type: 'string' },
      eventType: { type: 'string' },
      value: {}, // Any type
      previousValue: {},
      isValid: { type: 'boolean' }
    },
    required: ['timestamp', 'componentId', 'eventType', 'value']
  } as JSONSchema,

  /** Form submission event */
  submit: {
    type: 'object',
    properties: {
      timestamp: { type: 'number' },
      componentId: { type: 'string' },
      eventType: { type: 'string' },
      formData: {
        type: 'object',
        additionalProperties: true
      },
      isValid: { type: 'boolean' },
      validationErrors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            message: { type: 'string' }
          },
          required: ['field', 'message']
        }
      }
    },
    required: ['timestamp', 'componentId', 'eventType', 'formData', 'isValid']
  } as JSONSchema,

  /** Focus event */
  focus: {
    type: 'object',
    properties: {
      timestamp: { type: 'number' },
      componentId: { type: 'string' },
      eventType: { type: 'string' },
      direction: { 
        type: 'string',
        enum: ['in', 'out']
      }
    },
    required: ['timestamp', 'componentId', 'eventType', 'direction']
  } as JSONSchema,

  /** Selection change event */
  selectionChange: {
    type: 'object',
    properties: {
      timestamp: { type: 'number' },
      componentId: { type: 'string' },
      eventType: { type: 'string' },
      selectedItems: {
        type: 'array',
        items: {}
      },
      selectedIndexes: {
        type: 'array',
        items: { type: 'number' }
      },
      isMultiple: { type: 'boolean' }
    },
    required: ['timestamp', 'componentId', 'eventType', 'selectedItems', 'isMultiple']
  } as JSONSchema
}

/**
 * Common action parameter schemas
 */
export const ActionSchemas = {
  /** Set loading state */
  setLoading: {
    type: 'object',
    properties: {
      loading: { type: 'boolean' },
      message: { type: 'string' }
    },
    required: ['loading']
  } as JSONSchema,

  /** Set disabled state */
  setDisabled: {
    type: 'object',
    properties: {
      disabled: { type: 'boolean' },
      reason: { type: 'string' }
    },
    required: ['disabled']
  } as JSONSchema,

  /** Set visibility */
  setVisible: {
    type: 'object',
    properties: {
      visible: { type: 'boolean' },
      animation: {
        type: 'string',
        enum: ['none', 'fade', 'slide', 'scale']
      }
    },
    required: ['visible']
  } as JSONSchema,

  /** Set component value */
  setValue: {
    type: 'object',
    properties: {
      value: {}, // Any type
      validate: { type: 'boolean' },
      triggerChange: { type: 'boolean' }
    },
    required: ['value']
  } as JSONSchema,

  /** Update style properties */
  setStyle: {
    type: 'object',
    properties: {
      styles: {
        type: 'object',
        additionalProperties: { type: 'string' }
      },
      merge: { type: 'boolean' }
    },
    required: ['styles']
  } as JSONSchema,

  /** Set validation state */
  setValidation: {
    type: 'object',
    properties: {
      isValid: { type: 'boolean' },
      errors: {
        type: 'array',
        items: { type: 'string' }
      },
      showErrors: { type: 'boolean' }
    },
    required: ['isValid']
  } as JSONSchema,

  /** Navigate to page */
  navigate: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      replace: { type: 'boolean' },
      state: {}
    },
    required: ['path']
  } as JSONSchema,

  /** Show notification */
  showNotification: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      type: {
        type: 'string',
        enum: ['info', 'success', 'warning', 'error']
      },
      duration: { type: 'number' },
      closeable: { type: 'boolean' }
    },
    required: ['message']
  } as JSONSchema,

  /** Trigger data query */
  triggerQuery: {
    type: 'object',
    properties: {
      queryId: { type: 'string' },
      parameters: {
        type: 'object',
        additionalProperties: true
      },
      refresh: { type: 'boolean' }
    },
    required: ['queryId']
  } as JSONSchema,

  /** Call workflow */
  callWorkflow: {
    type: 'object',
    properties: {
      workflowId: { type: 'string' },
      payload: {
        type: 'object',
        additionalProperties: true
      },
      async: { type: 'boolean' }
    },
    required: ['workflowId']
  } as JSONSchema
}

/**
 * Component state schemas
 */
export const StateSchemas = {
  /** Loading state */
  loading: {
    type: 'boolean',
    description: 'Whether the component is in a loading state'
  } as JSONSchema,

  /** Disabled state */
  disabled: {
    type: 'boolean',
    description: 'Whether the component is disabled'
  } as JSONSchema,

  /** Visible state */
  visible: {
    type: 'boolean',
    description: 'Whether the component is visible'
  } as JSONSchema,

  /** Value state */
  value: {
    description: 'Current value of the component'
  } as JSONSchema,

  /** Validation state */
  validation: {
    type: 'object',
    properties: {
      isValid: { type: 'boolean' },
      errors: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['isValid']
  } as JSONSchema,

  /** Selection state */
  selection: {
    type: 'object',
    properties: {
      selectedItems: { type: 'array' },
      selectedIndexes: {
        type: 'array',
        items: { type: 'number' }
      }
    }
  } as JSONSchema
}

/**
 * Return type schemas for actions
 */
export const ReturnTypeSchemas = {
  /** Success/failure result */
  result: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      data: {}
    },
    required: ['success']
  } as JSONSchema,

  /** Validation result */
  validationResult: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      errors: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['valid']
  } as JSONSchema,

  /** Query result */
  queryResult: {
    type: 'object',
    properties: {
      data: {},
      loading: { type: 'boolean' },
      error: { type: 'string' },
      timestamp: { type: 'number' }
    }
  } as JSONSchema
}