"use client";
import React from 'react';
import { DialogProvider } from '@/lib/dialog/context';
import { DialogManager } from './DialogManager';
import { setFeatureFlagOverrides } from '@/lib/feature-flags';

// Ensure dialogs are enabled (can be toggled later via env)
setFeatureFlagOverrides({ ff_dialogs: true });

export const DialogRootClient: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <DialogProvider>
      <DialogManager />
      {children}
    </DialogProvider>
  );
};

DialogRootClient.displayName = 'DialogRootClient';
