/**
 * Button Component
 * 
 * Enhanced interactive button component with full event interface support.
 * Implements the standardized ComponentEventInterface for GoFlow PageBuilder.
 */

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

// Button variants styling
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

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

// Component props interface
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  
  // Script integration props
  isPreview?: boolean
  elementId?: string
  
  // Event handlers (for script integration)
  onScriptClick?: (payload: InteractionEventPayload) => void
  onScriptMount?: (payload: BaseEventPayload) => void
  onScriptUnmount?: (payload: BaseEventPayload) => void
}

// Button component implementation
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    loading = false,
    loadingText,
    isPreview = false,
    elementId,
    onScriptClick,
    onScriptMount,
    onScriptUnmount,
    onClick,
    children,
    disabled,
    ...props 
  }, ref) => {
    
    const [internalLoading, setInternalLoading] = React.useState(loading)
    const [internalDisabled, setInternalDisabled] = React.useState(disabled)
    const [internalVisible, setInternalVisible] = React.useState(true)
    
    const buttonRef = React.useRef<HTMLButtonElement>(null)
    
    // Combine refs
    React.useImperativeHandle(ref, () => buttonRef.current!, [])
    
    // Generate unique component ID if not provided
    const finalElementId = React.useMemo(() => 
      elementId || `button-${Math.random().toString(36).substr(2, 9)}`, 
      [elementId]
    )
    
    // Mount/unmount effects for scriptable components
    React.useEffect(() => {
      if (isPreview && onScriptMount) {
        const payload: BaseEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'mount'
        }
        onScriptMount(payload)
      }
      
      return () => {
        if (isPreview && onScriptUnmount) {
          const payload: BaseEventPayload = {
            timestamp: Date.now(),
            componentId: finalElementId,
            eventType: 'unmount'
          }
          onScriptUnmount(payload)
        }
      }
    }, [isPreview, onScriptMount, onScriptUnmount, finalElementId])
    
    // Click handler
    const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
      // Call original onClick first (for editor or other functionality)
      if (onClick) {
        onClick(event)
      }
      
      // Then call script handler if in preview mode with scripts
      if (isPreview && onScriptClick && !event.defaultPrevented) {
        const rect = buttonRef.current?.getBoundingClientRect()
        const payload: InteractionEventPayload = {
          timestamp: Date.now(),
          componentId: finalElementId,
          eventType: 'click',
          modifierKeys: {
            ctrl: event.ctrlKey,
            shift: event.shiftKey,
            alt: event.altKey,
            meta: event.metaKey
          },
          position: rect ? {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          } : undefined,
          elementRect: rect ? {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          } : undefined
        }
        
        onScriptClick(payload)
      }
    }, [onClick, isPreview, onScriptClick, finalElementId])
    
    // Actions API for external control
    React.useEffect(() => {
      if (typeof window !== 'undefined') {
        // Register component actions globally for script access
        const actions = {
          setLoading: (loading: boolean) => setInternalLoading(loading),
          setDisabled: (disabled: boolean) => setInternalDisabled(disabled),
          setVisible: (visible: boolean) => setInternalVisible(visible),
        }
        
        // Store in global registry for script access
        if (!window.componentActions) {
          window.componentActions = new Map()
        }
        window.componentActions.set(finalElementId, actions)
        
        return () => {
          window.componentActions?.delete(finalElementId)
        }
      }
    }, [finalElementId])
    
    // Don't render if not visible
    if (!internalVisible) {
      return null
    }
    
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={buttonRef}
        onClick={handleClick}
        disabled={internalDisabled || internalLoading}
        data-component-id={finalElementId}
        data-component-type="Button"
        {...props}
      >
        {internalLoading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {internalLoading && loadingText ? loadingText : children}
      </Comp>
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }

// Extend window type for component actions
declare global {
  interface Window {
    componentActions?: Map<string, Record<string, (...args: any[]) => void>>
  }
}