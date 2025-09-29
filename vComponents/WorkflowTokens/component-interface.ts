import { componentRegistry } from '@/lib/component-registry'
import { defineEvent, defineAction } from '@/lib/component-interface'

// Register workflow-tokens component interface
componentRegistry.register({
  componentType: 'workflow-tokens',
  displayName: 'Workflow Tokens',
  description: 'Workflow: Visualize live tokens of a selected Color (schema) and inspect / fire transitions.',
  lifecycle: {
    onMount: defineEvent('Component mounted', { type: 'object', properties: { timestamp: { type: 'number' }}} , { category: 'lifecycle' }),
    onUnmount: defineEvent('Component unmounted', { type: 'object', properties: { timestamp: { type: 'number' }}} , { category: 'lifecycle' })
  },
  events: {
    onColorChange: defineEvent('Color schema changed', { type: 'object', properties: { color: { type: 'string' } } }, { category: 'interaction' })
  },
  actions: {
    setColor: defineAction('Set active color', { type: 'object', properties: { color: { type: 'string' } }, required: ['color'] }, { category: 'state' })
  }
})
