"use client";
import React, { useCallback, useMemo } from 'react';
import { openDynamicFormInDialog } from '@/lib/dialog/actions';
import { isDialogEnabled } from '@/lib/feature-flags';
import { globalSandbox } from '@/lib/script-sandbox';

export interface PageBuilderDialogFormLauncherProps {
  'data-schema-id'?: string;
  'data-dialog-title'?: string;
  'data-dialog-width'?: string;
  'data-dialog-height'?: string;
  'data-bindings'?: string;
  'data-ui-schema'?: string;
  'data-initial-value'?: string;
  'data-onclick-script'?: string;
  'data-component-type'?: string;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent) => void; // editor selection handler
}

// Lightweight parse helper with safe fail
function safeParse<T = any>(raw?: string): T | undefined {
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { return undefined; }
}

export const PageBuilderDialogFormLauncher: React.FC<PageBuilderDialogFormLauncherProps> = (props) => {
  const {
    'data-schema-id': schemaId,
    'data-dialog-title': dialogTitle,
    'data-dialog-width': widthStr,
    'data-dialog-height': heightStr,
    'data-bindings': bindingsJSON,
    'data-ui-schema': uiSchemaJSON,
    'data-initial-value': initialValueJSON,
    'data-onclick-script': onClickScript,
    'data-component-type': componentType,
    style,
    className,
    onClick: editorClick
  } = props;

  const bindings = useMemo(() => safeParse<Record<string, string>>(bindingsJSON), [bindingsJSON]);
  const uiSchema = useMemo(() => safeParse<any>(uiSchemaJSON), [uiSchemaJSON]);
  const initialValue = useMemo(() => safeParse<any>(initialValueJSON), [initialValueJSON]);
  const width = widthStr ? parseInt(widthStr, 10) : undefined;
  const height = heightStr ? parseInt(heightStr, 10) : undefined;

  const handleActivate = useCallback(async (e: React.MouseEvent) => {
    // Allow builder selection logic to run as well
    editorClick?.(e);
    if (!schemaId) return;
    if (!isDialogEnabled()) {
      console.warn('[DialogFormLauncher] Dialog feature flag disabled');
      return;
    }

    // Optional script pre-hook; can mutate context or veto open by returning { cancel: true }
    if (onClickScript) {
      try {
        // Build a minimal EventHandlerContext-like object
        const eventContext: any = {
          component: {
            id: schemaId,
            type: 'DialogFormLauncher',
            getProps: () => ({ schemaId, dialogTitle, width, height }),
            setProps: () => {},
            emit: (evt: string, payload: any) => console.log('[DialogFormLauncher emit]', evt, payload),
            callAction: async () => ({ success: true })
          },
          data: {
            query: async () => ({}),
            mutate: async () => ({})
          },
            page: {
              navigate: (_: string) => {},
              getState: () => ({}),
              setState: (_: any) => {},
              dispatch: (_: any) => {}
            },
          app: {
            showNotification: (m: string, t: string = 'info') => console.log(`[${t}]`, m),
            callWorkflow: async () => ({ success: true })
          },
          utils: {
            formatDate: (d: Date | string) => new Date(d as any).toISOString(),
            log: (...a: any[]) => console.log('[DialogFormLauncher]', ...a)
          }
        };
        const scriptResult = await globalSandbox.executeScript(
          'dialog-form-launcher-onClick',
          onClickScript,
          eventContext,
          { schemaId, title: dialogTitle, bindings, uiSchema, initialValue }
        );
        if (scriptResult && typeof scriptResult === 'object' && (scriptResult as any).cancel) {
          console.log('[DialogFormLauncher] Open cancelled by script');
          return;
        }
      } catch (err) {
        console.error('[DialogFormLauncher] onClick script error', err);
      }
    }

    try {
      await openDynamicFormInDialog({
        schemaId,
        title: dialogTitle,
        bindings,
        uiSchema,
        initialValue,
        width,
        height,
        type: 'modal'
      });
    } catch (err) {
      console.warn('[DialogFormLauncher] Failed to open dialog. Is <DialogProvider> mounted?', err);
    }
  }, [schemaId, dialogTitle, bindings, uiSchema, initialValue, width, height, onClickScript, editorClick]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(e as any); } }}
      data-component-type={componentType}
      style={{
        padding: '10px 18px',
        background: '#6366f1',
        color: '#fff',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500,
        userSelect: 'none',
        outline: 'none',
        ...style
      }}
      className={className}
    >
      {dialogTitle || 'Open Form Dialog'}
      {!schemaId && (
        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>(set data-schema-id)</span>
      )}
    </div>
  );
};

PageBuilderDialogFormLauncher.displayName = 'PageBuilderDialogFormLauncher';
