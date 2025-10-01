import React from 'react';

export interface DynamicFormStubProps {
  schemaId?: string; // future: reference a registered schema
  data?: any; // future: initial data object
  onChange?: (data: any) => void; // future: change callback
  onSubmit?: (data: any) => void; // future: submit callback
  readOnly?: boolean;
  className?: string;
}

/**
 * Temporary placeholder implementation for DynamicForm (Phase 1).
 * Provides a consistent surface so dialogs can mount a form container
 * before the real schema-driven engine (Phase 2+).
 */
export const DynamicFormStub: React.FC<DynamicFormStubProps> = ({
  schemaId,
  data,
  onChange,
  onSubmit,
  readOnly,
  className,
}) => {
  return (
    <div
      className={className}
      data-dynamic-form-stub
      style={{
        border: '1px dashed var(--color-border,#888)',
        padding: '0.75rem',
        borderRadius: 4,
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 12,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
      }}
    >
      <strong>DynamicForm Placeholder</strong>
      <div style={{ marginTop: 4 }}>
        schemaId: <code>{schemaId ?? '—'}</code>
      </div>
      <div style={{ marginTop: 4 }}>
        readOnly: <code>{String(!!readOnly)}</code>
      </div>
      <div style={{ marginTop: 4 }}>
        data snapshot:
        <pre style={{
          margin: '4px 0 0',
          maxHeight: 140,
          overflow: 'auto',
          background: 'rgba(0,0,0,0.15)',
          padding: 6,
          borderRadius: 4,
        }}>
{JSON.stringify(data, null, 2) || '{}'}
        </pre>
      </div>
      <div style={{ marginTop: 8, opacity: 0.7 }}>
        (Schema-driven rendering, validation, JSONPath bindings and transformation pipeline arrive in Phase 2+.)
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            const next = { ...(data || {}), demoField: 'edited' };
            onChange?.(next);
          }}
          style={{ padding: '4px 8px' }}
        >
          Simulate Change
        </button>
        <button
          type="button"
          onClick={() => onSubmit?.(data)}
          style={{ padding: '4px 8px' }}
        >
          Simulate Submit
        </button>
      </div>
    </div>
  );
};

export default DynamicFormStub;
