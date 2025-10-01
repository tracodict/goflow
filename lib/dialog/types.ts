import { FeatureFlagsState, isDialogEnabled } from '../../lib/feature-flags';

export type DialogType = 'modal' | 'modeless' | 'drawer';

export interface DialogContentRef {
  mode: 'dynamic-form' | 'page' | 'component';
  refId: string; // schemaId | pageId | component template id
  layout?: 'auto' | 'custom-page';
}

export interface DialogConfigInput {
  id?: string;
  type: DialogType;
  title?: string;
  content: DialogContentRef;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  position?: { x: number; y: number; width?: number; height?: number };
  maximizable?: boolean;
  resizable?: boolean;
  draggable?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  preventClose?: boolean;
  zIndexBase?: number;
  initialPayload?: any;
  returnOnClose?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;
}

export interface ActiveDialog extends DialogConfigInput {
  id: string;
  state: {
    isOpen: boolean;
    isMaximized: boolean;
    isFocused: boolean;
    isDirty?: boolean;
  };
  data?: any;
  resultResolver?: (value: any) => void;
  rejector?: (reason?: any) => void;
}

export interface DialogStoreState {
  dialogs: Record<string, ActiveDialog>;
  zOrder: string[];
  focusId?: string;
}

export interface DialogStoreActions {
  openDialog: (cfg: DialogConfigInput) => Promise<any>;
  closeDialog: (id: string, result?: any) => void;
  forceCloseAll: () => void;
  updateDialog: (id: string, patch: Partial<ActiveDialog>) => void;
  maximizeDialog: (id: string) => void;
  restoreDialog: (id: string) => void;
  bringToFront: (id: string) => void;
  setDirty: (id: string, dirty: boolean) => void;
  updateDialogData: (id: string, data: any) => void;
}

export type DialogStore = DialogStoreState & DialogStoreActions;

export const dialogFeatureEnabled = (): boolean => isDialogEnabled();
