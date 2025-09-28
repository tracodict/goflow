/**
 * Enhanced Button Component with Event Interface
 * 
 * Example implementation of ComponentEventInterface for the Button component,
 * demonstrating how to integrate the standardized event system.
 */

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { 
  defineEvent, 
  defineAction, 
  type ComponentEventInterface,
  type EventHandlerContext,
  type BaseEventPayload,
  type InteractionEventPayload 
} from "@/lib/component-interface"
import { componentRegistry } from "@/lib/component-registry"
import { EventSchemas, ActionSchemas, StateSchemas, ReturnTypeSchemas } from "@/lib/component-schemas"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface EnhancedButtonProps extends React.ComponentProps<"button">,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  
  // Event handlers for the component interface
  onComponentClick?: (payload: InteractionEventPayload, context: EventHandlerContext) => void
  onComponentMount?: (payload: BaseEventPayload, context: EventHandlerContext) => void
  onComponentUnmount?: (payload: BaseEventPayload, context: EventHandlerContext) => void
  
  // Component interface props
  componentId?: string
  scriptable?: boolean
}

const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingText,
  onComponentClick,
  onComponentMount,
  onComponentUnmount,
  componentId,
  scriptable = false,
  onClick,
  children,
  disabled,
  ...props
}, ref) => {
  const [internalLoading, setInternalLoading] = React.useState(loading)
  const [internalDisabled, setInternalDisabled] = React.useState(disabled)
  const [internalVisible, setInternalVisible] = React.useState(true)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  
  React.useImperativeHandle(ref, () => buttonRef.current!)

  // Component actions implementation
  const componentActions = React.useMemo(() => ({
    setLoading: async (params: { loading: boolean, message?: string }) => {
      setInternalLoading(params.loading)
      return { success: true }
    },
    
    setDisabled: async (params: { disabled: boolean, reason?: string }) => {
      setInternalDisabled(params.disabled)
      return { success: true }
    },
    
    setVisible: async (params: { visible: boolean, animation?: string }) => {
      setInternalVisible(params.visible)
      return { success: true }
    },
    
    focus: async () => {
      buttonRef.current?.focus()
      return { success: true }
    },
    
    blur: async () => {
      buttonRef.current?.blur()
      return { success: true }
    }
  }), [])

  // Create event handler context
  const createContext = React.useCallback((): EventHandlerContext => ({
    component: {
      id: componentId || 'button',
      type: 'button',
      getProps: () => ({
        variant,
        size,
        loading: internalLoading,
        disabled: internalDisabled,
        visible: internalVisible,
        children: typeof children === 'string' ? children : '[React Node]'
      }),
      setProps: (props: Record<string, any>) => {
        if ('loading' in props) setInternalLoading(props.loading)
        if ('disabled' in props) setInternalDisabled(props.disabled)
        if ('visible' in props) setInternalVisible(props.visible)
      },
      emit: (event: string, payload: any) => {
        console.log(`Button ${componentId} emitting event:`, event, payload)
      },
      callAction: async (actionName: string, parameters: any) => {
        const action = componentActions[actionName as keyof typeof componentActions]
        if (action) {
          return await action(parameters)
        }
        throw new Error(`Action ${actionName} not found`)
      }
    },
    data: {
      query: async (queryId: string) => ({ data: null, loading: false }),
      mutate: async (mutation: any) => ({ success: true }),
      subscribe: (callback: (data: any) => void) => () => {}
    },
    page: {
      navigate: (path: string) => console.log('Navigate to:', path),
      getState: () => ({}),
      setState: (state: any) => console.log('Set page state:', state),
      dispatch: (action: any) => console.log('Dispatch action:', action)
    },
    app: {
      getGlobalState: () => ({}),
      setGlobalState: (state: any) => console.log('Set global state:', state),
      showNotification: (message: string, type?: string) => console.log('Notification:', message, type),
      callWorkflow: async (workflowId: string, payload: any) => ({ success: true })
    },
    utils: {
      formatDate: (date: Date | string) => new Date(date).toISOString(),
      validateSchema: (data: any, schema: any) => ({ valid: true }),
      debounce: <T extends (...args: any[]) => void>(func: T, delay: number) => func,
      throttle: <T extends (...args: any[]) => void>(func: T, delay: number) => func,
      log: (message: string, level?: string) => console.log(`[${level || 'info'}]`, message)
    }
  }), [componentId, variant, size, internalLoading, internalDisabled, internalVisible, children, componentActions])

  // Handle click events
  const handleClick = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    // Call original onClick first
    onClick?.(e)
    
    // If scriptable, call component event handler
    if (scriptable && onComponentClick) {
      const payload: InteractionEventPayload = {
        timestamp: Date.now(),
        componentId: componentId || 'button',
        eventType: 'click',
        modifierKeys: {
          ctrl: e.ctrlKey,
          shift: e.shiftKey,
          alt: e.altKey,
          meta: e.metaKey
        },
        position: {
          x: e.clientX,
          y: e.clientY
        }
      }
      
      onComponentClick(payload, createContext())
    }
  }, [onClick, scriptable, onComponentClick, componentId, createContext])

  // Handle lifecycle events
  React.useEffect(() => {
    if (scriptable && onComponentMount) {
      const payload: BaseEventPayload = {
        timestamp: Date.now(),
        componentId: componentId || 'button',
        eventType: 'mount'
      }
      onComponentMount(payload, createContext())
    }
    
    return () => {
      if (scriptable && onComponentUnmount) {
        const payload: BaseEventPayload = {
          timestamp: Date.now(),
          componentId: componentId || 'button',
          eventType: 'unmount'
        }
        onComponentUnmount(payload, createContext())
      }
    }
  }, [scriptable, onComponentMount, onComponentUnmount, componentId, createContext])

  const Comp = asChild ? Slot : "button"
  const isDisabled = internalDisabled || internalLoading

  if (!internalVisible) {
    return null
  }

  return (
    <Comp
      ref={buttonRef}
      data-slot="button"
      data-component-id={componentId}
      data-component-type="button"
      data-scriptable={scriptable}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isDisabled}
      onClick={handleClick}
      {...props}
    >
      {internalLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {internalLoading && loadingText ? loadingText : children}
    </Comp>
  )
})

EnhancedButton.displayName = "EnhancedButton"

// Component interface definition
const ButtonComponentInterface: ComponentEventInterface = {
  componentType: 'button',
  displayName: 'Button',
  description: 'Interactive button component that can trigger actions and workflows',
  
  lifecycle: {
    onMount: defineEvent(
      'Fired when the button component is mounted',
      EventSchemas.base,
      { category: 'lifecycle' }
    ),
    onUnmount: defineEvent(
      'Fired when the button component is unmounted',
      EventSchemas.base,
      { category: 'lifecycle' }
    )
  },
  
  events: {
    onClick: defineEvent(
      'Fired when the button is clicked',
      EventSchemas.click,
      { 
        category: 'interaction',
        preventDefault: true
      }
    )
  },
  
  actions: {
    setLoading: defineAction(
      'Set the loading state of the button',
      ActionSchemas.setLoading,
      {
        category: 'state',
        returnType: ReturnTypeSchemas.result
      }
    ),
    setDisabled: defineAction(
      'Enable or disable the button',
      ActionSchemas.setDisabled,
      {
        category: 'state',
        returnType: ReturnTypeSchemas.result
      }
    ),
    setVisible: defineAction(
      'Show or hide the button',
      ActionSchemas.setVisible,
      {
        category: 'display',
        returnType: ReturnTypeSchemas.result
      }
    ),
    focus: defineAction(
      'Focus the button element',
      { type: 'object', properties: {} },
      {
        category: 'navigation',
        returnType: ReturnTypeSchemas.result
      }
    ),
    blur: defineAction(
      'Remove focus from the button element',
      { type: 'object', properties: {} },
      {
        category: 'navigation',
        returnType: ReturnTypeSchemas.result
      }
    )
  },
  
  state: {
    loading: {
      description: 'Whether the button is in loading state',
      type: StateSchemas.loading
    },
    disabled: {
      description: 'Whether the button is disabled',
      type: StateSchemas.disabled
    },
    visible: {
      description: 'Whether the button is visible',
      type: StateSchemas.visible
    }
  }
}

// Register the component interface
componentRegistry.register(ButtonComponentInterface)

export { EnhancedButton, buttonVariants, ButtonComponentInterface }
export type { EnhancedButtonProps }