import React from 'react';
import { PropertyTabConfig } from '../property-config-types';

export const DialogFormLauncherPropertyConfig: PropertyTabConfig = {
  componentType: 'DialogFormLauncher',
  sections: [
    {
      title: 'Dialog Configuration',
      fields: [
        { key: 'data-schema-id', label: 'Schema ID', type: 'text', placeholder: 'example.schema' },
        { key: 'data-dialog-title', label: 'Dialog Title', type: 'text', placeholder: 'Edit Record' },
        { key: 'data-dialog-width', label: 'Width', type: 'text', placeholder: '560' },
        { key: 'data-dialog-height', label: 'Height', type: 'text', placeholder: '480' },
      ]
    },
    {
      title: 'Optional JSON Config',
      fields: [
        { key: 'data-bindings', label: 'Bindings JSON', type: 'textarea', placeholder: '{"field.path": "$.json.path"}', rows: 5, helpText: 'Map form field paths to JSONPath in external model.' },
        { key: 'data-ui-schema', label: 'UI Schema JSON', type: 'textarea', placeholder: '{"ui:order": ["name", "*"]}', rows: 5 },
        { key: 'data-initial-value', label: 'Initial Value JSON', type: 'textarea', placeholder: '{ }', rows: 4 },
        { key: 'data-rules', label: 'Dynamic Rules JSON', type: 'textarea', placeholder: '[{"condition": {"field": "showAdvanced", "operator": "equals", "value": true}, "action": {"type": "show", "field": "advanced"}}]', rows: 6, helpText: 'Rules for dynamic field visibility, enabling, and schema modification.' }
      ]
    },
    {
      title: 'Event Scripts',
      fields: [
        { key: 'data-onclick-script', label: 'onClick Script', type: 'script', rows: 4, placeholder: '// Open dialog programmatically or modify config before open' }
      ]
    }
  ]
};
