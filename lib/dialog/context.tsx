"use client";
import React, { createContext, useContext, useMemo } from 'react';
import { useDialogStore } from './store';
import type { DialogConfigInput, ActiveDialog } from './types';
import { isDialogEnabled } from '../feature-flags';

interface DialogAPI {
  open: (cfg: DialogConfigInput) => Promise<any>;
  close: (id: string, result?: any) => void;
  maximize: (id: string) => void;
  restore: (id: string) => void;
  bringToFront: (id: string) => void;
  setData: (id: string, data: any) => void;
  getData: (id: string) => any;
  isDirty: (id: string) => boolean;
  dialogs: ActiveDialog[];
  featureEnabled: boolean;
}

const DialogContext = createContext<DialogAPI | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useDialogStore();
  const api: DialogAPI = useMemo(() => ({
    open: store.openDialog,
    close: store.closeDialog,
    maximize: store.maximizeDialog,
    restore: store.restoreDialog,
    bringToFront: store.bringToFront,
    setData: store.updateDialogData,
    getData: (id: string) => store.dialogs[id]?.data,
    isDirty: (id: string) => !!store.dialogs[id]?.state.isDirty,
    dialogs: Object.values(store.dialogs),
    featureEnabled: isDialogEnabled(),
  }), [store.dialogs, store.focusId]);

  return <DialogContext.Provider value={api}>{children}</DialogContext.Provider>;
};

export function useDialog(): DialogAPI {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}
