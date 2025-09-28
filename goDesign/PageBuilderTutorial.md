# GoFlow PageBuilder Tutorial

## Building Interactive Components with the New vComponents Architecture

This tutorial will guide you through creating interactive components in GoFlow's PageBuilder platform using the new centralized component architecture. All components are now organized in the `vComponents` directory with a registry-based system for automatic discovery and integration.

## Table of Contents
1. [Component Interface Standards](#1-component-interface-standards)
2. [Button Component Implementation Example](#2-button-component-implementation-example)
3. [Event Handling and Scripts](#3-event-handling-and-scripts)
4. [Visual Page Editor Usage](#4-visual-page-editor-usage)
5. [Advanced Scripting Patterns](#5-advanced-scripting-patterns)
6. [Best Practices](#6-best-practices)

---

## 1. Component Interface Standards

### 1.1 Overview

All components in the GoFlow component library must implement a standardized interface to enable consistent event handling and integration with the visual page editor. This interface defines:

- **Events**: User interactions that the component can emit
- **Actions**: Operations that can be performed on the component
- **Lifecycle hooks**: Component mounting, updating, and unmounting behaviors

### 1.2 New vComponents Architecture

**Directory Structure:**
```
vComponents/
├── registry.ts          # Central component registration
└── ComponentName/       # Each component in its own directory
    ├── index.ts         # Main export file
    ├── Component.tsx    # Base React component implementation
    ├── PageBuilderComponent.tsx  # Page builder integration wrapper
    └── interface.ts     # Component interface definition
```

**Example: Button Component Structure:**
```
vComponents/Button/
├── index.ts             # Exports Button, PageBuilderButton, interfaces
├── Button.tsx           # Base Button component with event system
├── PageBuilderButton.tsx # Page builder wrapper with script integration
└── interface.ts         # Component interface definition
```

**Core Interface Definition:**
```typescript
interface ComponentEventInterface {
  componentType: string
  displayName: string
  description: string
  
  lifecycle: {
    onMount?: ComponentEvent
    onUnmount?: ComponentEvent
    onUpdate?: ComponentEvent
  }
  
  events: {
    [eventName: string]: ComponentEvent
  }
  
  actions: {
    [actionName: string]: ComponentAction
  }
}
```

---

## 2. Button Component Implementation Example

### 2.1 Component Structure

The Button component demonstrates the new event handling architecture with comprehensive lifecycle and interaction events.

**Files:**
- **`vComponents/Button/Button.tsx`**: Base Button component with event system
- **`vComponents/Button/PageBuilderButton.tsx`**: Page builder wrapper with script integration

The Button component includes:
- **Event interfaces**: `BaseEventPayload` and `InteractionEventPayload` for type-safe event data
- **Script integration**: PageBuilderButton wrapper handles data attributes from property panel
- **Internal state management**: Loading, disabled, and visibility states controlled via props and scripts
- **Actions API**: Global registry for script-based component control

### 2.2 Event System Implementation

```typescript
// Event payload interfaces
export interface BaseEventPayload {
  timestamp: number
  componentId: string
  eventType: string
}

export interface InteractionEventPayload extends BaseEventPayload {
  modifierKeys?: {
    ctrl: boolean
    shift: boolean
    alt: boolean
    meta: boolean
  }
  position?: {
    x: number
    y: number
  }
  elementRect?: {
    x: number
    y: number
    width: number
    height: number
  }
}
```

**Dual Component Architecture:**

1. **Base Component (`Button.tsx`)**: 
   - Core functionality and styling
   - Event handling infrastructure
   - Prop-based configuration
   - Used for direct React usage

2. **Page Builder Wrapper (`PageBuilderButton.tsx`)**:
   - Integrates with visual page editor
   - Reads configuration from data attributes
   - Executes user-defined scripts
   - Handles editor-specific functionality (selection, drag/drop)

**Key Features:**
1. **Mount/Unmount Events**: Triggered when component enters/leaves the DOM
2. **Click Events**: Comprehensive interaction data including mouse position and modifier keys
3. **Actions API**: External control through `window.componentActions` registry
4. **Script Integration**: Dynamic script execution from property panel configuration

---

## 3. Event Handling and Scripts

### 3.1 Using Component Events

When a component is in preview mode (`isPreview={true}`), it will emit events that can be handled by custom scripts:

**Button Event Handlers:**
```jsx
<Button
  isPreview={true}
  elementId="my-submit-button"
  onScriptMount={(payload) => {
    console.log('Button mounted:', payload.componentId)
    // Initialize any required state or bindings
  }}
  onScriptClick={(payload) => {
    console.log('Button clicked:', payload)
    // Handle click logic, form submission, navigation, etc.
    
    // Access modifier keys
    if (payload.modifierKeys?.ctrl) {
      console.log('Ctrl+Click detected')
    }
    
    // Get click position relative to button
    if (payload.position) {
      console.log('Click position:', payload.position)
    }
  }}
  onScriptUnmount={(payload) => {
    console.log('Button unmounted:', payload.componentId)
    // Cleanup any resources or subscriptions
  }}
>
  Submit Form
</Button>
```

### 3.2 Component Actions API

Components expose actions through the global `window.componentActions` registry:

```javascript
// Get component actions (available after component mounts)
const actions = window.componentActions.get('my-submit-button')

if (actions) {
  // Control component programmatically
  actions.setLoading(true)       // Show loading spinner
  actions.setDisabled(false)     // Enable/disable button
  actions.setVisible(true)       // Show/hide component
}
```

### 3.3 Script Integration in Property Panel

In the PageBuilder interface, users can add custom event scripts through the property panel:

1. **Select Component**: Click on any component in the visual editor
2. **Property Panel**: Opens on the right showing component properties
3. **Events Tab**: Lists available events (onClick, onMount, onUnmount)
4. **Script Editor**: Monaco editor for writing JavaScript event handlers

**Example Event Script:**
```javascript
// onClick event script for Button component
async function handleButtonClick(payload, context) {
  // Show loading state
  const actions = window.componentActions.get(payload.componentId)
  if (actions) {
    actions.setLoading(true)
  }
  
  try {
    // Perform some async operation
    const response = await fetch('/api/submit-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        formData: context.page.getState(),
        timestamp: payload.timestamp 
      })
    })
    
    if (response.ok) {
      // Show success notification
      context.app.showNotification('Form submitted successfully!', 'success')
      
      // Navigate to success page
      context.page.navigate('/success')
    } else {
      throw new Error('Submission failed')
    }
  } catch (error) {
    // Show error notification
    context.app.showNotification('Error: ' + error.message, 'error')
  } finally {
    // Hide loading state
    if (actions) {
      actions.setLoading(false)
    }
  }
}

// Return the handler function
return handleButtonClick
```

### 3.4 Context API

Event handlers receive a context object with utilities for common operations:

```typescript
interface EventHandlerContext {
  component: {
    id: string
    type: string
    getProps: () => Record<string, any>
    setProps: (props: Record<string, any>) => void
    emit: (event: string, payload: any) => void
    callAction: (actionName: string, params: any) => Promise<any>
  }
  
  data: {
    query: (queryName: string, params?: any) => Promise<any>
    mutate: (mutationName: string, params?: any) => Promise<any>
    subscribe: (eventName: string, handler: Function) => () => void
  }
  
  page: {
    navigate: (path: string) => void
    getState: () => Record<string, any>
    setState: (state: any) => void
    dispatch: (action: any) => void
  }
  
  app: {
    getGlobalState: () => Record<string, any>
    setGlobalState: (state: any) => void
    showNotification: (message: string, type?: string) => void
    callWorkflow: (workflowId: string, payload: any) => Promise<any>
  }
}
```
  
  events: {
    [eventName: string]: ComponentEvent
  }
  
  actions: {
    [actionName: string]: ComponentAction
  }
  
  state?: {
    [stateName: string]: {
      description: string
      type: JSONSchema
    }
  }
}

### 1.3 Key Design Principles

**Event Abstraction**: Components should expose semantic events rather than raw DOM events. For example:
- ✅ `onValueChange` instead of `onChange`
- ✅ `onItemSelect` instead of `onClick`
- ✅ `onValidationError` instead of generic error events

**Payload Standardization**: All event payloads should include:
- `timestamp`: When the event occurred
- `componentId`: Unique identifier of the component
- Event-specific data with well-defined schemas

**Action Clarity**: Actions should be:
- Descriptive and action-oriented (e.g., `setLoading`, `updateValue`)
- Parameterized with clear schemas
- Return meaningful results when applicable

---

## 2. New Button Component Implementation

Let's walk through implementing the new Button component using the vComponents architecture.

### 2.1 Component Directory Structure

```
vComponents/Button/
├── index.ts           # Main export and registration info
├── Button.tsx         # React component implementation  
└── interface.ts       # Component interface definition
```

### 2.2 Component Implementation (Button.tsx)

```typescript
// vComponents/Button/Button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { 
  type ComponentEventInterface,
  type EventHandlerContext,
  type BaseEventPayload,
  type InteractionEventPayload 
} from "@/lib/component-interface"

interface EnhancedButtonProps {
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  onClick?: (payload: any) => void
  className?: string
}

interface ButtonEventPayload {
  timestamp: number
  componentId: string
  modifierKeys: {
    ctrl: boolean
    shift: boolean
    alt: boolean
  }
  buttonRect?: DOMRect
}
```

### 2.3 Interface Definition (interface.ts)

```typescript
// vComponents/Button/interface.ts
import { ComponentEventInterface, defineEvent, defineAction } from "@/lib/component-interface"

const ButtonEventSchemas = {
  base: {
    type: "object" as const,
    properties: {
      timestamp: { type: "number" as const },
      componentId: { type: "string" as const },
      eventType: { type: "string" as const }
    },
    required: ["timestamp", "componentId", "eventType"]
  },
  
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
        }
      }
    }
  }
}

export const ButtonComponentInterface: ComponentEventInterface = {
  componentType: 'Button',
  displayName: 'Button',
  description: 'Interactive button component that can trigger actions and workflows',
  
  lifecycle: {
    onMount: defineEvent('Fired when button is mounted', ButtonEventSchemas.base),
    onUnmount: defineEvent('Fired when button is unmounted', ButtonEventSchemas.base)
  },
  
  events: {
    onClick: defineEvent('Fired when button is clicked', ButtonEventSchemas.click)
  },
  
  actions: {
    setLoading: defineAction('Set loading state', {
      type: "object" as const,
      properties: {
        loading: { type: "boolean" as const }
      }
    }),
    setDisabled: defineAction('Set disabled state', {
      type: "object" as const, 
      properties: {
        disabled: { type: "boolean" as const }
      }
    })
  },
  
  state: {
    loading: {
      description: 'Whether button is in loading state',
      type: { type: "boolean" as const }
    },
    disabled: {
      description: 'Whether button is disabled',
      type: { type: "boolean" as const }
    }
  }
}
```

### 2.4 Component Registration (index.ts)

```typescript
// vComponents/Button/index.ts
export { Button, buttonVariants } from './Button'
export { PageBuilderButton } from './PageBuilderButton'
export { ButtonComponentInterface } from './interface'
export type { ButtonProps } from './Button'
export type { PageBuilderButtonProps } from './PageBuilderButton'

// Component registration information
export const ButtonComponent = {
  name: 'Button',
  category: 'Form',
  description: 'Interactive button with scripting support',
  icon: 'MousePointer',
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
      textAlign: 'center'
    },
    content: 'Click me'
  }
}
```

### 2.5 Registry Registration (registry.ts)

```typescript
// vComponents/registry.ts
import { MousePointer } from 'lucide-react'
import { ButtonComponent, ButtonComponentInterface } from './Button'

export const componentRegistry: Record<string, ComponentRegistration[]> = {
  form: [
    {
      name: 'Button',
      category: 'Form', 
      description: 'Interactive button with scripting support',
      icon: MousePointer,
      template: ButtonComponent.template,
      interface: ButtonComponentInterface
    }
  ]
}
```
          modifierKeys: {
            type: "object",
            properties: {
              ctrl: { type: "boolean" },
              shift: { type: "boolean" },
              alt: { type: "boolean" }
            }
          },
          buttonRect: {
            type: "object",
            description: "Button position and dimensions",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" }
            }
          }
        },
        required: ["timestamp", "componentId", "modifierKeys"]
      }
    },
    onFocus: {
      description: "Fired when button receives focus",
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
    setLoading: {
      description: "Set button loading state",
      parameters: {
        type: "object",
        properties: {
          loading: { type: "boolean", description: "Loading state" }
        },
        required: ["loading"]
      }
    },
    disable: {
      description: "Enable or disable the button",
      parameters: {
        type: "object",
        properties: {
          disabled: { type: "boolean", description: "Disabled state" }
        },
        required: ["disabled"]
      }
    },
    focus: {
      description: "Programmatically focus the button",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
}
```

### 2.3 Component Implementation

```typescript
export const EnhancedButton = forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({ children, loading, disabled, onClick, className, ...props }, ref) => {
    const [internalLoading, setInternalLoading] = useState(loading || false)
    const [internalDisabled, setInternalDisabled] = useState(disabled || false)
    const [componentId] = useState(() => `button-${Math.random().toString(36).substr(2, 9)}`)
    const buttonRef = React.useRef<HTMLButtonElement>(null)

    // Expose actions through ref
    useImperativeHandle(ref || buttonRef, () => ({
      // Standard button methods
      click: () => buttonRef.current?.click(),
      focus: () => buttonRef.current?.focus(),
      blur: () => buttonRef.current?.blur(),
      
      // Custom actions defined in interface
      setLoading: ({ loading }: { loading: boolean }) => {
        setInternalLoading(loading)
      },
      disable: ({ disabled }: { disabled: boolean }) => {
        setInternalDisabled(disabled)
      },
      
      // Metadata
      componentInterface: ButtonEventInterface,
      componentId
    }))

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (onClick) {
        const payload: ButtonEventPayload = {
          timestamp: Date.now(),
          componentId,
          modifierKeys: {
            ctrl: event.ctrlKey,
            shift: event.shiftKey,
            alt: event.altKey
          },
          buttonRect: buttonRef.current?.getBoundingClientRect()
        }
        
        onClick(payload)
      }
    }

    const handleFocus = (event: React.FocusEvent<HTMLButtonElement>) => {
      // Emit focus event if there's a listener
      const payload = {
        timestamp: Date.now(),
        componentId
      }
      
      // This would be handled by the visual editor's event system
      console.log('Button focus event:', payload)
    }

    return (
      <BaseButton
        ref={buttonRef}
        onClick={handleClick}
        onFocus={handleFocus}
        disabled={internalDisabled}
        className={className}
        {...props}
      >
        {internalLoading && (
          <span className="mr-2 animate-spin">⟳</span>
        )}
        {children}
      </BaseButton>
    )
  }
)

EnhancedButton.displayName = "EnhancedButton"

// Export the interface for use by the visual editor
export { ButtonEventInterface }
```

### 2.4 Key Implementation Points

**1. Component ID Generation**: Each component instance gets a unique ID for event tracking.

**2. Ref-based Action Exposure**: Actions are exposed through the component ref, allowing the visual editor to call them programmatically.

**3. Event Payload Structure**: All events follow the defined schema with consistent payload structure.

**4. State Management**: Internal state (loading, disabled) can be controlled both through props and actions.

---

## 3. Visual Page Editor Usage

### 3.1 Automatic Component Discovery

With the new vComponents architecture:

1. **Registry-Based**: All components registered in `vComponents/registry.ts` automatically appear in the component library
2. **Organized by Category**: Components are grouped by their `category` property (Form, Data, Media, etc.)
3. **Rich Metadata**: Each component includes icon, description, and interface information
4. **Template-Driven**: Component templates define the initial rendering structure

**Component Library Integration:**
- Components appear in their designated category section
- Drag & drop functionality works automatically
- Interface definitions enable scripting capabilities
- Template properties control initial appearance

### 3.3 Event Handler Configuration

#### Step 1: Select Event
In the component properties panel:
```
┌─ Component Properties Panel ─────────────┐
│ ┌─ Events Tab ───────────────────────────┐│
│ │ Available Events:                      ││
│ │ [onClick] - Fired when button clicked  ││
│ │ [onFocus] - Fired when button focused  ││
│ └───────────────────────────────────────┘│
└───────────────────────────────────────────┘
```

#### Step 2: Choose Script Type
```
┌─ Event: onClick ─────────────────────────┐
│ Script Type:                             │
│ ○ Quick Action (visual builder)          │
│ ● Custom Script (code editor)            │
└─────────────────────────────────────────┘
```

#### Step 3: Write Event Handler
```javascript
// Event: onClick
// Description: Fired when button is clicked or activated
function handleOnClick(eventPayload, context) {
  // Event payload structure:
  // {
  //   timestamp: number,
  //   componentId: string,
  //   modifierKeys: {
  //     ctrl: boolean,
  //     shift: boolean,
  //     alt: boolean
  //   },
  //   buttonRect?: DOMRect
  // }
  
  // 1. Create Action
  const action = context.createAction('BUTTON_CLICKED', {
    data: eventPayload,
    timestamp: Date.now(),
    componentId: context.component.id
  })
  
  // 2. Dispatch Action
  context.dispatch(action)
  
  // 3. Optional: Return immediate component updates
  return {
    componentUpdates: {
      [context.component.id]: {
        loading: true
      }
    }
  }
}
```

### 3.4 Page-Level State Management

#### Configuring the Page Reducer
Navigate to: **Page Properties Panel → Scripts Tab → State Management**

```javascript
function pageReducer(state, action) {
  switch(action.type) {
    case 'BUTTON_CLICKED':
      return {
        ...state,
        clickCount: (state.clickCount || 0) + 1,
        lastClickTime: action.payload.timestamp,
        clickedComponentId: action.payload.componentId
      }
      
    case 'RESET_COUNTER':
      return {
        ...state,
        clickCount: 0,
        lastClickTime: null
      }
      
    default:
      return state
  }
}
```

#### Initial Page State
```json
{
  "clickCount": 0,
  "lastClickTime": null,
  "clickedComponentId": null,
  "userPreferences": {
    "theme": "light",
    "language": "en"
  }
}
```

### 3.5 Component Action Usage

You can call component actions from other event handlers:

```javascript
function handleResetButton(eventPayload, context) {
  // Find the target button component
  const targetButton = context.page.findComponent('button-abc123')
  
  if (targetButton) {
    // Call the setLoading action
    targetButton.actions.setLoading({ loading: true })
    
    // Simulate async operation
    setTimeout(() => {
      targetButton.actions.setLoading({ loading: false })
    }, 2000)
  }
  
  // Dispatch reset action
  const action = context.createAction('RESET_COUNTER', {
    timestamp: Date.now()
  })
  
  context.dispatch(action)
}
```

---

## 4. Advanced Scripting Patterns

### 4.1 Async Operations with Backend Integration

```javascript
async function handleSubmitButton(eventPayload, context) {
  // Set loading state
  context.component.actions.setLoading({ loading: true })
  
  try {
    // Call backend workflow
    const result = await context.workflow.execute('validate-form', {
      formData: context.data.query('form-data'),
      userId: context.user.id
    })
    
    if (result.success) {
      // Success action
      const action = context.createAction('FORM_SUBMITTED', {
        result: result.data,
        timestamp: Date.now()
      })
      context.dispatch(action)
      
      // Show success message
      context.ui.showNotification({
        type: 'success',
        message: 'Form submitted successfully!'
      })
    } else {
      // Error handling
      throw new Error(result.error)
    }
    
  } catch (error) {
    // Error action
    const action = context.createAction('FORM_ERROR', {
      error: error.message,
      timestamp: Date.now()
    })
    context.dispatch(action)
    
    // Show error message
    context.ui.showNotification({
      type: 'error',
      message: `Error: ${error.message}`
    })
    
  } finally {
    // Always clear loading state
    context.component.actions.setLoading({ loading: false })
  }
}
```

### 4.2 Data Binding and Queries

```javascript
function handleDataRefresh(eventPayload, context) {
  // Subscribe to data changes
  const unsubscribe = context.data.subscribe('user-list', (newData) => {
    // Update component state when data changes
    const action = context.createAction('DATA_UPDATED', {
      dataType: 'user-list',
      data: newData,
      timestamp: Date.now()
    })
    context.dispatch(action)
  })
  
  // Store unsubscribe function for cleanup
  context.component.setData('unsubscribe', unsubscribe)
  
  // Trigger data refresh
  context.data.mutate('refresh-user-list', {
    filters: context.page.state.filters,
    sortBy: 'name'
  })
}
```

### 4.3 Cross-Component Communication

```javascript
function handleToggleButton(eventPayload, context) {
  const isActive = !context.page.state.toggleActive
  
  // Update page state
  const action = context.createAction('TOGGLE_STATE', {
    active: isActive,
    timestamp: Date.now()
  })
  context.dispatch(action)
  
  // Update multiple components
  const relatedComponents = context.page.findComponents({
    tag: 'toggle-related'
  })
  
  relatedComponents.forEach(component => {
    if (component.actions.setActive) {
      component.actions.setActive({ active: isActive })
    }
    
    if (component.actions.setVariant) {
      component.actions.setVariant({ 
        variant: isActive ? 'default' : 'secondary' 
      })
    }
  })
}
```

---

## 5. Best Practices

### 5.1 Component Design

**Interface Clarity**
- Use descriptive event and action names
- Provide comprehensive descriptions
- Define complete schemas for all payloads

**State Management**
- Keep component state minimal and focused
- Use actions for all external state changes
- Emit events for all significant interactions

**Error Handling**
- Validate all action parameters
- Provide meaningful error messages
- Handle edge cases gracefully

### 5.2 Script Writing

**Structure**
```javascript
// Always start with clear documentation
// Event: eventName
// Description: What this event handler does

function handleEventName(eventPayload, context) {
  // 1. Input validation
  if (!eventPayload || !context) {
    console.error('Invalid parameters')
    return
  }
  
  // 2. Business logic
  try {
    // Your logic here
    
    // 3. Create and dispatch actions
    const action = context.createAction('ACTION_TYPE', payload)
    context.dispatch(action)
    
    // 4. Return component updates if needed
    return {
      componentUpdates: {
        [context.component.id]: { /* updates */ }
      }
    }
    
  } catch (error) {
    // 5. Error handling
    console.error('Error in event handler:', error)
    context.utils.log(`Error: ${error.message}`)
  }
}
```

**Performance**
- Avoid heavy computations in event handlers
- Use debouncing for frequent events
- Cache expensive operations
- Clean up subscriptions and timers

**Security**
- Never trust user input directly
- Validate all external data
- Use the sandbox context APIs only
- Log security-relevant actions

### 5.3 Testing Components

**Manual Testing**
1. Use the "Test Script" button in the script editor
2. Verify event payloads match schemas
3. Test error conditions
4. Validate state changes

**Component Testing**
```javascript
// Example test in script editor
function testButtonComponent() {
  const mockPayload = {
    timestamp: Date.now(),
    componentId: 'test-button',
    modifierKeys: {
      ctrl: false,
      shift: true,
      alt: false
    }
  }
  
  // Test your handler
  const result = handleOnClick(mockPayload, mockContext)
  
  // Verify results
  console.log('Test result:', result)
  return result
}
```

---

## Conclusion

This tutorial covered the essential concepts for building interactive components in GoFlow's PageBuilder:

1. **Standard Interfaces**: Consistent event and action definitions across all components
2. **Implementation Patterns**: How to properly implement the component interface
3. **Visual Editor Integration**: Using the drag-and-drop editor to configure event handlers
4. **Advanced Scripting**: Async operations, data binding, and cross-component communication
5. **Best Practices**: Code organization, testing, and performance considerations

With these foundations, you can create rich, interactive components that seamlessly integrate with the visual page editor and provide powerful scripting capabilities for end users.

### Next Steps

- Explore the component library for more implementation examples
- Practice creating custom components with different event patterns
- Experiment with advanced scripting features like workflow integration
- Review the API documentation for complete context object reference
