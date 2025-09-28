# vComponents - GoFlow Component Library

## Overview

This directory contains the centralized component library for GoFlow's PageBuilder platform. All components use a **dynamic registry-based system** for automatic discovery and integration with the visual page editor.

**🎯 Key Achievement**: Adding new components now requires **zero modifications** to `PageElement.tsx` or any core files!

## New Dynamic Component System

### Registry-Based Architecture

The new system uses a component renderer registry that eliminates hardcoded component handling:

1. **Components register themselves** automatically when imported
2. **PageElement.tsx dynamically resolves** components at runtime  
3. **Zero core file modifications** needed for new components

### Directory Structure
```
vComponents/
├── index.ts                     # Main export, imports all components  
├── component-renderer-registry.ts # Dynamic component registry system
├── registry.ts                  # Component library registry (drag-drop)
└── ComponentName/              # Self-contained component directories
    ├── index.ts                # Exports & renderer registration
    ├── Component.tsx           # Base React component
    ├── PageBuilderComponent.tsx # Page builder integration wrapper
    └── interface.ts            # Component interface definition
```
├── registry.ts              # Central component registration
├── integration-example.tsx  # Example integration code
└── Button/                  # Button component (example)
    ├── index.ts             # Main export and metadata
    ├── Button.tsx           # React component implementation
    └── interface.ts         # Component event interface definition
```

### Key Benefits

1. **Centralized Management**: All components in one location
2. **Automatic Discovery**: Components registered in registry.ts automatically appear in component library
3. **Standardized Structure**: Each component follows the same directory/file pattern
4. **Rich Metadata**: Components include icons, descriptions, templates, and interface definitions
5. **Registry-Based**: Easy to add new components by simply registering them

## Implementation Details

### Component Structure
Each component in vComponents follows this pattern:

1. **Component.tsx**: The actual React component with props and event handling
2. **interface.ts**: Component interface definition with events, actions, and state schema
3. **index.ts**: Main exports and component registration metadata

### Registry System
- `registry.ts` contains all registered components organized by category
- Components include template definitions for initial rendering
- Interface definitions enable scripting capabilities
- Automatic category-based organization in component library

## New Button Component

The new Button component demonstrates the full architecture:

- **Scriptable Events**: onClick, onMount, onUnmount with full payload schemas
- **Actions**: setLoading, setDisabled, setVisible with parameter validation
- **State Management**: Internal state with external control through actions
- **Template-Driven**: Initial appearance defined by template in registry
- **Full Integration**: Works with existing PageBuilder infrastructure

## Integration with Existing System

The new architecture is designed to be backward compatible:

1. Existing hardcoded components can coexist
2. Registry components are added to existing categories
3. ComponentsTab can be updated to merge both sources
4. Event handling and scripting work the same way

## Next Steps

1. **Replace Existing Button**: Update ComponentsTab to use new Button from registry
2. **Migrate Components**: Move existing components to vComponents structure
3. **Add More Components**: Create additional components following the new pattern
4. **Test Integration**: Verify drag-and-drop and scripting functionality

## Testing the New Button

To test the new Button component:

1. The component is registered in `vComponents/registry.ts`
2. It should appear in the "Form" category of the component library
3. When dragged to canvas, it creates a div with `data-component-type="Button"`
4. The component supports full scripting with events and actions
5. Template defines initial appearance and behavior

The new architecture provides a solid foundation for scaling the component library while maintaining clean separation of concerns and enabling powerful scripting capabilities.