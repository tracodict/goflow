## Design Consideration

To build a robust low-code AI app builder platform, your architecture needs to balance ease of use for end-users (who may not be expert developers), performance, security, and maintainability. You’ve already made solid choices with Go for the backend (scalable, efficient) and embedded Lua for user-defined workflows (lightweight scripting with good Go integration via libraries like gopher-lua). On the frontend, Next.js is an excellent fit for a visual page editor, leveraging React’s component model for drag-and-drop UI building, CSS tuning, and now extending to event/action definitions.
I’ll analyze your scenario step by step, focusing on the need for a scripting language to handle UI component processing (e.g., reducers for state management, manipulation like dynamic updates or transformations), event dispatching, and action processing. This includes both client-side (frontend) and server-side (backend) aspects. Then, I’ll recommend a design with rationale, trade-offs, and implementation tips.
Step 1: Understanding the Requirements
	•	Core Needs:
	◦	UI Manipulation and Reducers: This sounds like client-side logic, e.g., handling state changes (similar to Redux reducers), dynamically adding/removing components, or applying transformations based on user interactions in the built apps. In a low-code context, users might define simple scripts to “reduce” data (e.g., filter arrays) or manipulate DOM-like structures (React components in your case).
	◦	Event/Action Definition and Dispatching: Your visual editor is expanding here. Events (e.g., onClick, onChange) trigger actions, which could be client-side (update UI) or server-side (API calls, workflows). You want backend capabilities for processing these, e.g., integrating with AI models, data persistence, or complex logic that shouldn’t run on the client for security reasons.
	◦	Scripting Language Choice: It must be user-friendly for low-code users, integrable with your stack, and capable of running in both environments if possible. JS is “natural” for frontend (ecosystem, familiarity), but you want to reuse Lua for backend consistency.
	•	Constraints and Opportunities:
	◦	Backend (Go + Lua): Lua is already embedded for workflows, making it efficient for server-side event processing (e.g., handling dispatched actions securely). Go’s concurrency shines for scaling AI integrations or data ops.
	◦	Frontend (Next.js): JS/TS is native here. Drag-drop editors (e.g., using libraries like react-dnd or Craft.js) are JS-centric. Adding Lua to the browser would require extras like WebAssembly (via Lua wasm ports) or JS transpilers (e.g., lua2js), adding complexity and potential performance hits.
	◦	Low-Code Context: Users expect visual tools over raw code, but scripting allows advanced customization. Security is key—user scripts shouldn’t expose vulnerabilities (e.g., sandbox them).
	◦	AI Integration: As an AI app builder, scripts might call AI APIs (e.g., for content generation), which are best handled server-side to protect keys and handle rate limits.
	◦	Cross-Environment Needs: Events/actions often start client-side but need server processing (e.g., form submit → backend validation → UI update). A unified language reduces context-switching, but hybrid is common in practice.
	•	Potential Challenges:
	◦	Consistency: Using different languages (JS front, Lua back) could confuse users if they need to write scripts for both.
	◦	Performance/Security: Client-side scripting (JS) is responsive but risky (e.g., exposes logic). Server-side (Lua) is secure but adds latency.
	◦	Ecosystem: JS has vast libs for UI (e.g., lodash for manipulation, Redux for reducers). Lua is simpler but lacks UI-specific tools; you’d need to extend it.
	◦	Embedding: If unifying, embedding JS in Go (via goja or otto) or Lua in JS (via fengari) is feasible but increases bundle size/maintenance.
Step 2: Evaluating Options
	1	All-JS Approach:
	◦	Embed a JS VM in Go (e.g., goja for ECMAScript support) to run user scripts on backend.
	◦	Pros: Unified language—users write JS for UI reducers/manipulation (client-side) and event processing (server-side). Rich ecosystem (e.g., use JSONata or jq-like for data manipulation). Natural for Next.js; easy debugging.
	◦	Cons: Adds dependency to Go (though goja is pure Go, no CGO). Lua is already embedded—replacing it for workflows might disrupt existing code. JS can be heavier than Lua for simple scripts.
	2	All-Lua Approach:
	◦	Embed Lua in frontend via JS (e.g., fengari Lua interpreter in JS, or compile Lua to JS/Wasm).
	◦	Pros: Reuses your Lua workflow engine. Lightweight for backend processing. Consistent for users defining cross-environment logic.
	◦	Cons: Lua isn’t browser-native; embedding adds overhead (e.g., fengari is ~200KB gzipped but slower than native JS). UI devs prefer JS; Lua lacks modern UI libs (you’d build wrappers). Harder for low-code users unfamiliar with Lua.
	3	Hybrid Approach (JS Frontend, Lua Backend):
	◦	JS for client-side UI scripting; Lua for server-side event/action processing.
	◦	Pros: Plays to strengths—JS for reactive UI, Lua for efficient backend workflows. Minimal new embeddings needed. Easy to bridge via APIs (e.g., dispatch events to backend via WebSockets or API calls).
	◦	Cons: Users might need to learn both if scripts span environments. Requires clear separation in the visual editor (e.g., “client script” vs. “server action”).
Based on your description (leveraging Lua for backend while JS feels natural for UI), the hybrid approach aligns best—it’s pragmatic, avoids over-engineering, and scales with your current stack.
Step 3: Recommended Design
Hybrid Scripting with JS on Frontend and Lua on Backend, Bridged by a Dispatcher.
	•	Overall Architecture:
	◦	Frontend (Next.js Visual Editor and Built Apps):
	▪	Use JS/TS for all client-side scripting: UI component manipulation, reducers (e.g., via Redux or Zustand wrappers), and local event handling.
	▪	In the visual editor, provide a code editor pane (e.g., Monaco Editor) for users to write JS snippets for events/actions that stay client-side (e.g., function reducer(state, action) { ... } for state updates).
	▪	For drag-drop: Extend your editor to visually define events (e.g., dropdown for “onClick”), then attach JS scripts or pre-built actions (e.g., “update component prop”).
	◦	Backend (Go + Lua):
	▪	Use embedded Lua for server-side processing: Handle dispatched events/actions, integrate with workflows (e.g., AI calls, data ops), and return results to update UI.
	▪	Expose Lua functions as “actions” in the visual editor (e.g., users select a Lua workflow to trigger on event).
	◦	Event/Action Dispatcher:
	▪	Build a central dispatcher in Go (e.g., using Gorilla WebSocket or gRPC for real-time) to route events from frontend to backend.
	▪	Client-side: Events trigger JS first (for immediate UI feedback), then dispatch to backend if needed (e.g., via fetch or Socket.io).
	▪	Server-side: Lua scripts process the payload (e.g., manipulate data, call AI), then push updates back (e.g., via pub/sub like Redis).
	▪	Security: Sandbox Lua (gopher-lua allows env restrictions) and validate JS inputs server-side.
	•	Scripting Specifics:
	◦	UI Processing/Reducers/Manipulation: Pure JS on frontend. Provide helpers like a “component API” (e.g., manipulateComponent(id, { style: { color: 'red' } })) to abstract React updates. For reducers, offer templates (e.g., auto-generate boilerplate for state management).
	◦	Backend Capabilities: Lua handles heavy lifting. For example, a user-defined Lua script could process an event payload: function process_event(data) -- manipulate data, call AI, return updated schema end. Integrate with Go for DB/AI access.
	◦	Unification for Users: In the visual editor, hide the language split—use visual blocks (like Node-RED style) that compile to JS or Lua under the hood. Advanced users can edit raw scripts.
	•	Implementation Tips:
	◦	Tools/Libs:
	▪	Frontend: React Hook Form for data binding, Redux Toolkit for reducers, react-monaco-editor for script editing.
	▪	Backend: Gopher-lua for embedding, Gin or Echo for API, NATS or Redis for dispatching.
	▪	Data Schema: Use JSON Schema for consistency between JS/Lua (both handle JSON well).
	◦	Workflow Example:
	1	User drags a button in editor, defines “onClick” event.
	2	Visual options: “Run JS script” (client-side UI update) or “Dispatch to action” (send to backend Lua workflow).
	3	On dispatch: Frontend JS serializes event → Go receives → Lua processes → Response updates UI via state.
	◦	Testing/Security: Unit test JS with Jest, Lua with busted. Sandbox scripts (e.g., no file I/O in Lua).
	◦	Scalability: Go handles concurrency; Lua is fast for scripts. For AI, integrate via Go services (e.g., call OpenAI API from Lua-wrapped functions).
	◦	Migration Path: Start hybrid, monitor user feedback—if unification needed, embed goja for JS in backend later.
	•	Trade-Offs:
	◦	Pros: Leverages existing Lua, keeps frontend natural with JS, minimizes new tech debt. Responsive UI (client JS) + secure processing (server Lua).
	◦	Cons: Slight learning curve if users mix environments, but visual editor mitigates this. Latency for server dispatches—optimize with optimistic UI updates.
	◦	Alternatives if Needed: If full unification is priority, go all-JS (embed goja in Go)—it’s viable but duplicates your Lua effort. Avoid all-Lua unless browser perf isn’t a concern.
This design keeps your platform flexible and user-focused while building on your strengths. If you provide more details (e.g., specific AI features or user personas), I can refine it further.

### Prompts for design

Refer to consideration at #file:PageBuilder.md we choose hybrid scripting, i.e., use javascript at visual page editor to create action, dispatch and reducer. Now add design sections to #file:PageBuilder.md 
1. current design allows user 
  a. visual edit single page,
  b. organise pages to tree structure, c. design data source and queries against the data sources
  d. schema of query result data or some predefined schema or custom schema, or so called colors in goflow
  e. trigger workflow engine at backend, referred in system setting `flowServiceUrl`
  focus on explaining visual editor of pages, but also brief how it interact with other parts
2. incremental design to support 
  a. rely on (prefer sandbox reinforced) javascript embedded
  b. define standarded interface to be followed by all components in component library, especially new featuer about how to define events exposed to Visual page editor, e.g., a button's onClick event would be mapped to the component's onClick or better practice to map from native javascript event to component event that the visual page editor can customise the script up on the event is emitted.
  c. the event script should follow certain standard of create action, dispatch and reducer and expose the script editor to customise the pattern, e.g., where is good place to edit the reducer script? is it exposed at page level or?

# Design

## 1. Current Design Overview

The GoFlow platform provides a comprehensive low-code development environment with the following key capabilities:

### 1.1 Visual Page Editor
The visual page editor serves as the primary interface for building interactive applications through drag-and-drop components:

- **Component Library**: Extensive collection of pre-built React components (buttons, forms, tables, charts, etc.) that users can drag onto the canvas
- **Property Panel**: Real-time configuration of component properties, styling, and layout through a visual interface
- **Canvas Workspace**: WYSIWYG editing environment with responsive design previews and nested component support
- **State Management**: Visual binding of component properties to data sources and application state
- **Live Preview**: Real-time preview of the application as it's being built

### 1.2 Page Organization & Structure
- **Hierarchical Page Tree**: Users can organize multiple pages in a tree structure, enabling complex multi-page applications
- **Navigation Management**: Visual definition of page routing and navigation flows between pages
- **Shared Components**: Reusable components across multiple pages with centralized updates
- **Page Templates**: Pre-built page layouts and patterns for common use cases

### 1.3 Data Source Integration
- **Data Source Designer**: Visual interface for connecting to various data sources (APIs, databases, files)
- **Query Builder**: Visual query construction with support for REST, GraphQL, and SQL queries
- **Data Binding**: Direct binding of UI components to data sources with automatic refresh capabilities
- **Query Management**: Centralized query storage and reuse across multiple components and pages

### 1.4 Schema Management (Colors)
- **Schema Definition**: Visual schema editor for defining data structures and validation rules
- **Pre-defined Schemas**: Library of common data schemas for typical business use cases
- **Custom Schemas**: User-defined schemas with support for complex nested structures and relationships
- **Schema Validation**: Automatic validation of data against defined schemas with error reporting
- **Type Safety**: Strong typing support for better development experience and runtime safety

### 1.5 Workflow Engine Integration
- **Backend Workflow Triggers**: Components can trigger server-side Lua workflows via the `flowServiceUrl` system setting
- **Event-Driven Processing**: Seamless integration between frontend events and backend workflow execution
- **AI Integration**: Workflows can leverage AI services for intelligent data processing and automation
- **Async Operations**: Support for long-running backend processes with status tracking and notifications

### 1.6 Component Registration System
- **vComponents Architecture**: All components organized in `vComponents/` directory with standardized structure
- **Central Registry**: Components registered in `vComponents/registry.ts` for automatic discovery by PageBuilder
- **Category-Based Organization**: Components grouped by categories (form, navigation, data, workflow, etc.)
- **Template-Driven Rendering**: Each component includes template definition for initial PageBuilder rendering
- **Interface Definitions**: Components expose events and actions through standardized interfaces

#### Component Directory Structure
```
vComponents/
├── registry.ts              # Central component registration
├── ComponentName/           # Each component in its own directory
│   ├── index.ts            # Main export file
│   ├── ComponentName.tsx   # Core React component
│   ├── PageBuilderComponentName.tsx  # PageBuilder wrapper
│   └── property-config.tsx # Property panel configuration
```

#### Registry Configuration
```typescript
// vComponents/registry.ts
export const componentRegistry: Record<string, ComponentRegistration[]> = {
  form: [/* form components */],
  navigation: [/* navigation components */],
  data: [/* data components */],
  workflow: [/* workflow components */]
}
```

#### Adding New Components
1. **Create Component Directory**: `vComponents/NewComponent/`
2. **Implement Core Component**: `NewComponent.tsx` with React implementation
3. **Create PageBuilder Wrapper**: `PageBuilderNewComponent.tsx` for editor integration
4. **Register in Registry**: Add to appropriate category in `componentRegistry`
5. **Define Template**: Specify initial rendering template with attributes and styles

#### Creating New Categories
To add a new component category:
1. **Add to Registry**: Create new category key in `componentRegistry`
2. **Import Icon**: Import appropriate Lucide icon for category
3. **Register Components**: Add component entries with `category` matching the new category name
4. **Auto-Discovery**: ComponentsTab automatically discovers and displays new categories

### Platform Interactions
The visual editor orchestrates these components through:
- **Unified State Management**: Centralized application state that connects pages, data sources, and workflows
- **Event System**: Comprehensive event handling that bridges frontend interactions with backend processing
- **Real-time Updates**: Live synchronization between editor changes and preview updates
- **Version Control**: Built-in versioning for pages, schemas, and configurations

## 2. Incremental Design for Enhanced Scripting

### 2.1 Sandboxed JavaScript Integration

#### JavaScript Runtime Environment
- **Embedded JavaScript Engine**: Integrate a secure JavaScript runtime (e.g., QuickJS or V8 isolate) within the visual editor
- **Sandbox Security**: Implement strict sandboxing with:
  - Limited global object access (no DOM manipulation outside component scope)
  - Restricted module imports (whitelist approach)
  - Memory and execution time limits
  - No file system or network access from user scripts
- **API Surface**: Provide curated APIs for safe component manipulation and data access

#### Script Execution Context
```javascript
// Sandboxed context provides:
const context = {
  // Component manipulation APIs
  component: {
    getProps: () => {},
    setProps: (props) => {},
    emit: (event, payload) => {}
  },
  // Data access APIs
  data: {
    query: (queryId) => {},
    mutate: (mutation) => {},
    subscribe: (callback) => {}
  },
  // Utility functions
  utils: {
    formatDate: (date) => {},
    validateSchema: (data, schema) => {},
    log: (message) => {} // Safe logging
  }
}
```

### 2.2 Standardized Component Interface

#### Component Event Contract
All components in the component library must implement a standardized interface for event exposure:

```typescript
interface ComponentEventInterface {
  // Standard lifecycle events
  onMount?: () => void;
  onUnmount?: () => void;
  onUpdate?: (prevProps: any) => void;
  
  // Interactive events (component-specific)
  events: {
    [eventName: string]: {
      description: string;
      payload: JSONSchema; // Schema for event payload
      preventDefault?: boolean;
      stopPropagation?: boolean;
    }
  };
  
  // Actions that can be called on the component
  actions: {
    [actionName: string]: {
      description: string;
      parameters: JSONSchema;
      returnType?: JSONSchema;
    }
  };
}
```

#### Event Mapping Strategy
- **Native Event Abstraction**: Map native DOM events or React events to semantic component events
- **Event Standardization**: Consistent event naming across all components (e.g., `onValueChange` instead of `onChange`)
- **Payload Normalization**: Standardized event payload structure for predictable script handling

#### Example Implementation
```typescript
// Button Component Event Interface
const ButtonEvents = {
  events: {
    onClick: {
      description: "Fired when button is clicked",
      payload: {
        type: "object",
        properties: {
          timestamp: { type: "number" },
          modifierKeys: { 
            type: "object",
            properties: {
              ctrl: { type: "boolean" },
              shift: { type: "boolean" },
              alt: { type: "boolean" }
            }
          }
        }
      }
    }
  },
  actions: {
    setLoading: {
      description: "Set button loading state",
      parameters: {
        type: "object",
        properties: {
          loading: { type: "boolean" }
        }
      }
    }
  }
}
```

### 2.3 Action-Dispatch-Reducer Pattern

#### Standardized Event Script Pattern
User event scripts must follow a consistent pattern based on the action-dispatch-reducer model:

```javascript
// Standard event script template
function handleEvent(eventPayload, context) {
  // 1. Create Action
  const action = createAction('ACTION_TYPE', {
    // action payload
    data: eventPayload,
    timestamp: Date.now()
  });
  
  // 2. Dispatch Action
  dispatch(action);
  
  // 3. Optional: Return immediate UI updates
  return {
    componentUpdates: {
      [componentId]: { loading: true }
    }
  };
}
```

#### Script Editor Placement & Organization

**Page-Level State Management**
- **Page Reducer**: Central reducer for page-wide state management
- **Location**: Page properties panel → "Scripts" tab → "State Management" section
- **Scope**: Handles actions from all components on the page

**Component-Level Event Scripts**
- **Event Handlers**: Individual scripts for specific component events
- **Location**: Component properties panel → "Events" tab → Select event → "Custom Script"
- **Scope**: Component-specific event handling with access to page state

**Global State Scripts**
- **Application Reducer**: Cross-page state management
- **Location**: Project settings → "Global Scripts" → "Application State"
- **Scope**: Shared state across all pages in the application

#### Script Editor Interface
```
┌─ Component Properties Panel ─────────────┐
│ ┌─ Events Tab ───────────────────────────┐│
│ │ Event: onClick                         ││
│ │ ┌─────────────────────────────────────┐││
│ │ │ Script Type:                        │││
│ │ │ ○ Quick Action (visual builder)     │││
│ │ │ ● Custom Script (code editor)       │││
│ │ └─────────────────────────────────────┘││
│ │                                       ││
│ │ ┌─ Script Editor (Monaco) ────────────┐││
│ │ │ function handleClick(event, ctx) {  │││
│ │ │   const action = createAction(      │││
│ │ │     'BUTTON_CLICKED',              │││
│ │ │     { buttonId: ctx.component.id }  │││
│ │ │   );                               │││
│ │ │   dispatch(action);                 │││
│ │ │ }                                  │││
│ │ └─────────────────────────────────────┘││
│ │                                       ││
│ │ [Test Script] [Save] [Cancel]         ││
│ └───────────────────────────────────────┘│
└───────────────────────────────────────────┘

┌─ Page Properties Panel ──────────────────┐
│ ┌─ Scripts Tab ───────────────────────────┐│
│ │ ┌─ State Management ─────────────────────┐││
│ │ │ ┌─ Page Reducer ──────────────────────┐│││
│ │ │ │ function pageReducer(state, action)││││
│ │ │ │   switch(action.type) {           │││││
│ │ │ │     case 'BUTTON_CLICKED':        │││││
│ │ │ │       return { ...state,          │││││
│ │ │ │         clickCount: state.count+1 │││││
│ │ │ │       };                          │││││
│ │ │ │     default:                      │││││
│ │ │ │       return state;               │││││
│ │ │ │   }                               │││││
│ │ │ │ }                                 │││││
│ │ │ └───────────────────────────────────┘│││
│ │ └─────────────────────────────────────────┘││
│ │                                       ││
│ │ ┌─ Initial State ─────────────────────┐││
│ │ │ {                                   │││
│ │ │   "clickCount": 0,                  │││
│ │ │   "loading": false                  │││
│ │ │ }                                   │││
│ │ └─────────────────────────────────────┘││
│ └───────────────────────────────────────┘│
└───────────────────────────────────────────┘
```

#### Integration Points
- **Visual Action Builder**: Drag-and-drop action creation for common patterns
- **Script Templates**: Pre-built templates for common event handling scenarios
- **Debugging Tools**: Built-in debugger with step-through execution and state inspection
- **Type Safety**: TypeScript support with auto-completion and error checking
- **Testing Framework**: Unit testing capabilities for custom scripts within the editor

# Execution Plan

## Epic 1: Component Interface Standardization

### Story 1.1: Define Component Event Contract
- **Description**: Establish standardized TypeScript interfaces for component events and actions
- **Acceptance Criteria**:
  - Create `ComponentEventInterface` TypeScript definition
  - Define event payload JSON schemas
  - Implement action parameter schemas
  - Create example implementations for 3 core components (Button, Input, Table)
- **Estimation**: 3 days
- **Dependencies**: None

### Story 1.2: Update Existing Components
- **Description**: Retrofit existing component library with standardized event interface
- **Acceptance Criteria**:
  - Update all UI components to implement `ComponentEventInterface`
  - Map native DOM events to standardized component events
  - Normalize event payload structures
  - Ensure backward compatibility with existing implementations
- **Estimation**: 5 days
- **Dependencies**: Story 1.1

### Story 1.3: Component Registry & Discovery
- **Description**: Build component registry for dynamic discovery of events and actions
- **Acceptance Criteria**:
  - Create component metadata registry
  - Implement runtime component introspection
  - Build event/action discovery API
  - Create component documentation generator
- **Estimation**: 4 days
- **Dependencies**: Story 1.2

## Epic 2: JavaScript Sandbox Infrastructure

### Story 2.1: Sandbox Runtime Setup
- **Description**: Implement secure JavaScript execution environment
- **Acceptance Criteria**:
  - Integrate QuickJS or V8 isolate for script execution
  - Implement memory and execution time limits
  - Create restricted global object environment
  - Implement module import whitelist system
- **Estimation**: 6 days
- **Dependencies**: None

### Story 2.2: Safe API Surface
- **Description**: Create curated APIs for component manipulation and data access
- **Acceptance Criteria**:
  - Implement component manipulation APIs (`getProps`, `setProps`, `emit`)
  - Create data access APIs (`query`, `mutate`, `subscribe`)
  - Build utility function library (`formatDate`, `validateSchema`, `log`)
  - Implement security validation for all API calls
- **Estimation**: 5 days
- **Dependencies**: Story 2.1

### Story 2.3: Script Context Management
- **Description**: Manage execution contexts across different script scopes
- **Acceptance Criteria**:
  - Implement component-level script contexts
  - Create page-level execution contexts
  - Build application-wide context management
  - Ensure proper context isolation and cleanup
- **Estimation**: 4 days
- **Dependencies**: Story 2.2

## Epic 3: Visual Script Editor Interface

### Story 3.1: Monaco Editor Integration
- **Description**: Integrate Monaco editor for JavaScript code editing
- **Acceptance Criteria**:
  - Embed Monaco editor in component properties panel
  - Configure JavaScript/TypeScript syntax highlighting
  - Implement auto-completion for sandbox APIs
  - Add error highlighting and validation
- **Estimation**: 3 days
- **Dependencies**: Story 2.2

### Story 3.2: Script Editor UI Components
- **Description**: Build UI components for script editing workflow
- **Acceptance Criteria**:
  - Create event selection dropdown interface
  - Build script type selector (Quick Action vs Custom Script)
  - Implement script testing interface
  - Add save/cancel/preview functionality
- **Estimation**: 4 days
- **Dependencies**: Story 3.1

### Story 3.3: Visual Action Builder
- **Description**: Create drag-and-drop interface for common script patterns
- **Acceptance Criteria**:
  - Build visual blocks for common actions (set state, call API, navigate)
  - Implement block-to-code compilation
  - Create template library for common patterns
  - Allow switching between visual and code modes
- **Estimation**: 6 days
- **Dependencies**: Story 3.2

## Epic 4: State Management System

### Story 4.1: Action-Dispatch-Reducer Implementation
- **Description**: Implement standardized action-dispatch-reducer pattern
- **Acceptance Criteria**:
  - Create action creation utilities (`createAction`)
  - Implement dispatch mechanism with middleware support
  - Build reducer composition system
  - Add state change notifications and subscriptions
- **Estimation**: 5 days
- **Dependencies**: Story 2.3

### Story 4.2: Multi-Level State Management
- **Description**: Implement component, page, and application level state
- **Acceptance Criteria**:
  - Component-level state management
  - Page-level state with cross-component communication
  - Application-wide global state management
  - State persistence and hydration
- **Estimation**: 6 days
- **Dependencies**: Story 4.1

### Story 4.3: State Debugging Tools
- **Description**: Build debugging interface for state inspection
- **Acceptance Criteria**:
  - Real-time state inspector panel
  - Action history and replay functionality
  - State diff visualization
  - Time-travel debugging capabilities
- **Estimation**: 4 days
- **Dependencies**: Story 4.2

## Epic 5: Integration & Testing

### Story 5.1: Workflow Engine Integration
- **Description**: Connect JavaScript events to backend Lua workflows
- **Acceptance Criteria**:
  - Implement event dispatching to `flowServiceUrl`
  - Handle async workflow responses
  - Add error handling and retry logic
  - Create workflow trigger action templates
- **Estimation**: 5 days
- **Dependencies**: Story 4.2

### Story 5.2: Data Source Binding
- **Description**: Enable JavaScript scripts to interact with data sources
- **Acceptance Criteria**:
  - Connect scripts to existing query system
  - Implement reactive data updates
  - Add data mutation capabilities
  - Create data validation and error handling
- **Estimation**: 4 days
- **Dependencies**: Story 5.1

### Story 5.3: Performance Optimization
- **Description**: Optimize script execution performance
- **Acceptance Criteria**:
  - Implement script caching and compilation optimization
  - Add performance monitoring and metrics
  - Optimize sandbox startup time
  - Implement script bundling for production
- **Estimation**: 3 days
- **Dependencies**: Story 5.2

## Test Plan

### Unit Testing Strategy

#### Component Interface Testing
- **Test Coverage**: Component event contract compliance
- **Test Cases**:
  - Verify all components implement `ComponentEventInterface`
  - Validate event payload schemas
  - Test action parameter validation
  - Ensure event normalization works correctly
- **Tools**: Jest, React Testing Library
- **Automation**: CI/CD pipeline integration

#### JavaScript Sandbox Testing
- **Test Coverage**: Security and isolation verification
- **Test Cases**:
  - Verify sandbox security restrictions (no DOM access, file system, network)
  - Test memory and execution time limits
  - Validate API surface security
  - Test context isolation between scripts
- **Tools**: Jest, Custom security test suite
- **Automation**: Security regression testing in CI

#### State Management Testing
- **Test Coverage**: Action-dispatch-reducer pattern
- **Test Cases**:
  - Test action creation and validation
  - Verify reducer composition and state updates
  - Test cross-component state communication
  - Validate state persistence and hydration
- **Tools**: Jest, Redux DevTools testing utilities
- **Automation**: State change snapshot testing

### Integration Testing Strategy

#### End-to-End Workflow Testing
- **Test Coverage**: Complete user workflows
- **Test Scenarios**:
  - Create component → Add event → Write script → Test execution
  - Multi-component state interaction scenarios
  - Backend workflow integration testing
  - Data source binding and updates
- **Tools**: Cypress, Playwright
- **Automation**: Nightly E2E test runs

#### Performance Testing
- **Test Coverage**: Script execution performance
- **Test Metrics**:
  - Script compilation time
  - Execution latency
  - Memory usage patterns
  - Sandbox startup time
- **Tools**: Lighthouse, Custom performance monitors
- **Automation**: Performance regression alerts

### User Acceptance Testing

#### Low-Code User Testing
- **Test Coverage**: Usability for non-technical users
- **Test Scenarios**:
  - Visual script creation without code knowledge
  - Error handling and user feedback
  - Learning curve and documentation effectiveness
  - Common workflow completion rates
- **Method**: User studies, A/B testing
- **Success Criteria**: 80% task completion rate for target user personas

#### Developer User Testing
- **Test Coverage**: Advanced scripting capabilities
- **Test Scenarios**:
  - Custom JavaScript development workflow
  - Debugging tool effectiveness
  - Performance optimization capabilities
  - Integration with existing development tools
- **Method**: Developer interviews, Beta testing program
- **Success Criteria**: Developer satisfaction scores > 4/5

### Security Testing

#### Sandbox Security Validation
- **Test Coverage**: Script isolation and security
- **Test Cases**:
  - Attempt unauthorized API access
  - Test for script injection vulnerabilities
  - Validate input sanitization
  - Cross-script contamination prevention
- **Tools**: Custom security testing framework
- **Automation**: Security scanning in deployment pipeline

#### Data Security Testing
- **Test Coverage**: User data protection
- **Test Cases**:
  - Script access to sensitive data
  - Data leak prevention between users
  - Audit logging for script actions
  - Compliance with data protection regulations
- **Tools**: Security audit tools, Penetration testing
- **Automation**: Continuous security monitoring

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-4)
- Epic 1: Component Interface Standardization
- Epic 2: JavaScript Sandbox Infrastructure
- **Milestone**: Secure JavaScript execution environment ready

### Phase 2: Editor & UI (Weeks 5-8)
- Epic 3: Visual Script Editor Interface
- Epic 4: State Management System (partial)
- **Milestone**: Basic script editing capabilities available

### Phase 3: Integration (Weeks 9-12)
- Epic 4: State Management System (completion)
- Epic 5: Integration & Testing
- **Milestone**: Full feature integration with existing platform

### Phase 4: Optimization & Launch (Weeks 13-16)
- Performance optimization
- Security hardening
- User acceptance testing
- Documentation and training materials
- **Milestone**: Production-ready release

## Success Metrics

### Technical Metrics
- **Script Execution Performance**: < 50ms average execution time
- **Sandbox Security**: Zero successful sandbox escapes
- **Component Coverage**: 100% of UI components support event interface
- **API Compatibility**: Zero breaking changes to existing components

### User Experience Metrics
- **User Task Completion**: 80% success rate for common workflows
- **Learning Curve**: New users productive within 2 hours
- **Error Recovery**: 90% of script errors provide actionable feedback
- **Developer Adoption**: 75% of advanced users utilize custom scripting

### Business Metrics
- **Platform Adoption**: 25% increase in active users
- **Feature Usage**: 60% of applications use custom scripting
- **Development Speed**: 40% reduction in simple workflow development time
- **User Retention**: Maintain 95% user retention rate post-launch