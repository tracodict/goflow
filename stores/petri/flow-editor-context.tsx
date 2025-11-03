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

export type FlowWorkspaceStore = UseBoundStore<StoreApi<FlowWorkspaceState>>

const FlowWorkspaceStoreContext = createContext<FlowWorkspaceStore | null>(null)

// Global map to hold flow stores by tab ID
const flowStores = new Map<string, FlowWorkspaceStore>();

export function getFlowWorkspaceStore(tabId: string): FlowWorkspaceStore {
  if (!flowStores.has(tabId)) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[FlowStore] Creating store for tab ${tabId}`);
    }
    flowStores.set(tabId, createFlowWorkspaceStore());
  }
  return flowStores.get(tabId)!;
}

export function disposeFlowWorkspaceStore(tabId: string) {
  if (flowStores.has(tabId)) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[FlowStore] Disposing store for tab ${tabId}`);
    }
    flowStores.delete(tabId);
  }
}
