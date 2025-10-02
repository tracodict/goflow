import React, { useState } from 'react';
import { useDialog } from '@/lib/dialog/context';
import { PropertyTabConfig, CustomPropertyRenderProps } from '../property-config-types';

const DynamicFormCustomRenderer: React.FC<CustomPropertyRenderProps> = ({ attributes, onAttributeUpdate }) => {
  // Safely attempt to access dialog API; if provider absent, disable preview gracefully.
  let open: any = undefined;
  let featureEnabled = false;
  try {
    const dlg = useDialog();
    open = dlg.open;
    featureEnabled = dlg.featureEnabled;
  } catch (e) {
    // Outside DialogProvider; preview button will be disabled.
  }
  const schemaId = attributes?.['data-schema-id'] || '';
  const layout = attributes?.['data-form-layout'] || 'auto';
  const readOnly = attributes?.['data-readonly'] === 'true';
  const bindingsRaw = attributes?.['data-bindings'] || '{}';
  const uiSchemaRaw = attributes?.['data-ui-schema'] || '{"ui:order": []}';
  const initialValueRaw = attributes?.['data-initial-value'] || '{}';
  const rulesRaw = attributes?.['data-rules'] || '[]';

  const [tab, setTab] = useState<'config' | 'bindings' | 'uiSchema' | 'rules' | 'events'>('config');

  const preview = async () => {
  if (!open || !featureEnabled || !schemaId) return;
    await open({
      type: 'modeless',
      title: `Form Preview: ${schemaId}`,
      content: { mode: 'dynamic-form', refId: schemaId },
      draggable: true,
      resizable: true,
      position: { x: 260, y: 140, width: 480, height: 520 },
      autoFocus: true,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 border-b pb-1">
        <div className="flex gap-2 text-[11px]">
          {(['config','bindings','uiSchema','rules','events'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={"px-2 py-0.5 rounded border text-xs " + (tab===t? 'bg-accent text-accent-foreground':'bg-background')}
            >{t}</button>
          ))}
        </div>
        <div>
          <button
            type="button"
            disabled={!schemaId}
            onClick={preview}
            className="text-xs px-2 py-1 border rounded bg-background hover:bg-accent disabled:opacity-40"
          >Preview…</button>
        </div>
      </div>
      {tab === 'config' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Schema ID</label>
            <input
              value={schemaId}
              onChange={e => onAttributeUpdate('data-schema-id', e.target.value)}
              className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
              placeholder="customer.schema"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Layout Mode</label>
            <select
              value={layout}
              onChange={e => onAttributeUpdate('data-form-layout', e.target.value)}
              className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
            >
              <option value="auto">Auto (schema-driven)</option>
              <option value="custom-page">Custom Page</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={e => onAttributeUpdate('data-readonly', String(e.target.checked))}
            />
            <span className="text-xs text-muted-foreground">Read Only</span>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Initial Value (JSON)</label>
            <textarea
              value={initialValueRaw}
              onChange={e => onAttributeUpdate('data-initial-value', e.target.value)}
              rows={4}
              className="w-full p-2 border border-input rounded text-xs font-mono bg-background text-foreground"
              placeholder="{ }"
            />
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">Configure base schema id, layout and defaults.</p>
        </div>
      )}
      {tab === 'bindings' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium mb-1 text-muted-foreground">Bindings (field -&gt; JSONPath)</label>
          <textarea
            value={bindingsRaw}
            onChange={e => onAttributeUpdate('data-bindings', e.target.value)}
            rows={8}
            className="w-full p-2 border border-input rounded text-xs font-mono bg-background text-foreground"
            placeholder='{"customer.name": "$.customer.name"}'
          />
          <p className="text-[10px] text-muted-foreground">JSON object mapping form field paths (relative) to JSONPath in external model.</p>
        </div>
      )}
      {tab === 'uiSchema' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium mb-1 text-muted-foreground">UI Schema JSON</label>
          <textarea
            value={uiSchemaRaw}
            onChange={e => onAttributeUpdate('data-ui-schema', e.target.value)}
            rows={10}
            className="w-full p-2 border border-input rounded text-xs font-mono bg-background text-foreground"
            placeholder='{"ui:order": ["name", "address", "*"]}'
          />
          <p className="text-[10px] text-muted-foreground">Supports root and nested "ui:order" plus simple "ui:widget" overrides.</p>
        </div>
      )}
      {tab === 'rules' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium mb-1 text-muted-foreground">Dynamic Rules JSON</label>
          <textarea
            value={rulesRaw}
            onChange={e => onAttributeUpdate('data-rules', e.target.value)}
            rows={12}
            className="w-full p-2 border border-input rounded text-xs font-mono bg-background text-foreground"
            placeholder='[{"condition": {"field": "showAdvanced", "operator": "equals", "value": true}, "action": {"type": "show", "field": "advanced"}}]'
          />
          <div className="text-[10px] text-muted-foreground space-y-1">
            <p><strong>Rule Types:</strong> show/hide fields, enable/disable fields, modify schema (enum, range, required)</p>
            <p><strong>Conditions:</strong> equals, not_equals, greater_than, less_than, contains, exists, in</p>
            <p><strong>Example:</strong> Show field when checkbox is true, modify enum options based on selection</p>
          </div>
        </div>
      )}
      {tab === 'events' && (
        <div className="space-y-3">
          {['onChange','onSubmit','onValidate'].map(evt => (
            <div key={evt}>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">{evt} Script</label>
              <textarea
                value={attributes[`data-${evt}-script`] || ''}
                onChange={e => onAttributeUpdate(`data-${evt}-script`, e.target.value)}
                rows={evt==='onChange'?6:4}
                className="w-full p-2 border border-input rounded text-xs font-mono bg-background text-foreground"
                placeholder={`// ${evt} handler\n// payload: event payload; context: helpers`}
              />
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">Event payload includes timestamp, componentId, and event-specific data (path/value/validation errors).</p>
        </div>
      )}
    </div>
  );
};

export const DynamicFormPropertyConfig: PropertyTabConfig = {
  componentType: 'DynamicForm',
  sections: [],
  customRenderer: DynamicFormCustomRenderer,
};
