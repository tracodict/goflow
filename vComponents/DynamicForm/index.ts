// DynamicForm vComponent exports & renderer registration
export { DynamicFormPropertyConfig } from './property-config';
export { PageBuilderDynamicForm } from './PageBuilderDynamicForm';
export * from './component-interface';

// Register the DynamicForm component for dynamic rendering in the Page Builder
import { registerComponentRenderer, createComponentRenderer } from '../component-renderer-registry';

registerComponentRenderer(
	createComponentRenderer(
		'DynamicForm',
		() => require('./PageBuilderDynamicForm').PageBuilderDynamicForm,
		10 // Priority similar to other core form components
	)
);

// Component registration meta (optional consistency with others)
export const DynamicFormComponent = {
	name: 'DynamicForm',
	category: 'Form',
	description: 'Schema-driven JSON Schema form (auto layout)',
	icon: 'Table',
	version: '1.0.0'
};
