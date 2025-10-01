import { ComponentEventInterface, defineEvent, defineAction } from '@/lib/component-interface';

const BaseEvent = {
  type: 'object' as const,
  properties: {
    timestamp: { type: 'number' as const },
    componentId: { type: 'string' as const },
    eventType: { type: 'string' as const }
  },
  required: ['timestamp','componentId','eventType']
};

const ClickEvent = {
  type: 'object' as const,
  properties: {
    timestamp: { type: 'number' as const },
    componentId: { type: 'string' as const },
    eventType: { type: 'string' as const },
    schemaId: { type: 'string' as const }
  },
  required: ['timestamp','componentId','eventType']
};

const ActionSchemas = {
  configure: {
    type: 'object' as const,
    properties: {
      schemaId: { type: 'string' as const },
      title: { type: 'string' as const },
      bindings: { type: 'object' as const },
      uiSchema: { type: 'object' as const },
      width: { type: 'number' as const },
      height: { type: 'number' as const }
    },
    required: ['schemaId']
  }
};

export const DialogFormLauncherInterface: ComponentEventInterface = {
  componentType: 'DialogFormLauncher',
  displayName: 'Dialog Form Launcher',
  description: 'Launches a DynamicForm inside a dialog when clicked',
  lifecycle: {
    onMount: defineEvent('Fired when launcher mounts', BaseEvent, { category: 'lifecycle' }),
    onUnmount: defineEvent('Fired when launcher unmounts', BaseEvent, { category: 'lifecycle' })
  },
  events: {
    onClick: defineEvent('User clicked launcher', ClickEvent, { category: 'interaction', preventDefault: true })
  },
  actions: {
    configure: defineAction('Update launcher configuration', ActionSchemas.configure, { category: 'state' })
  },
  state: {
    schemaId: { description: 'Target schema id', type: { type: 'string' } },
    title: { description: 'Dialog title', type: { type: 'string' } }
  }
};
