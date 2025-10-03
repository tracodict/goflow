'use client'

import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { ViaTokenGrid } from '@/components/via/via-token-grid'
import { fetchColorsList } from '@/components/petri/petri-client'
import { useSystemSettings } from '@/components/petri/system-settings-context'
import { useBuilderStore } from '@/stores/pagebuilder/editor'
import { VIAFormComponentInterface } from './interface'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2, ChevronDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Simple event emitter for component interface
class SimpleEventEmitter {
  private listeners: Record<string, Function[]> = {}
  
  on(event: string, listener: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(listener)
  }
  
  off(event: string, listener: Function) {
    if (!this.listeners[event]) return
    this.listeners[event] = this.listeners[event].filter(l => l !== listener)
  }
  
  emit(event: string, data: any) {
    if (!this.listeners[event]) return
    this.listeners[event].forEach(listener => listener(data))
  }
}

interface ComponentRef {
  getType: () => string
  getState: () => any
  addEventListener: (event: string, handler: Function) => void
  removeEventListener: (event: string, handler: Function) => void
}

interface VIAFormProps {
  // Standard component props
  className?: string
  style?: React.CSSProperties
  
  // VIA-specific props
  initialColor?: string
  showActionButtons?: boolean
  
  // PageBuilder integration
  elementId?: string
  
  // PageBuilder event handlers
  onClick?: (e: React.MouseEvent) => void
  onMouseEnter?: (e: React.MouseEvent) => void
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  draggable?: boolean
  
  // Event handlers
  onTokenSelected?: (token: any) => void
  onTransitionFired?: (transitionId: string, result: any) => void
  onColorChanged?: (color: string) => void
}

interface VIAFormState {
  selectedColor: string
  colors: string[]
  tokens: any[]
  loading: boolean
  error: string | null
}

export interface VIAFormRef extends ComponentRef {
  // Actions from interface
  selectColor: (color: string) => boolean
  fireTransition: (transitionId: string, tokenBinding: any, input?: any) => Promise<{ success: boolean; error?: string }>
  refreshTokens: () => Promise<boolean>
  getSelectedColor: () => string
  getTokens: () => any[]
}

const VIAForm = forwardRef<VIAFormRef, VIAFormProps>((props, ref) => {
  const {
    className = '',
    style = {},
    initialColor = '',
    showActionButtons = true,
    elementId,
    // PageBuilder event handlers
    onClick: pageBuilderOnClick,
    onMouseEnter: pageBuilderOnMouseEnter,
    onDragStart: pageBuilderOnDragStart,
    onDragOver: pageBuilderOnDragOver,
    onDrop: pageBuilderOnDrop,
    onDragEnd: pageBuilderOnDragEnd,
    draggable,
    // Component event handlers
    onTokenSelected,
    onTransitionFired,
    onColorChanged
  } = props

  const { settings } = useSystemSettings()
  const { elements, updateElement, isPreviewMode } = useBuilderStore()
  const [state, setState] = useState<VIAFormState>({
    selectedColor: initialColor,
    colors: [],
    tokens: [],
    loading: false,
    error: null
  })
  const [refreshing, setRefreshing] = useState(false)

  // Event emitter for component interface
  const [eventEmitter, setEventEmitter] = useState<SimpleEventEmitter | null>(null)
  
  // Initialize event emitter
  useEffect(() => {
    setEventEmitter(new SimpleEventEmitter())
  }, [])

  // Load available colors/schemas
  const loadColors = useCallback(async () => {
    if (!settings?.flowServiceUrl) return

    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const data = await fetchColorsList(settings.flowServiceUrl)
      const colors = data?.data?.colors || []
      
      setState(prev => ({
        ...prev,
        colors,
        loading: false,
        // Auto-select first color if none selected
        selectedColor: prev.selectedColor || colors[0] || ''
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load colors'
      }))
    }
  }, [settings?.flowServiceUrl])

  // Load colors on mount
  useEffect(() => {
    loadColors()
  }, [loadColors])

  // Update selected color when initialColor prop changes
  useEffect(() => {
    if (initialColor && initialColor !== state.selectedColor) {
      setState(prev => ({ ...prev, selectedColor: initialColor }))
    }
  }, [initialColor, state.selectedColor])

  // Handle color selection
  const handleColorSelect = useCallback((color: string) => {
    console.log('VIAForm: Color selected:', color)
    setState(prev => ({ ...prev, selectedColor: color }))
    
    // Update PageBuilder property panel if in editor mode
    if (elementId && !isPreviewMode && elements[elementId]) {
      const currentElement = elements[elementId]
      const updatedAttributes = {
        ...currentElement.attributes,
        'data-initial-color': color
      }
      updateElement(elementId, { attributes: updatedAttributes })
    }
    
    onColorChanged?.(color)
    eventEmitter?.emit('onColorChanged', { color })
  }, [onColorChanged, eventEmitter, elementId, isPreviewMode, updateElement])

  // Handle token selection
  const handleTokenSelected = useCallback((token: any) => {
    onTokenSelected?.(token)
    eventEmitter?.emit('onTokenSelected', { token })
  }, [onTokenSelected, eventEmitter])

  // Handle transition firing
  const handleTransitionFired = useCallback((transitionId: string, result: any) => {
    onTransitionFired?.(transitionId, result)
    eventEmitter?.emit('onTransitionFired', { transitionId, result })
  }, [onTransitionFired, eventEmitter])

  // Component actions implementation
  const selectColor = useCallback((color: string): boolean => {
    if (state.colors.includes(color)) {
      handleColorSelect(color)
      return true
    }
    return false
  }, [state.colors, handleColorSelect])

  const fireTransition = useCallback(async (
    transitionId: string,
    tokenBinding: any,
    input?: any
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // This would integrate with the actual transition firing logic
      // For now, just emit the event
      handleTransitionFired(transitionId, { tokenBinding, input })
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fire transition'
      }
    }
  }, [handleTransitionFired])

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    if (!state.selectedColor) return false
    setRefreshing(true)
    try {
      // Trigger a refresh by reloading colors and re-rendering the grid
      await loadColors()
      setRefreshing(false)
      return true
    } catch {
      setRefreshing(false)
      return false
    }
  }, [loadColors, state.selectedColor])

  const getSelectedColor = useCallback((): string => {
    return state.selectedColor
  }, [state.selectedColor])

  const getTokens = useCallback((): any[] => {
    return state.tokens
  }, [state.tokens])

  // Expose component interface
  useImperativeHandle(ref, () => ({
    // Standard component ref
    getType: () => VIAFormComponentInterface.componentType,
    getState: () => ({
      selectedColor: state.selectedColor,
      loading: state.loading,
      error: state.error
    }),
    addEventListener: (event: string, handler: Function) => {
      eventEmitter?.on(event, handler)
    },
    removeEventListener: (event: string, handler: Function) => {
      eventEmitter?.off(event, handler)
    },

    // Component-specific actions
    selectColor,
    fireTransition,
    refreshTokens,
    getSelectedColor,
    getTokens
  }), [state, eventEmitter, selectColor, fireTransition, refreshTokens, getSelectedColor, getTokens])

  // Emit lifecycle events
  useEffect(() => {
    eventEmitter?.emit('onMount', {})
    return () => {
      eventEmitter?.emit('onUnmount', {})
    }
  }, [eventEmitter])

  if (state.loading) {
    return (
      <div className={`via-form-loading ${className}`} style={style}>
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2">Loading colors...</span>
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className={`via-form-error ${className}`} style={style}>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading VIA form</h3>
              <div className="mt-2 text-sm text-red-700">{state.error}</div>
              <div className="mt-3">
                <button
                  onClick={loadColors}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`border rounded-lg ${className}`} 
      style={style}
      onClick={(e) => {
        // Call PageBuilder click handler for selection
        pageBuilderOnClick?.(e)
      }}
      onMouseEnter={pageBuilderOnMouseEnter}
      onDragStart={pageBuilderOnDragStart}
      onDragOver={pageBuilderOnDragOver}
      onDrop={pageBuilderOnDrop}
      onDragEnd={pageBuilderOnDragEnd}
      draggable={draggable}
    >
      {/* Titlebar with color selector and refresh button */}
      <div className="p-2 bg-muted/30 border-b flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-sm">VIA Tokens</h3>
          <Select value={state.selectedColor} onValueChange={handleColorSelect}>
            <SelectTrigger className="w-48 h-8">
              <SelectValue placeholder="Select color/schema" />
            </SelectTrigger>
            <SelectContent>
              {state.colors.map((color) => (
                <SelectItem key={color} value={color}>
                  {color}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refreshTokens()}
            disabled={refreshing || !state.selectedColor}
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Error display */}
      {state.error && (
        <div className="p-4 bg-destructive/10 border-b flex items-center gap-2">
          <span className="text-sm text-destructive">{state.error}</span>
        </div>
      )}

      {/* Token grid or empty state */}
      {!state.selectedColor ? (
        <div className="p-4 text-center text-muted-foreground">
          Please select a color/schema to view tokens
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ViaTokenGrid
            key={`${state.selectedColor}-${refreshing ? 'refreshing' : 'idle'}`}
            baseUrl={settings.flowServiceUrl || ''}
            color={state.selectedColor}
            dictionaryUrl={settings.dictionaryUrl || ''}
          />
        </div>
      )}
    </div>
  )
})

VIAForm.displayName = 'VIAForm'

export default VIAForm