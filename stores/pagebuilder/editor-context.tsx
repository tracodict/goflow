"use client"

import React, { createContext, useContext, useRef, useMemo, useEffect } from 'react'
import { create, StoreApi, UseBoundStore } from 'zustand'
import type { BuilderState } from './editor'
import { useBuilderStore } from './editor'

// Factory function to create a new builder store instance
export const createBuilderStore = (initialElements?: Record<string, any>) => {
  return create<BuilderState>((set, get) => ({
    elements: initialElements || {
      "page-root": {
        id: "page-root",
        tagName: "div",
        attributes: { className: "page-container" },
        styles: {
          minHeight: "40vh",
          padding: "20px",
          backgroundColor: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        },
        childIds: [],
      }
    },
    selectedElementId: null,
    hoveredElementId: null,
    isPreviewMode: false,
    canvasScale: 1,
    draggedElementId: null,
    leftPanelWidth: 280,
    rightPanelWidth: 320,
    showContainerBorders: false,
    hasUnsavedChanges: false,

    addElement: (element, parentId = "page-root") => {
      set((state) => {
        const parent = state.elements[parentId]
        if (!parent) return state

        return {
          elements: {
            ...state.elements,
            [element.id]: { ...element, parentId },
            [parentId]: {
              ...parent,
              childIds: [...parent.childIds, element.id],
            },
          },
          hasUnsavedChanges: true,
        }
      })
    },

    updateElement: (id, updates) => {
      set((state) => ({
        elements: {
          ...state.elements,
          [id]: { ...state.elements[id], ...updates },
        },
        hasUnsavedChanges: true,
      }))
    },

    removeElement: (id) => {
      set((state) => {
        const element = state.elements[id]
        if (!element || id === "page-root") return state

        const newElements = { ...state.elements }
        const removeRecursive = (elementId: string) => {
          const el = newElements[elementId]
          if (el) {
            el.childIds.forEach(removeRecursive)
            delete newElements[elementId]
          }
        }
        removeRecursive(id)

        if (element.parentId) {
          const parent = newElements[element.parentId]
          if (parent) {
            newElements[element.parentId] = {
              ...parent,
              childIds: parent.childIds.filter((childId) => childId !== id),
            }
          }
        }

        return {
          elements: newElements,
          selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
          hasUnsavedChanges: true,
        }
      })
    },

    selectElement: (id) => set({ selectedElementId: id }),
    setHoveredElement: (id) => set({ hoveredElementId: id }),
    togglePreviewMode: () => set((state) => ({ isPreviewMode: !state.isPreviewMode })),
    setCanvasScale: (scale) => set({ canvasScale: scale }),
    setDraggedElement: (id) => set({ draggedElementId: id }),

    moveElement: (elementId, newParentId, insertIndex) => {
      set((state) => {
        const element = state.elements[elementId]
        if (!element || elementId === "page-root") return state

        const oldParentId = element.parentId
        if (!oldParentId) return state

        const newElements = { ...state.elements }
        const oldParent = newElements[oldParentId]
        const newParent = newElements[newParentId]

        if (!oldParent || !newParent) return state

        newElements[oldParentId] = {
          ...oldParent,
          childIds: oldParent.childIds.filter((id) => id !== elementId),
        }

        const newChildIds = [...newParent.childIds]
        if (insertIndex !== undefined) {
          newChildIds.splice(insertIndex, 0, elementId)
        } else {
          newChildIds.push(elementId)
        }

        newElements[newParentId] = {
          ...newParent,
          childIds: newChildIds,
        }

        newElements[elementId] = {
          ...element,
          parentId: newParentId,
        }

        return {
          elements: newElements,
          hasUnsavedChanges: true,
        }
      })
    },

    setLeftPanelWidth: (width) => set({ leftPanelWidth: width }),
    setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
    toggleContainerBorders: () => set((state) => ({ showContainerBorders: !state.showContainerBorders })),
    markAsChanged: () => set({ hasUnsavedChanges: true }),
    markAsSaved: () => set({ hasUnsavedChanges: false }),
    
    loadElements: (elements) => {
      set({ elements, hasUnsavedChanges: false })
    },
  }))
}

// Context to hold the builder store for a specific tab
type BuilderStoreType = UseBoundStore<StoreApi<BuilderState>>
const BuilderStoreContext = createContext<BuilderStoreType | null>(null)

interface BuilderStoreProviderProps {
  children: React.ReactNode
  initialElements?: Record<string, any>
  tabId: string
}

// Store instances cache per tab
const storeCache = new Map<string, BuilderStoreType>()

export const BuilderStoreProvider: React.FC<BuilderStoreProviderProps> = ({ 
  children, 
  initialElements,
  tabId 
}) => {
  // Get or create store for this tab
  const store = useMemo(() => {
    if (storeCache.has(tabId)) {
      return storeCache.get(tabId)!
    }
    const newStore = createBuilderStore(initialElements)
    storeCache.set(tabId, newStore)
    return newStore
  }, [tabId])

  // Update store when initialElements changes
  useEffect(() => {
    if (initialElements && Object.keys(initialElements).length > 0) {
      store.getState().loadElements(initialElements)
    }
  }, [initialElements, store])

  return (
    <BuilderStoreContext.Provider value={store}>
      {children}
    </BuilderStoreContext.Provider>
  )
}

// Hook to use the builder store from context
export const useBuilderStoreContext = () => {
  const store = useContext(BuilderStoreContext)
  if (!store) {
    throw new Error('useBuilderStoreContext must be used within BuilderStoreProvider')
  }
  return store
}

// Utility to get store instance for a tab (for external access)
export const getTabStore = (tabId: string): BuilderStoreType | undefined => {
  return storeCache.get(tabId)
}

// Utility to clear store cache for a tab (when tab is closed)
export const clearTabStore = (tabId: string) => {
  storeCache.delete(tabId)
}

// Context for tracking the focused tab ID
const FocusedTabContext = createContext<string | null>(null)

// Provider for focused tab tracking
export const FocusedTabProvider: React.FC<{ children: React.ReactNode; focusedTabId: string | null }> = ({ 
  children, 
  focusedTabId 
}) => {
  return (
    <FocusedTabContext.Provider value={focusedTabId}>
      {children}
    </FocusedTabContext.Provider>
  )
}

// Hook to get the focused tab ID
export const useFocusedTabId = (): string | null => {
  return useContext(FocusedTabContext)
}

// Hook to get the focused tab's store (for sidebars that need to interact with active tab)
export const useFocusedTabStore = (): BuilderStoreType => {
  const focusedTabId = useContext(FocusedTabContext)
  if (!focusedTabId) {
    return useBuilderStore
  }
  return getTabStore(focusedTabId) || useBuilderStore
}

// Hook to safely get store state with a selector; defaults are fallback only before hydration
export const useFocusedTabState = <T,>(selector: (state: BuilderState) => T, defaultValue: T): T => {
  const store = useFocusedTabStore()
  const value = store(selector)
  return value ?? defaultValue
}
