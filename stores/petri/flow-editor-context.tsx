"use client"

import React, { createContext, useContext, useMemo, useEffect } from "react"
import { create, type StoreApi, type UseBoundStore } from "zustand"

export type FlowWorkspaceEntity =
  | { kind: "place"; id: string }
  | { kind: "transition"; id: string }
  | { kind: "arc"; id: string }
  | { kind: "declarations"; id: string }
  | { kind: "go-script"; id: string }
  | null

type FlowWorkspaceState = {
  selectedEntity: FlowWorkspaceEntity
  sidePanelDetail: any | null
  setSelectedEntity: (entity: FlowWorkspaceEntity) => void
  setSidePanelDetail: (detail: any | null) => void
}

const createFlowWorkspaceStore = () =>
  create<FlowWorkspaceState>((set) => ({
    selectedEntity: null,
    sidePanelDetail: null,
    setSelectedEntity: (entity) => set({ selectedEntity: entity }),
    setSidePanelDetail: (detail) => set({ sidePanelDetail: detail }),
  }))

type FlowWorkspaceStore = UseBoundStore<StoreApi<FlowWorkspaceState>>

const FlowWorkspaceStoreContext = createContext<FlowWorkspaceStore | null>(null)

const flowStoreCache = new Map<string, FlowWorkspaceStore>()

interface FlowWorkspaceStoreProviderProps {
  tabId: string
  children: React.ReactNode
}

export const FlowWorkspaceStoreProvider: React.FC<FlowWorkspaceStoreProviderProps> = ({
  tabId,
  children,
}) => {
  const store = useMemo(() => {
    if (flowStoreCache.has(tabId)) {
      return flowStoreCache.get(tabId)!
    }
    const nextStore = createFlowWorkspaceStore()
    flowStoreCache.set(tabId, nextStore)
    return nextStore
  }, [tabId])

  useEffect(() => {
    return () => {
      const cached = flowStoreCache.get(tabId)
      if (cached === store) {
        flowStoreCache.delete(tabId)
      }
    }
  }, [store, tabId])

  return (
    <FlowWorkspaceStoreContext.Provider value={store}>
      {children}
    </FlowWorkspaceStoreContext.Provider>
  )
}

export const useFlowWorkspaceStoreContext = (): FlowWorkspaceStore => {
  const store = useContext(FlowWorkspaceStoreContext)
  if (!store) {
    throw new Error("useFlowWorkspaceStoreContext must be used within FlowWorkspaceStoreProvider")
  }
  return store
}

export const getFlowWorkspaceStore = (tabId: string): FlowWorkspaceStore | undefined => {
  return flowStoreCache.get(tabId)
}

export const clearFlowWorkspaceStore = (tabId: string) => {
  flowStoreCache.delete(tabId)
}
