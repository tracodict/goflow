export { DialogFormLauncherPropertyConfig } from './property-config';
export { DialogFormLauncherInterface } from './interface';
export { PageBuilderDialogFormLauncher } from './PageBuilderDialogFormLauncher';

// Register renderer
import { registerComponentRenderer, createComponentRenderer } from '../component-renderer-registry';

registerComponentRenderer(
	createComponentRenderer(
		'DialogFormLauncher',
		() => require('./PageBuilderDialogFormLauncher').PageBuilderDialogFormLauncher,
		10
	)
);

export const DialogFormLauncherComponent = {
	name: 'DialogFormLauncher',
	category: 'Form',
	description: 'Launches a DynamicForm dialog',
	icon: 'MousePointer'
};
