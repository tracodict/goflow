import { componentRegistry } from '@/lib/component-registry';
import { defineEvent, defineAction } from '@/lib/component-interface';

// DynamicForm vComponent (Updated capabilities)
componentRegistry.register({
  componentType: 'DynamicForm',
  displayName: 'Dynamic Form',
  description: 'Schema-driven form with JSONPath bindings, event emission, uiSchema ordering/widgets, and dialog open helper.',
  lifecycle: {
    onMount: defineEvent('Form mounted', { type: 'object', properties: { timestamp: { type: 'number' } } }, { category: 'lifecycle' }),
    onUnmount: defineEvent('Form unmounted', { type: 'object', properties: { timestamp: { type: 'number' } } }, { category: 'lifecycle' }),
  },
  events: {
    onChange: defineEvent('Form data changed', { type: 'object', properties: { timestamp: { type: 'number' }, componentId: { type: 'string' }, path: { type: 'string' }, value: {}, fullData: {} } }, { category: 'interaction' }),
    onSubmit: defineEvent('Form submitted', { type: 'object', properties: { timestamp: { type: 'number' }, componentId: { type: 'string' }, data: {} } }, { category: 'interaction' }),
    onValidate: defineEvent('Validation completed', { type: 'object', properties: { timestamp: { type: 'number' }, componentId: { type: 'string' }, valid: { type: 'boolean' }, errors: { type: 'array', items: { type: 'object' } } } }, { category: 'validation' }),
  },
  actions: {
    setData: defineAction('Replace form data', { type: 'object', properties: { data: {} }, required: ['data'] }, { category: 'state' }),
    patchData: defineAction('Patch form data at path', { type: 'object', properties: { path: { type: 'string' }, value: {} }, required: ['path'] }, { category: 'state' }),
    validate: defineAction('Trigger validation', { type: 'object', properties: {} }, { category: 'data' }),
    submit: defineAction('Programmatically submit the form', { type: 'object', properties: {} }, { category: 'state' }),
    setBindings: defineAction('Replace bindings map', { type: 'object', properties: { bindings: { type: 'object' } }, required: ['bindings'] }, { category: 'data' }),
    setUiSchema: defineAction('Update uiSchema (merge/replace)', { type: 'object', properties: { uiSchema: { type: 'object' }, mode: { type: 'string', enum: ['replace', 'merge'] } }, required: ['uiSchema'] }, { category: 'display' }),
    openInDialog: defineAction('Open this form in a dialog', { type: 'object', properties: { schemaId: { type: 'string' }, title: { type: 'string' }, type: { type: 'string', enum: ['modal', 'modeless'] }, width: { type: 'number' }, height: { type: 'number' } }, required: ['schemaId'] }, { category: 'navigation' })
  },
  state: {
    isDirty: { description: 'True if user modified data vs initial.', type: { type: 'boolean' }, readonly: false },
    isValid: { description: 'Latest validation pass result.', type: { type: 'boolean' }, readonly: true },
    errors: { description: 'Validation errors array (AJV-style planned).', type: { type: 'array' }, readonly: true },
    // Future: expose bindings/uiSchema introspection
    bindings: { description: 'Active bindings map (if supplied)', type: { type: 'object' }, readonly: true },
    uiSchema: { description: 'Current uiSchema definition', type: { type: 'object' }, readonly: true },
  }
});
