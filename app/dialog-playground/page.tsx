"use client";
import React from 'react';
import { DialogProvider, useDialog } from '../../lib/dialog/context';
import { DialogManager } from '../../components/dialog/DialogManager';
import { setFeatureFlagOverrides } from '../../lib/feature-flags';

// Enable dialogs for playground explicitly
setFeatureFlagOverrides({ ff_dialogs: true });

const Launcher: React.FC = () => {
  const dialog = useDialog();
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Dialog Playground</h2>
      <button
        onClick={async () => {
          const res = await dialog.open({
            type: 'modal',
            title: 'Example Dynamic Form',
            content: { mode: 'dynamic-form', refId: 'example-user', layout: 'auto' },
            size: 'md',
            returnOnClose: true,
          });
          // eslint-disable-next-line no-console
          console.log('Dialog result:', res);
        }}
        style={{ padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
      >
        Open DynamicForm Dialog
      </button>
      <button
        onClick={() => {
          dialog.open({
            type: 'modeless',
            title: 'Modeless Component',
            content: { mode: 'component', refId: 'SomeComponent' },
            size: 'sm',
          });
        }}
        style={{ padding: '8px 14px', background: '#374151', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
      >
        Open Modeless Component Dialog
      </button>
    </div>
  );
};

const DialogPlaygroundPage: React.FC = () => {
  return (
    <DialogProvider>
      <DialogManager />
      <Launcher />
    </DialogProvider>
  );
};

export default DialogPlaygroundPage;
