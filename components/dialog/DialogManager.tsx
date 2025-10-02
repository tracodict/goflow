"use client";
import React, { useEffect, useRef, useCallback } from 'react';
// Use the PageBuilderDynamicForm so dialog forms render identically to in-page forms
import { PageBuilderDynamicForm } from '@/vComponents/DynamicForm/PageBuilderDynamicForm';
import { MenuDefinitionPanelStub } from './MenuDefinitionPanelStub';
import { useDialogStore } from '../../lib/dialog/store';
import { isDialogEnabled } from '../../lib/feature-flags';

// Minimal shell styling placeholder
const baseShell: React.CSSProperties = {
  position: 'fixed',
  background: 'var(--color-dialog-bg, var(--background, #ffffff))',
  color: 'var(--color-dialog-fg, var(--foreground, #111827))',
  border: '1px solid var(--color-border, #e5e7eb)',
  borderRadius: 8,
  boxShadow: '0 8px 28px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backdropFilter: 'blur(2px)',
};

const headerStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 14,
  fontWeight: 600,
  background: 'var(--color-dialog-header-bg, var(--muted, #f3f4f6))',
  borderBottom: '1px solid var(--color-border, #e5e7eb)',
  cursor: 'move',
  userSelect: 'none',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const bodyStyle: React.CSSProperties = {
  padding: '14px 16px 18px',
  flex: 1,
  overflow: 'auto',
  background: 'var(--color-dialog-body-bg, transparent)'
};

export const DialogManager: React.FC = () => {
  const { dialogs, zOrder, bringToFront, closeDialog, setDialogPosition } = useDialogStore() as any;
  const enabled = isDialogEnabled();

  const focusSentinels = useRef<Record<string, { start: HTMLDivElement | null; end: HTMLDivElement | null }>>({});

  const handleKeyDown = useCallback((e: KeyboardEvent, id: string) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeDialog(id, { submitted: false, reason: 'escape' });
    }
    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      // Placeholder: treat as submit intent (will integrate with DynamicForm later)
      e.stopPropagation();
      closeDialog(id, { submitted: true, reason: 'ctrl-enter' });
      return;
    }
    if (e.key === 'Tab') {
      const dlg = dialogs[id];
      if (!dlg || dlg.type !== 'modal') return; // simple trap only for modal
      const container = document.getElementById(`dlg-${id}`);
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        (last as HTMLElement).focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        (first as HTMLElement).focus();
      }
    }
  }, [dialogs, closeDialog]);

  useEffect(() => {
    if (!enabled && Object.keys(dialogs).length > 0) {
      // Feature turned off; close all dialogs
      Object.keys(dialogs).forEach(id => closeDialog(id));
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
  {zOrder.map((id: string, idx: number) => {
        const dlg = dialogs[id];
        if (!dlg) return null;
        const style: React.CSSProperties = {
          ...baseShell,
          top: dlg.position?.y ?? 120 + idx * 16,
            left: dlg.position?.x ?? 160 + idx * 24,
          width: dlg.position?.width ?? 760,
          height: dlg.position?.height ?? 360,
          zIndex: 1000 + idx,
        };
        const titleId = `dlg-${id}-title`;
        const role = dlg.type === 'modal' ? 'dialog' : 'dialog';
        const ariaModal = dlg.type === 'modal' ? true : undefined;
        const onKeyDown = (e: React.KeyboardEvent) => handleKeyDown(e.nativeEvent, id);
        const onDragStart = (e: React.MouseEvent) => {
          if (!dlg.draggable) return;
          const startX = e.clientX;
          const startY = e.clientY;
          const orig = dlg.position || { x: style.left as number, y: style.top as number, width: style.width as number, height: style.height as number };
          const move = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            setDialogPosition(dlg.id, { x: orig.x + dx, y: orig.y + dy });
          };
          const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        };
        return (
          <div
            key={id}
            id={`dlg-${id}`}
            style={style}
            onMouseDown={() => bringToFront(id)}
            role={role}
            aria-modal={ariaModal}
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={onKeyDown}
          >
            <div style={headerStyle} id={titleId} onMouseDown={onDragStart}>
              <span>{dlg.title || dlg.content.refId}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button aria-label="close dialog" onClick={() => closeDialog(id, { submitted: false })} style={{ background: 'transparent', color: 'inherit', border: 'none', cursor: 'pointer' }}>×</button>
              </div>
            </div>
            <div style={bodyStyle}>
              {/* Placeholder rendering per content.mode */}
              {dlg.content.mode === 'dynamic-form' && (() => {
                const ip = (dlg as any).initialPayload || {};
                const updateData = (useDialogStore.getState() as any).updateDialogData;
                // Force empty uiSchema to trigger responsive layout
                const forceEmptyUiSchema = ip.uiSchema ? JSON.stringify(ip.uiSchema) : JSON.stringify({});
                console.log('[DialogManager] Dialog width:', dlg.position?.width ?? 760, 'uiSchema:', forceEmptyUiSchema);
                return (
                  <div style={{ width: '100%', display: 'block', minWidth: 0 }}>
                    <PageBuilderDynamicForm
                      data-schema-id={dlg.content.refId}
                      data-form-layout="auto"
                      data-initial-value={ip.initialValue ? JSON.stringify(ip.initialValue) : undefined}
                      data-bindings={ip.bindings ? JSON.stringify(ip.bindings) : undefined}
                      data-ui-schema={forceEmptyUiSchema}
                      data-rules={ip.rules ? JSON.stringify(ip.rules) : undefined}
                      style={{ width: '100%', minWidth: 0 }}
                      onChange={(next: any) => updateData(dlg.id, next)}
                      onSubmit={(finalData: any) => {
                        updateData(dlg.id, finalData);
                        closeDialog(dlg.id, { submitted: true, data: finalData });
                      }}
                    />
                  </div>
                );
              })()}
              {dlg.content.mode === 'page' && <div>Page placeholder for {dlg.content.refId}</div>}
              {dlg.content.mode === 'component' && (
                dlg.content.refId === 'menu-definition-panel' ? (() => {
                  let initialItems: any[] = [];
                  try {
                    const raw = (dlg as any).initialPayload?.currentConfig as string | undefined;
                    if (raw) {
                      const parsed = JSON.parse(raw);
                      if (Array.isArray(parsed.items)) initialItems = parsed.items;
                    }
                  } catch {}
                  return (
                    <MenuDefinitionPanelStub
                      initialItems={initialItems}
                      onSave={(items) => {
                        (useDialogStore.getState() as any).updateDialogData(dlg.id, { items });
                      }}
                      onClose={() => closeDialog(dlg.id, { submitted: true, reason: 'menu-definition-save' })}
                    />
                  );
                })()
                : <div>Component placeholder for {dlg.content.refId}</div>
              )}
            </div>
            {dlg.resizable !== false && (
              <div
                style={{ position: 'absolute', width: 14, height: 14, right: 2, bottom: 2, cursor: 'se-resize', background: 'transparent' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const orig = dlg.position || { x: style.left as number, y: style.top as number, width: style.width as number, height: style.height as number };
                  const move = (ev: MouseEvent) => {
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;
                    const newW = Math.max(240, (orig.width ?? style.width as number) + dx);
                    const newH = Math.max(180, (orig.height ?? style.height as number) + dy);
                    (useDialogStore.getState() as any).setDialogSize(dlg.id, { width: newW, height: newH });
                  };
                  const up = () => {
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                  };
                  window.addEventListener('mousemove', move);
                  window.addEventListener('mouseup', up);
                }}
              />
            )}
          </div>
        );
      })}
      {/** Auto-focus newly added top dialog (simple heuristic) */}
      {(() => {
        const topId = zOrder[zOrder.length - 1];
        if (!topId) return null;
        setTimeout(() => {
          const el = document.getElementById(`dlg-${topId}`);
            if (el && dialogs[topId]?.autoFocus !== false) {
              // Try first focusable
              const candidate = el.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
              (candidate || el).focus();
            }
        }, 0);
        return null;
      })()}
    </>
  );
};
