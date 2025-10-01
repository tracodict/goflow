import { useDialogStore } from './store';
import type { DialogConfigInput } from './types';

export interface OpenDynamicFormOptions {
  schemaId: string;
  title?: string;
  model?: any;
  bindings?: Record<string, string>;
  uiSchema?: any;
  initialValue?: any;
  type?: 'modal' | 'modeless';
  width?: number;
  height?: number;
  position?: { x?: number; y?: number };
}

/**
 * Programmatically open a DynamicForm inside a dialog.
 * Returns a promise that resolves with the dialog close result (submitted flag, data, etc.).
 */
export function openDynamicFormInDialog(opts: OpenDynamicFormOptions) {
  const {
    schemaId,
    title,
    model,
    bindings,
    uiSchema,
    initialValue,
    type = 'modal',
  width = 760,
    height = 420,
    position
  } = opts;

  const store = useDialogStore.getState();
  const cfg: DialogConfigInput = {
    type,
    title: title || `Form: ${schemaId}`,
    content: {
      mode: 'dynamic-form',
      refId: schemaId,
      layout: 'auto'
    },
    position: { x: position?.x ?? 200, y: position?.y ?? 140, width, height },
    resizable: true,
    draggable: true,
    initialPayload: {
      model,
      bindings,
      uiSchema,
      initialValue
    }
  };
  return store.openDialog(cfg);
}
