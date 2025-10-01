import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { getFeatureFlags } from '../feature-flags';
import type { ActiveDialog, DialogConfigInput, DialogStore } from './types';

function normalizeConfig(cfg: DialogConfigInput): ActiveDialog {
  const id = cfg.id || nanoid(10);
  return {
    ...cfg,
    id,
    state: {
      isOpen: true,
      isMaximized: false,
      isFocused: true,
      isDirty: false,
    },
  };
}

export const useDialogStore = create<DialogStore>((set, get) => ({
  dialogs: {},
  zOrder: [],
  focusId: undefined,

  openDialog: async (cfg: DialogConfigInput) => {
    if (!getFeatureFlags().ff_dialogs) {
      throw new Error('Dialog feature disabled (ff_dialogs=false)');
    }
    const active = normalizeConfig(cfg);
    return new Promise<any>((resolve, reject) => {
      active.resultResolver = resolve;
      active.rejector = reject;
      set(state => ({
        dialogs: { ...state.dialogs, [active.id]: active },
        zOrder: [...state.zOrder.filter(id => id !== active.id), active.id],
        focusId: active.id,
      }));
    });
  },

  closeDialog: (id: string, result?: any) => {
    set(state => {
      const dlg = state.dialogs[id];
      if (!dlg) return state;
      dlg.resultResolver?.(result ?? { submitted: false });
      const { [id]: _, ...rest } = state.dialogs;
      const zOrder = state.zOrder.filter(d => d !== id);
        return {
          dialogs: rest,
          zOrder,
          focusId: zOrder[zOrder.length - 1],
        };
    });
  },

  forceCloseAll: () => {
    set(state => {
      Object.values(state.dialogs).forEach(d => d.rejector?.('forceCloseAll'));
      return { dialogs: {}, zOrder: [], focusId: undefined };
    });
  },

  updateDialog: (id, patch) => set(state => {
    const dlg = state.dialogs[id];
    if (!dlg) return state;
    const updated: ActiveDialog = { ...dlg, ...patch, state: { ...dlg.state, ...(patch as any).state } };
    return { dialogs: { ...state.dialogs, [id]: updated } };
  }),

  maximizeDialog: (id) => set(state => {
    const dlg = state.dialogs[id];
    if (!dlg) return state;
    dlg.state.isMaximized = true;
    return { dialogs: { ...state.dialogs } };
  }),

  restoreDialog: (id) => set(state => {
    const dlg = state.dialogs[id];
    if (!dlg) return state;
    dlg.state.isMaximized = false;
    return { dialogs: { ...state.dialogs } };
  }),

  bringToFront: (id) => set(state => {
    if (!state.dialogs[id]) return state;
    const zOrder = [...state.zOrder.filter(d => d !== id), id];
    return { zOrder, focusId: id };
  }),

  setDirty: (id, dirty) => set(state => {
    const dlg = state.dialogs[id];
    if (!dlg) return state;
    dlg.state.isDirty = dirty;
    return { dialogs: { ...state.dialogs } };
  }),

  updateDialogData: (id, data) => set(state => {
    const dlg = state.dialogs[id];
    if (!dlg) return state;
    dlg.data = data;
    return { dialogs: { ...state.dialogs } };
  }),

  // Position & size helpers (added for drag / resize)
  setDialogPosition: (id: string, pos: { x: number; y: number }) => set(state => {
    const dlg = state.dialogs[id];
    if (!dlg) return state;
    dlg.position = { ...(dlg.position || {}), x: pos.x, y: pos.y };
    return { dialogs: { ...state.dialogs } };
  }),
  setDialogSize: (id: string, size: { width?: number; height?: number }) => set(state => {
    const dlg = state.dialogs[id];
    if (!dlg) return state;
    const prev = dlg.position || { x: 0, y: 0 };
    dlg.position = { x: prev.x, y: prev.y, width: size.width ?? prev.width, height: size.height ?? prev.height };
    return { dialogs: { ...state.dialogs } };
  }),
}));
