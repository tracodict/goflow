# PageBuilder Form & Dialog Design

## 1. Introduction & Goals

### 1.1 Purpose
Establish a unified, extensible architecture for dialogs and schema-driven forms (DynamicForm) within the Page Builder, enabling data-aware UI construction, consistent validation, and secure scripting augmentation.

### 1.2 Goals
| Goal | Description | Success Metric |
|------|-------------|----------------|
| Unified Dialog System | Single API for modal, modeless, drawer | >90% new overlays use system in 2 weeks |
| Schema-Aware Forms | Render JSON Schema dynamically | Form creation time reduced 50% |
| Deterministic Binding | Predictable data binding via constrained JSONPath | <2% binding resolution errors |
| High Performance | Large forms remain responsive | Validation p95 under 120ms (500 fields) |
| Safe Extensibility | Transforms & scripts sandboxed | Zero sandbox escapes in audit |
| Progressive Rollout | Phased feature gating | No Sev1 regressions during rollout |

### 1.3 Scope (In)
- Dialog lifecycle & stacking
- DynamicForm component (auto + custom-page layouts)
- JSON Schema registry & validator caching
- JSONPath-based schema bindings (value, visibility, etc.)
- Transform sandbox (input/output)
- Editor enhancements (binding panel, diagnostics)

### 1.4 Out of Scope (Initial Phases)
- Multi-step wizards
- Real-time multi-user editing
- Cross-form or cross-dialog live binding
- Full JSONPath spec (only subset)
- Server-side schema fetching pipeline

### 1.5 Non-Functional Requirements
| Category | Requirement |
|----------|-------------|
| Performance | See §5.13 targets; no main thread stalls > 50ms sustained |
| Accessibility | WCAG 2.1 AA for dialogs & form controls |
| Security | Sandbox transform exec time ≤ 25ms p95, no global leakage |
| Reliability | Dialog open/close memory no net growth after 200 cycles |
| Observability | Telemetry events for validation, dialog lifecycle |
| Maintainability | Clear module boundaries & typed public APIs |

### 1.6 Assumptions
- TypeScript baseline with existing store (Zustand or similar) available
- Consumers can add schemas via internal project build step or API
- Scripts run in established sandbox infra extendable for transforms

### 1.7 Glossary
| Term | Definition |
|------|------------|
| DynamicForm | vComponent rendering JSON Schema bound form |
| Binding | Connection between component prop/visibility and schema path |
| Transform | Script altering data entering or leaving form/binding |
| Custom-Page Layout | Form layout driven by existing Page component tree |
| Auto Mode | Renderer generates layout from schema + uiSchema |

### 1.8 Stakeholders
- Page Builder Users (designers / low-code devs)
- Core Platform Engineers
- QA / Automation Team
- Security Reviewers

### 1.9 Risks (Summary)
High-level risks enumerated with mitigations in §8.9; validated post-phase gates.

---

## 2. Data Model Extensions

### 2.1 Page Entity Extension
```ts
interface PageDefinition {
  id: string
  name: string
  type: 'standard' | 'form-page'
  // NEW: optional schema association enabling schema-bound layout usage
  schema?: {
    schemaId: string            // references stored schema registry key
    version?: string            // optional explicit version tag
    uiSchemaId?: string         // optional stored uiSchema override id
    validationMode?: 'onBlur' | 'onChange' | 'onSubmit'
    initialDataSource?: {
      type: 'static' | 'query' | 'context'
      staticJson?: any          // captured snapshot when chosen
      queryId?: string          // data source id for dynamic fetch
      contextKey?: string       // key from app or dialog context payload
      lazy?: boolean            // if true fetch/bind deferred until first access
    }
    twoWayBinding?: boolean     // phase 2; propagate edits back automatically
  }
  // existing page fields ...
  /* ...existing code... */
  metadata?: Record<string, any>
}
```

### 2.2 Component (Element) Extension
```ts
interface ComponentElement {
  id: string
  type: string                 // matches data-component-type
  props: Record<string, any>
  children?: string[]
  // NEW: schema binding metadata
  schemaBinding?: {
    enabled: boolean
    schemaId?: string          // override; default falls back to page.schema.schemaId
    jsonPath: string           // dot / limited JSONPath (user.email, items[0].name)
    bindingType: 'value' | 'options' | 'visibility' | 'validation' | 'computed'
    direction?: 'read' | 'write' | 'two-way'  // initial: read, later phases expand
    transforms?: {
      inputFnId?: string       // references saved transform script OR inline
      inputInline?: string
      outputFnId?: string
      outputInline?: string
    }
    validation?: {
      required?: boolean
      customValidatorFnId?: string
    }
    visibility?: {
      condition?: string       // expression referencing resolved data (sandboxed)
    }
    cache?: {
      strategy: 'none' | 'path' | 'ttl'
      ttlMs?: number
    }
  }
  // NEW: dialog trigger association (for trigger components)
  dialogTrigger?: {
    dialogId?: string          // fixed id or generated
    inlineConfig?: DialogConfigInput // minimal config snapshot
  }
  /* ...existing code... */
}
```

### 2.3 Dialog Model
```ts
interface DialogConfigInput {
  id?: string
  type: 'modal' | 'modeless' | 'drawer'
  content: {
    mode: 'dynamic-form' | 'page' | 'component'
    refId: string              // schemaId | pageId | component template id
    layout?: 'auto' | 'custom-page'
  }
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'
  position?: { x: number; y: number; width?: number; height?: number }
  maximizable?: boolean
  resizable?: boolean
  draggable?: boolean
  closeOnEscape?: boolean
  closeOnBackdrop?: boolean
  preventClose?: boolean
  zIndexBase?: number
  initialPayload?: any
  returnOnClose?: boolean      // if true resolve promise with { submitted:false }
  autoFocus?: boolean
  restoreFocus?: boolean
}

interface ActiveDialog extends DialogConfigInput {
  id: string
  state: {
    isOpen: boolean
    isMaximized: boolean
    isFocused: boolean
    isDirty?: boolean
  }
  data?: any                   // working data (form state or context)
  resultResolver?: (value: any) => void
  rejector?: (reason?: any) => void
}
```

### 2.4 Schema Registry Entry
```ts
interface StoredSchema {
  id: string
  version: string              // semver or timestamp
  schema: JSONSchema7
  uiSchema?: any
  meta: {
    name: string
    description?: string
    tags?: string[]
    createdAt: string
    updatedAt: string
  }
  compiled?: any               // AJV compiled validator cache key ref
}
```

### 2.5 Serialization Additions
- Page export gains top-level `schema` section when defined.
- Component node JSON includes optional `schemaBinding` and `dialogTrigger` objects.
- Dialog templates (if saved) are stored as part of a `dialogs` collection in project config.

### 2.6 Backward Compatibility Strategy
| Aspect | Handling |
|--------|----------|
| Legacy pages without schema | Load with `page.schema === undefined` |
| Missing `schemaBinding.enabled` | Assume `false` |
| Unknown bindingType | Fallback to `value` + warning |
| Old exports | Migration layer injects defaults during load |

### 2.7 JSONPath Subset Definition
- Supported tokens: identifiers `[a-zA-Z0-9_]+`, dot separators, array indices `[number]`.
- Disallowed initially: filters (`[?()]`), wildcards (`*`), recursive descent (`..`).
- Grammar (EBNF-like):
```
Path := Segment { '.' Segment }
Segment := Identifier | Identifier Index | Identifier { Index }
Identifier := /[A-Za-z_][A-Za-z0-9_]*/
Index := '[' Digit { Digit } ']'
```
- Validation performed at author time; invalid path → warning & disables binding resolution.

### 2.8 Data Resolution Flow
```
Component Render → if schemaBinding.enabled
  → resolve effectiveSchemaId (component.schemaBinding.schemaId || page.schema.schemaId)
  → fetch page/form data context
  → parse jsonPath → resolve value
  → apply input transform (if any)
  → inject into component props (per bindingType)
  → for two-way (future): register change emitter ⇒ output transform ⇒ write back
```

### 2.9 State & Store Additions (Zustand sketch)
```ts
interface PageBuilderStoreExtension {
  schemas: Record<string, StoredSchema>
  activeDialogs: Record<string, ActiveDialog>
  openDialog: (config: DialogConfigInput) => Promise<any>
  closeDialog: (id: string, result?: any) => void
  updateDialogState: (id: string, patch: Partial<ActiveDialog['state']>) => void
  registerSchema: (schema: StoredSchema) => void
  bindComponentSchema: (componentId: string, binding: ComponentElement['schemaBinding']) => void
}
```

### 2.10 Validation & Error Surfaces
- Page load: validate all `jsonPath` strings; aggregate diagnostics.
- Render: if resolution fails → component receives `bindingError` prop.
- Form submit: aggregated invalid bindings reported in dialog footer.

### 2.11 Security Considerations
- Transform scripts executed in sandbox (no `window`, whitelisted helpers only).
- Path resolution guarded against prototype pollution (no `__proto__`, `constructor`).
- Size limits: schema < 1MB, form data < 2MB (configurable).

---

## 3. Dialog System Architecture

### 3.1 Goals & Principles
- Single unified manager for all dialog types (modal, modeless, drawer) to avoid divergent code paths.
- Declarative open semantics via store action `openDialog(config)` returning a promise for result.
- Reuse existing page layout renderer for complex content (custom-page mode) to ensure consistency.
- Strict layering: (Store) → (Manager/Portal) → (Renderer) → (Content Adapters)
- Minimize re-renders: each dialog isolated; z-index & focus updates do not trigger full tree refresh.

### 3.2 Layer Overview
```
useDialogStore (Zustand)
  ├─ state: activeDialogs, zStack, focusId
  ├─ actions: openDialog, closeDialog, maximizeDialog, restoreDialog, bringToFront, updateData
  ↓
<DialogManager /> (mounted once near root)
  ├─ maps state → array
  ├─ portals each dialog into <DialogPortalLayer />
  ↓
<DialogShell /> (per dialog chrome)
  ├─ frame (titlebar, controls, resize handles, backdrop)
  ├─ passes sizing/position to <DialogContentAdapter />
  ↓
<DialogContentAdapter />
  ├─ dynamic-form → <DynamicForm />
  ├─ page → <PageRenderer pageId=... dialogContext=... />
  ├─ component → <ComponentRenderer />
```

### 3.3 Store Shape (Detailed)
```ts
interface DialogStoreState {
  dialogs: Record<string, ActiveDialog>
  zOrder: string[]                // bottom → top
  focusId?: string
  lastInteractionAt?: number
}

interface DialogStoreActions {
  openDialog: (cfg: DialogConfigInput) => Promise<any>
  closeDialog: (id: string, result?: any) => void
  forceCloseAll: () => void
  updateDialog: (id: string, patch: Partial<ActiveDialog>) => void
  maximizeDialog: (id: string) => void
  restoreDialog: (id: string) => void
  bringToFront: (id: string) => void
  setDirty: (id: string, dirty: boolean) => void
  updateDialogData: (id: string, data: any) => void
}
```

### 3.4 Lifecycle Flow
**Open:**
1. `openDialog(cfg)` normalizes config (assign id, defaults)
2. Create `ActiveDialog` with promise handlers
3. Insert id at end of `zOrder` (top)
4. Set `focusId`
5. Return promise to caller

**Interact / Focus:**
- Click on shell → `bringToFront(id)` updates `zOrder` & `focusId`

**Maximize / Restore:**
- Toggle updates shell sizing mode; store patches `state.isMaximized`
- Previous position & size cached in `ActiveDialog` for restoration

**Close:**
- If `preventClose` & dirty → emit event `onBeforeClose` (scripts may veto)
- Remove from `dialogs` and `zOrder`
- Resolve or reject promise based on user action (submit/cancel)
- Shift focus to new top (if any)

### 3.5 Positioning & Resizing (Modeless)
- Initial anchor: center of viewport or relative to triggering component bounding box.
- Persistence: optional memory of last position if reopened with same id.
- Resize handles: 8-direction handles (N, NE, E, SE, S, SW, W, NW) managed by minimal pointer events.
- Collision avoidance: clamp within viewport; when maximized ignore stored position.

### 3.6 Stacking & Z-Index Strategy
- Base layer e.g. 1000.
- Each dialog z-index = base + index in `zOrder`.
- Backdrop for modal spans max zIndex among modals only (modeless unaffected).
- Drawer variant overlays from side with reserved higher base segment (e.g. +500 offset) to ensure above modeless but below maximized modals.

### 3.7 Focus Management
- Modal: focus trap (roving tab index) implemented via focus sentinel nodes.
- Modeless: no trap; only highlight and set `aria-modal=false`.
- Return focus: store original activeElement if `restoreFocus=true`.
- Keyboard shortcuts: `Esc` (close if allowed), `Ctrl+Enter` (submit if form inside), `F11` or custom (toggle maximize).

### 3.8 Event Surfaces
| Event | Fired When | Payload |
|-------|------------|---------|
| onOpen | After mount & first paint | { id, config } |
| onBeforeClose | User intent to close | { id, reason } (return false to veto) |
| onClose | After removal | { id, result, reason } |
| onMaximize | Maximize toggled on | { id } |
| onRestore | Restored from maximized | { id } |
| onFocus | Brought to front | { id } |

### 3.9 Scripting API (context.dialog)
```ts
interface DialogScriptAPI {
  open: (cfg: DialogConfigInput, data?: any) => Promise<{ submitted: boolean; data?: any }>
  close: (id: string, result?: any) => void
  maximize: (id: string) => void
  restore: (id: string) => void
  setData: (id: string, data: any) => void
  getData: (id: string) => any
  isDirty: (id: string) => boolean
}
```

### 3.10 Dirty State & Prevent Close
- DynamicForm sets `setDirty(id,true)` on first divergence from initial snapshot.
- When closing: if dirty & `preventClose`, show confirm mini-dialog (Yes/Discard/Cancel) before final close.

### 3.11 Performance Considerations
- Use CSS transforms for position moves to avoid layout thrash.
- Memoize dialog content adapters; only re-render on data or layout change.
- Offload heavy JSON schema validation to microtask boundary (debounced) in DynamicForm.

### 3.12 Accessibility Hooks
- `role="dialog"` or `role="alertdialog"` (if critical) with `aria-labelledby` referencing title node.
- Live region for validation summary changes.
- High contrast mode variables inherited from design tokens.

### 3.13 Error Handling
- Each dialog content wrapped in error boundary; boundary offers retry & copy stack.
- Script errors surfaced in a collapsible developer panel (only in editor/preview modes).

### 3.14 Telemetry (Optional Phase)
- Emit `dialog_open`, `dialog_close`, `dialog_submit`, `dialog_error` to analytics bus.

### 3.15 Future Extensions (Deferred)
- Multi-container docking (snap dialogs to edges / grid alignment)
- Dialog tabbing (multiple forms inside a single shell)
- Context sharing channel (broadcast events among open dialogs)
- AI-assisted dialog configuration (suggestions, auto-complete)

---

## 4. DynamicForm vComponent Specification

### 4.1 Purpose
Provide a schema-driven form renderer that can operate in two modes:
1. Auto mode (JSONForms default / generated layout)
2. Custom-page mode (reuse existing Page layout tree as a visual form layout shell)

### 4.2 Component Identity
```ts
// data-component-type: 'dynamic-form'
interface DynamicFormProps {
  schemaId: string
  version?: string
  layout?: 'auto' | 'custom-page'
  pageId?: string            // required when layout==='custom-page'
  data?: any                 // initial data override (wins over page.schema.initialDataSource resolution)
  uiSchemaId?: string        // optional override of default ui schema
  validationMode?: 'onBlur' | 'onChange' | 'onSubmit'
  autoSave?: boolean
  autoSaveIntervalMs?: number // debounce window (default 800)
  readOnly?: boolean
  submitMode?: 'explicit' | 'auto' // auto submits when valid & dirty and loses focus (optional future)
  showValidationSummary?: boolean
  hideSubmitBar?: boolean
  // transformation
  inputTransformFnId?: string
  outputTransformFnId?: string
  // meta
  className?: string
  style?: React.CSSProperties
}
```

### 4.3 Internal State Model
```ts
interface DynamicFormState {
  originalData: any
  workingData: any
  dirty: boolean
  validating: boolean
  lastValidatedAt?: number
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  submission?: {
    inFlight: boolean
    lastResult?: { ok: boolean; timestamp: number; payload?: any }
  }
}

interface ValidationIssue {
  path: string
  message: string
  keyword?: string
  severity: 'error' | 'warning'
}
```

### 4.4 Lifecycle Hooks (Internal)
| Hook | Trigger | Responsibility |
|------|---------|----------------|
| useLoadSchema | mount | fetch schema + compile validator (cache) |
| useBindInitialData | schema loaded | merge initial sources (page + prop + dialog payload) |
| useDirtyTracker | data mutation | set dirty on first divergence |
| useAutoSave | data mutation & autoSave enabled | schedule save dispatch to scripting context |
| useValidation | depending on validationMode | run ajv validator, diff errors, emit events |

### 4.5 Events Emitted
| Event | Payload | Notes |
|-------|---------|-------|
| onDataChange | { data, changedPath, dirty } | every accepted change (debounced for large forms) |
| onFieldChange | { path, value, prev, schemaFragment } | granular; optional toggle in props (perf) |
| onValidation | { errors, warnings, isValid } | after each validation cycle |
| onSubmit | { data, isValid, errors } | only when user submits or auto submit condition met |
| onAutoSave | { data, timestamp } | after autoSave push |
| onReset | { revertedTo } | when form reset to originalData |
| onError | { error, phase } | schema load / validation / submit exceptions |

### 4.6 Actions API (Scripting)
```ts
DynamicFormActions = {
  getData(): any,
  setData(next: any, markDirty?: boolean): void,
  patch(path: string, value: any): void,
  validate(): { isValid: boolean; errors: ValidationIssue[] },
  submit(extraContext?: any): Promise<{ ok: boolean; data?: any; errors?: ValidationIssue[] }>,
  reset(): void,
  isDirty(): boolean,
  getFieldState(path: string): { errors: ValidationIssue[]; value: any },
  focus(path: string): void,
  exportDiff(): { added: any; removed: any; changed: Record<string, { from: any; to: any }> }
}
```

### 4.7 Rendering Modes
#### Auto Mode
- Uses JSONForms (or pluggable renderer) with provided schema & optional uiSchema.
- Custom renderers registry can be extended; fallback to default control.
- Layout optimization: virtualization threshold ( > 80 visible fields ) triggers windowing.

#### Custom-Page Mode
- Wraps `PageRenderer` in a `FormContextProvider` supplying: schema, workingData, setField(path,value), validation map.
- Components inside the page that declare `schemaBinding` with bindingType='value' automatically become controlled inputs if they opt-in via a lightweight adapter interface.
- Non-input components can still bind to visibility / options.

### 4.8 Field Adapters (Custom-Page)
```ts
interface FormFieldAdapter {
  componentType: string
  acceptsValue: boolean
  valueProp?: string           // default 'value'
  changeEvent?: string         // default 'onChange'
  mapEventToValue?: (e: any) => any
}
```
- Registry keyed by componentType; DynamicForm queries registry when wiring children.

### 4.9 Data Mutation Flow
```
User Input → Adapter onChange → setField(path,value)
  → workingData updated
  → dirty recomputed (shallow or deep strategy configurable)
  → validation (if mode onChange) OR schedule (onBlur/onSubmit)
  → emit onFieldChange → batched onDataChange
```

### 4.10 Validation Strategy
- AJV compiled per (schemaId, version) key; LRU of last N (default 10) schemas.
- Field-level quick validation: if only one path changed and sub-schema derivable, run partial validation first (optimistic), then schedule full validation.
- Warning tier: custom keyword `$severity: 'warning'` in schema.

### 4.11 Auto-Save Semantics
| Condition | Action |
|-----------|--------|
| dirty & debounce elapsed & no validation in progress | emit onAutoSave + call script `onAutoSave` handler if present |
| submit occurs during pending auto-save | flush pending save first |

### 4.12 Submission Flow
1. Force full validation
2. If invalid → emit onSubmit (isValid=false) + focus first error
3. If valid → apply output transform (if present)
4. Emit onSubmit (isValid=true)
5. If inside dialog with `returnOnClose` = true → close dialog with payload
6. Optionally reset `dirty` if `submitMode==='explicit'` & `props.resetAfterSubmit===true`

### 4.13 Transform Functions
- Input transform executed once after loading + each external setData() call.
- Output transform executed immediately before submit & auto-save.
- Both executed in sandbox: provided context = { schema, path?, value, fullData, utils }.
- Time limit (e.g. 25ms) with graceful timeout fallback.

### 4.14 Performance Considerations
- Immutable updates with structured clone or shallow patch strategy based on size heuristic.
- Large object detection ( > 200KB JSON ) → enable incremental hydration (load root paths lazily).
- Memoized selector for field slices to avoid re-render storms (Zustand or useSyncExternalStore pattern).

### 4.15 Accessibility
- Auto-generate field labels from `title` in schema falling back to path segment.
- Associate errors through `aria-describedby` referencing a per-field error id.
- Validation summary region with live announcement when new errors appear after submit.

### 4.16 Error Surfaces
| Phase | Failure Mode | Handling |
|-------|--------------|----------|
| load | schema missing | Render placeholder + onError event |
| validate | ajv exception | Fallback to generic error; continue editing |
| transform | runtime error | Log & skip transform; mark field with warning badge |
| submit | unhandled script error | Reject submit promise; keep dialog open |

### 4.17 Integration With Dialog System
- When rendered inside a dialog, receives `dialogId` via context.
- Sets dialog dirty state automatically via `setDirty`.
- On successful submit (explicit) triggers `closeDialog(dialogId, { submitted:true, data })` if configured.

### 4.18 Integration With Schema Binding (Custom-Page Mode)
- If a component inside custom-page has `schemaBinding.direction === 'write'` then its updates propagate to form workingData.
- Conflict resolution: local field edits win over external page-level scripted mutations unless explicit override API used.

### 4.19 Minimal Example (Auto Mode)
```tsx
<DynamicForm
  schemaId="user-profile"
  validationMode="onBlur"
  autoSave
  onSubmit={(p) => console.log('submit', p)}
/>
```

### 4.20 Minimal Example (Custom-Page Mode)
```tsx
<DynamicForm
  schemaId="order-schema"
  layout="custom-page"
  pageId="OrderFormLayout"
  validationMode="onChange"
  autoSave
/>
```

### 4.21 Example Script: Open, Await Result
```javascript
async function openUserEditor(context) {
  const { dialog } = context
  const result = await dialog.open({
    type: 'modal',
    content: { mode: 'dynamic-form', refId: 'user-profile', layout: 'auto' },
    size: 'lg',
    returnOnClose: true
  })
  if (result.submitted) {
    context.data.mutate('update-user', result.data)
  }
}
```

## 5. Schema Integration & Validation Layer

### 5.1 Objectives
Provide a scalable, cached, and secure pipeline from schema storage to runtime validation and component binding resolution.

### 5.2 Components
| Module | Responsibility |
|--------|----------------|
| Schema Registry | Store & retrieve JSON Schemas + metadata |
| Validator Cache | Compile AJV validators, reuse across forms |
| JSONPath Parser | Parse constrained grammar to AST |
| Resolver | Execute AST against data with guards |
| Binding Engine | Evaluate binding descriptors to produce derived values |
| Transform Sandbox | Safely run user-supplied mapping code |
| Diagnostics Aggregator | Collect and expose binding errors & warnings |

### 5.3 Schema Registry API (Proposed)
```ts
interface SchemaRegistry {
  register(schema: StoredSchema): void
  get(id: string, version?: string): StoredSchema | undefined
  list(): StoredSchemaMeta[]
  ensureValidator(id: string, version?: string): CompiledValidator
}
```

### 5.4 Validator Compilation Flow
1. Lookup schema by (id, version)
2. Hash schema content → cache key
3. If compiled exists → return
4. Else compile via AJV (configured with custom keywords) and store reference

### 5.5 JSONPath Parser (Subset)
- Simple tokenizer (IDENT, DOT, LBRACK, RBRACK, NUMBER)
- Recursive descent building PathAST: `[{ key: string; indices?: number[] }]`
- Reject forbidden tokens early (wildcards, filters)

### 5.6 Binding Resolution Pipeline
```
For each component with binding:
  if !enabled → skip
  parse / get cached AST
  resolved = resolver(ast, data)
  if transform.input → resolved = runSandbox(transform.input, resolved)
  apply per binding type:
    value → prop injection
    visibility → prop.hidden = !truthy(resolved)
    options → prop.options = resolved
    validation → enrich validation rules
    computed → store in computed props bag
```

### 5.7 Transform Sandbox
| Safeguard | Description |
|-----------|-------------|
| Timeout | Abort after N ms (configurable) |
| Frozen Globals | Provide only whitelisted helpers (e.g. date, string utils) |
| Read-Only Schema | Pass deep-frozen schema object |
| Exception Wrapping | Return error sentinel; mark binding warning |

### 5.8 Partial Validation Strategy
- If changed path confined to sub-tree and schema fragment resolvable, run fragment validator first.
- Full validator scheduled (microtask) unless fragment had no errors and strategy allows skip.

### 5.9 Caching Layers
| Cache | Key | Expiry |
|-------|-----|--------|
| Validator | hash(schema JSON) | LRU (size N) |
| Path AST | raw path string | TTL 10m or LRU |
| Transform Function | hash(source) | LRU |

### 5.10 Diagnostics Model
```ts
interface BindingDiagnostic {
  componentId: string
  path: string
  severity: 'error' | 'warning'
  message: string
  code: 'PATH_INVALID' | 'RESOLVE_FAIL' | 'TRANSFORM_ERROR' | 'VALIDATION_FAIL'
}
```

### 5.11 Telemetry Hooks
Emit events: `schema_validator_compile`, `binding_resolve`, `binding_transform`, with duration metadata for performance dashboards.

### 5.12 Error Handling Policy
| Scenario | Action |
|----------|--------|
| Missing Schema | Log warning; component in fallback state |
| Invalid Path | Diagnostic error; binding skipped |
| Transform Timeout | Diagnostic warning; skip transform |
| Validator Compile Error | Mark schema unusable; surface global warning |

### 5.13 Performance Targets
| Operation | Target | Hard Ceiling |
|-----------|--------|--------------|
| Validator compile (medium schema) | <40ms | 80ms |
| Path parse (cache miss) | <0.15ms | 0.5ms |
| Path resolve (cache hit) | <0.08ms | 0.25ms |
| Transform exec p95 | <25ms | 60ms |
| Fragment validation (<=20 fields) | <15ms | 40ms |
| Full form validation (500 fields, cached) | <120ms | 250ms |

### 5.14 Security Constraints
- Deny any prototype access in resolver.
- Deep freeze schema objects passed to sandbox.
- Forbid dynamic `eval`/`Function` in transform context.

### 5.15 Extensibility
- Future: register additional binding types via plugin interface.
- Optional remote schema fetching adapter (phase ≥8).

### 5.16 Open Items
- Decide threshold for skipping full validation after fragment success (initial: always run full).
- Evaluate adding transform memory usage limits.

---

## 6. Editor & Property Panel Changes

### 6.1 Objectives
Provide intuitive authoring tools for schema association, binding configuration, dialog trigger setup, and diagnostics without overwhelming novice users.

### 6.2 Progressive Disclosure Strategy
| Tier | Audience | Exposed Controls |
|------|----------|------------------|
| Basic | New users | Enable schema, pick schema, basic value binding |
| Intermediate | Power users | Visibility & options bindings, validation mode |
| Advanced | Expert | Transforms, computed bindings, caching, diagnostics panel |

### 6.3 Page-Level Schema Panel
Controls:
- Schema selector (dropdown + search + inline import)
- UI Schema override selector
- Validation mode selector
- Initial data source configurator (static JSON editor / query select / context key)
- Status indicators: compiled validator cached, errors count

### 6.4 Component Binding Panel
Layout sections (collapsible):
1. Binding Basics
   - Toggle (Enable Binding)
   - Binding Type select (value | visibility | options | validation | computed)
   - Path input with live validation & auto-complete tree assist
2. Advanced
   - Direction (read / write / two-way disabled initially)
   - Transforms (input/output editors or script reference pickers)
   - Cache strategy (none | path | ttl)
3. Validation (only when type=validation or value with required)
   - Required toggle
   - Custom validator function picker
4. Visibility (when type=visibility)
   - Condition expression editor (linted)

### 6.5 Dialog Trigger Panel
- Checkbox: "This component opens a dialog"
- Dialog mode (dynamic-form / page / component)
- Reference picker (schemaId/pageId/component template)
- Size & modal toggles
- Return payload toggle
- Preview open button (opens test dialog sandbox)

### 6.6 JSONPath Assist
- Inline popover triggered by focus in path field
- Tree generated from schema (first 2–3 levels expanded; lazy expand deeper)
- Click to insert path segment (appends with dot or [index])
- Invalid segments flagged immediately (red underline)

### 6.7 Diagnostics Panel
Dockable panel with tabs:
- Bindings: table (Component, Path, Status, Message)
- Transforms: execution counts, avg duration, last error
- Validation: last run time, error counts by path
Actions:
- Re-run all validations
- Export diagnostics JSON

### 6.8 Inline Badges
| Badge | Location | Meaning |
|-------|----------|---------|
| B (Binding) | Component outline corner | Component has active binding |
| V (Visibility) | Component outline | Visibility binding present |
| ⚠ | Component outline | Binding or transform warning |
| ⛔ | Component outline | Binding error / unresolved path |

### 6.9 Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Alt+B | Focus binding path field |
| Alt+S | Toggle schema panel |
| Alt+D | Open diagnostics panel |
| Alt+T | Open transform editor for selected component |

### 6.10 Transform Editor UX
- Split view: Source (monaco) / Preview (runs transform on sample data)
- Safe run button (debounced)
- Output JSON viewer; execution metrics (time, truncated output notice)
- Lint feedback (disallow new Function usage)

### 6.11 Validation Feedback
- Path field displays success (green tick) if parse + resolve example data passes
- Hover on error badge → tooltip with first diagnostic message

### 6.12 Error States Mapping
| State | Visual |
|-------|--------|
| Path Invalid | Red border + tooltip |
| Transform Timeout | Yellow badge + panel entry |
| Missing Schema | Grey disabled path field |
| Unused Binding (no consumer) | Muted badge (B) with info tooltip |

### 6.13 Performance Considerations
- Debounce path validation (150ms)
- Virtualized diagnostics table ( > 200 entries )
- Lazy-load transform editor (code-split)

### 6.14 Accessibility
- All interactive panel controls keyboard reachable
- ARIA live region announces diagnostics changes
- High contrast mode supported via CSS vars

### 6.15 Telemetry Points
- `ui_binding_created`, `ui_binding_removed`
- `ui_transform_saved`
- `ui_schema_changed`
- `ui_diagnostics_view_open`

### 6.16 Extensibility Hooks
- `registerBindingPanelSection(id, renderer)` for plugin sections
- `registerDiagnosticsTab(id, provider)` for external diagnostics sources

### 6.17 Open Items
- Consider optional warning for deeply nested (>5) paths
- Evaluate dark mode theming for transform editor separately

---

## 7. Workflows & Examples

### 7.1 Workflow A: Add Schema to Existing Page
1. Open page in editor
2. Open Schema Panel → Select schema `user-profile`
3. Validator compiles (status: cached)
4. Add DynamicForm (auto) → binds automatically to page schema
5. Save → Export contains `schema` section

### 7.2 Workflow B: Bind Component Visibility
1. Select component `PremiumBanner`
2. Enable binding, type=visibility, path=`account.plan`
3. Condition expression: `value === 'pro'`
4. Preview → toggle form field to test visibility

### 7.3 Workflow C: Dialog Form Editing
1. Add button component → open Dialog Trigger panel
2. Mode: dynamic-form, refId=`user-profile`
3. returnOnClose enabled
4. Author script awaiting dialog result
5. Submit closes dialog and updates page state

### 7.4 Workflow D: Custom-Page Form Layout
1. Create layout page `OrderFormLayout`
2. Place input components with value bindings (paths: `customer.name`, `items[0].sku` etc.)
3. Insert DynamicForm layout=custom-page referencing schema `order-schema`
4. Edits propagate through adapters

### 7.5 Workflow E: Transform Use
1. Component binding type=value path=`user.firstName`
2. Input transform: capitalize first letter
3. Output transform: trim whitespace
4. Validate transforms in editor preview pane

### 7.6 Workflow F: Diagnostics Triage
1. Open Diagnostics Panel
2. See error PATH_INVALID for `items[abc].name`
3. Click entry → focuses component binding field for correction

### 7.7 Workflow G: Partial Validation Feedback (Future Phase)
1. Change single small field
2. Fragment validation runs (<15ms)
3. Full validation deferred; no UI stall

### 7.8 Workflow H: Auto-Save Recovery
1. User edits form (dirty)
2. Auto-save triggers after idle 800ms
3. Browser closes unexpectedly
4. Reopen → last auto-saved state restored (Phase 6+)

### 7.9 Workflow I: Large Form Performance
1. Load 500-field schema test page
2. Scroll interaction remains <16ms per frame
3. Validation run stays within target (<120ms)

### 7.10 Example Binding Descriptor JSON
```json
{
  "componentId": "cmp-42",
  "schemaBinding": {
    "enabled": true,
    "jsonPath": "user.address.city",
    "bindingType": "value",
    "direction": "read"
  }
}
```

### 7.11 Example Dialog Open Script
```js
async function editOrder(context, orderId) {
  const result = await context.dialog.open({
    type: 'modal',
    content: { mode: 'dynamic-form', refId: 'order-schema', layout: 'auto' },
    size: 'lg',
    returnOnClose: true,
    initialPayload: { orderId }
  })
  if (result.submitted) context.data.mutate('update-order', result.data)
}
```

### 7.12 Error Scenario: Transform Timeout
- Transform exceeds 25ms budget
- Diagnostic warning added (TRANSFORM_ERROR: timeout)
- Fallback: original value passed through

### 7.13 JSON Export Snippet (Page With Dialog Button)
```json
{
  "page": { "id": "userPage", "schema": { "schemaId": "user-profile" } },
  "components": [
    { "id": "btn1", "type": "button", "dialogTrigger": { "inlineConfig": { "type": "modal", "content": { "mode": "dynamic-form", "refId": "user-profile" }, "size": "md" } } }
  ]
}
```

### 7.14 Edge Case Handling
| Case | Behavior |
|------|----------|
| Missing schema after import | Show global warning banner; bindings disabled |
| Path points to array root | Allowed (value= entire array) but flagged informational |
| Deep path length > 10 segments | Soft warning (performance hint) |
| Transform returns undefined | Treated as no-op; component receives undefined |
| Multiple bindings target same prop | Last declaration wins; warning emitted |

### 7.15 Script Template Library (Seeds)
- openUserEditor (basic dialog)
- editOrder (custom payload)
- quickValidateForm (force validation + report errors)
- exportDiagnostics (serialize diagnostics panel)

### 7.16 Success Metrics Evaluation Flow
1. Collect baseline (forms without system)
2. Enable Phase 2 features in staging
3. Compare form build time & error rate
4. Adjust documentation for top 3 user error patterns

### 7.17 Future Scenario: Wizard (Deferred)
Illustrative only; not part of initial execution. Multi-step container orchestrating sub-form schemas with progress state.

---

## 8. Implementation Plan & Phases

### 8.1 Guiding Principles
- Ship incremental vertical slices enabling immediate user value.
- Maintain backward compatibility at each phase with feature flags.
- Instrument performance and usage before scaling complexity (wizard, workers).

### 8.2 Phase Matrix Overview
| Phase | Deliverables | Key Risks Mitigated | Exit Criteria |
|-------|--------------|---------------------|---------------|
| 0 (Prep) | Schema registry scaffolding, feature flags | Uncontrolled scope | Registry loads & lists schemas |
| 1 | Dialog core (modal + modeless), basic open/close API | UX regressions | Open/close stable, <100ms open |
| 2 | DynamicForm (auto mode), AJV cache, submit events | Validation perf | Forms submit reliably, tests pass |
| 3 | Schema binding (value + visibility) + editor panels | Binding complexity | 90% path resolutions succeed |
| 4 | Custom-page form layout & dialog maximize/restore | Layout reuse | Complex forms render identically |
| 5 | Options & validation binding types, transforms sandbox | Security/perf | Transform time p95 < 25ms |
| 6 | Auto-save + diagnostics panel + dirty close | Data loss risk | Dirty protection verified |
| 7 | Performance tuning (virtualization) & telemetry | Scale risk | Large form benchmarks pass |
| 8 (Enh) | Deferred features (wizard, async field validation) | Controlled expansion | Feature adoption > targeted |

### 8.3 Detailed Phase Breakdown
#### Phase 0: Preparation
Tasks:
- Create `/lib/schema` module skeleton
- Introduce feature flags: `ff_dialogs`, `ff_dynamicForm`, `ff_schemaBinding`
- Add no-op dialog store returning errors if flags off
Testing: Unit tests for registry loader.

#### Phase 1: Dialog Core
Tasks:
- Implement store + `<DialogManager/>` (modal & modeless only)
- Basic chrome (title, close, drag, position persistence)
- Focus trap for modal
- `context.dialog.open/close`
Defers: maximize, drawer, preventClose.
Metrics: `dialog_open`, `dialog_close`.

#### Phase 2: DynamicForm (Auto Mode)
Tasks:
- Integrate AJV validator + LRU cache
- Implement `<DynamicForm/>` with events: onDataChange, onSubmit
- Submit & validation pipeline (full form only)
Defers: auto-save, partial validation.
QA: Fixtures: small, medium (200 fields) schema.

#### Phase 3: Schema Binding (Value + Visibility)
Tasks:
- JSONPath parser + resolver (read only)
- Component prop injection engine
- Editor: binding panel minimal (enable + path + preview)
Defers: transforms, options binding.
Validation: Snapshot tests verifying bound render output.

#### Phase 4: Custom-Page Layout & Maximize
Tasks:
- `layout="custom-page"` mode
- Form context provider + field adapter API
- Dialog maximize/restore states
- Dirty tracking (internal only)
Defers: external dirty prevention prompt.

#### Phase 5: Extended Binding Types & Transforms
Tasks:
- Add options, validation, computed binding types
- Sandbox transform execution (time guard)
- Visibility condition expressions (transform alternative)
Security Review: Ensure no global leakage.

#### Phase 6: Auto-Save & Dirty Close Protection
Tasks:
- Auto-save debounce logic
- `preventClose` flow + confirmation mini-dialog
- Diagnostics panel (bindings)
- Error/warning badges
Rollout: behind `ff_autoSave` flag.

#### Phase 7: Performance & Telemetry
Tasks:
- Field virtualization (threshold >80 controls)
- Partial validation & optimistic path
- Telemetry hooks (compile, validation, transform)
- Benchmark harness (CI job)
Targets: Achieve performance table in §5.13.

#### Phase 8: Enhancements (Optional / Stretch)
Tasks:
- Multi-step wizard scaffolding
- Async field validation hooks
- Web worker offload for slow validations
- Offline draft persistence (IndexedDB)

### 8.4 Cross-Cutting Concerns
| Concern | Strategy |
|---------|----------|
| Type Safety | Shared TypeScript types exported from `/lib/schema` & `/lib/dialog` |
| Testing | Unit (AJV cache, path parser), Integration (form submit), Visual (Playwright for dialog) |
| Docs | Update `PageBuilderTutorial.md` after Phase 3 & 6 |
| Versioning | Increment minor version each phase; mark experimental APIs with JSDoc `@experimental` |
| Error Reporting | Central hook `useReport()` used by all layers for uniform telemetry |

### 8.5 Rollback Plan
- Each phase behind feature flags; emergency rollback toggles flag off leaving prior stable features unaffected.
- Data migrations additive; storing new keys but ignoring them when flags disabled.

### 8.6 Resource & Effort Estimate (Rough)
| Phase | Dev-Days | QA-Days | Notes |
|-------|----------|---------|-------|
| 0 | 2 | 1 | Setup & flags |
| 1 | 5 | 3 | Dialog complexity (accessibility) |
| 2 | 6 | 3 | Form engine & validation |
| 3 | 5 | 3 | Binding infra |
| 4 | 6 | 3 | Custom layout bridging |
| 5 | 5 | 2 | Sandbox & transforms |
| 6 | 4 | 2 | Auto-save & diagnostics |
| 7 | 5 | 3 | Perf work + telemetry |
| 8 | 6 | 3 | Optional; adjust later |
Total (core P0–P6): ~38 dev-days.

### 8.7 Acceptance Gates Per Phase
- Gate A (Phase 1): No memory leaks opening/closing 200 dialogs sequentially.
- Gate B (Phase 2): Form submit correctness vs. snapshot baseline.
- Gate C (Phase 3): 95% binding resolution success on test suite.
- Gate D (Phase 6): Data loss simulation passes (tab close, dialog cancel path).

### 8.8 Migration & Backward Compatibility
- Loader adds defaults for absent fields (see §2.6)
- Export writer includes new fields only when feature active.
- Old exports remain importable & re-export identical except added defaults.

### 8.9 Risk Register
| Risk | Impact | Mitigation |
|------|--------|------------|
| Transform sandbox escape | High | Strict allow list + audit tests |
| Large schema perf regression | Med | Benchmarks earlier (Phase 2), virtualization (Phase 7) |
| Binding confusion for users | Med | Progressive disclosure UI (collapsed sections) |
| Dialog stacking chaos | Low | Z-order manager tests |
| Validation flicker | Low | Debounce & diff-driven render |

### 8.10 Definition of Done (Overall Feature Set)
- All phases P0–P6 complete & gated
- Documentation updated (tutorial + design docs)
- Telemetry dashboards show stable performance
- >80% adoption on test workspace components using schema binding without critical errors for 1 week

---

## 9. Executive Summary & Final Consolidation

### 9.1 Executive Summary
This document defines a phased architecture for adding dialog orchestration, schema-driven DynamicForm rendering, and JSONPath-based schema binding to the Page Builder while preserving backward compatibility and minimizing performance and security risks. Core pillars:
- Separation of Concerns: Dialog orchestration, form rendering, schema registry, binding resolution, and editor tooling are isolated modules with narrow contracts.
- Progressive Enablement: Feature flags (`ff_dialogs`, `ff_dynamicForm`, `ff_schemaBinding`, later `ff_autoSave`) gate rollout and enable controlled adoption & rollback.
- Deterministic Binding: A constrained JSONPath subset + cached parse/resolve pipeline ensures predictable, secure data access.
- Extensibility: Transforms, custom layouts, computed bindings, and future wizard flows are layered, not intrusive to base runtime.
- Performance: Caching (validator LRU, parsed paths, transform functions), virtualization, partial validation and telemetry-driven tuning meet defined SLAs.
- Security: Sandboxed transform execution, path grammar restriction, and defensive serialization prevent prototype pollution & escape.

### 9.2 Consolidated Architecture Map
| Layer | Responsibilities | Key Interfaces |
|-------|------------------|----------------|
| Schema Registry | Load, cache, list schemas, validate versions | `loadSchema(id)`, `getValidator(id)` |
| Validator Cache | Compile AJV validators, LRU eviction | `getValidator(schemaId)` |
| JSONPath Engine | Parse subset, resolve against form data | `parsePath(str)`, `resolve(path, data)` |
| Binding Engine | Evaluate component bindings (value, visibility, options, validation, computed) | `evaluateBindings(component, ctx)` |
| Dialog Store | CRUD lifecycle, stacking, focus, persistence | `open(def)`, `close(id)` |
| DynamicForm | Render form data → UI ↔ model, raise events | `<DynamicForm schemaId formId />` |
| Transform Sandbox | Safe execution of transform functions | `runTransform(fnCode, args, timeout)` |
| Editor Extensions | Binding panel, diagnostics, path assist, badges | React panels + store selectors |
| Telemetry Layer | Emit structured events + performance metrics | `emit(eventType, payload)` |

### 9.3 Key Data Contracts (Final)
- Dialog Descriptor: `{ id, type, title, mode, content: { component | formId | pageId }, size, position, modal, stateFlags, formConfig? }`
- Binding Descriptor: `{ types: { value?, visibility?, options?, validation?, computed? }, pathAST, transformMeta? }`
- Transform Meta: `{ id/hash, code, compiledFn, timeoutMs, lastDuration }`
- Form Context: `{ schemaId, dataRef, validationState, changeBuffer, dirty, bindingsIndex }`

### 9.4 Final Checklist (Build Readiness)
| Item | Status | Notes |
|------|--------|-------|
| Feature flags implemented | Pending code | Define in config module |
| Schema registry base | Pending code | Phase 0 task |
| AJV + LRU wrapper | Pending code | Phase 2 gating |
| JSONPath parser (subset) | Pending code | Start simple lexer + recursive descent |
| Dialog store + manager component | Pending code | Phase 1 |
| DynamicForm auto layout | Pending code | Phase 2 |
| Binding evaluation (value+visibility) | Pending code | Phase 3 |
| Custom layout adapter API | Pending code | Phase 4 |
| Transform sandbox | Pending code | Phase 5 |
| Diagnostics panel | Pending code | Phase 6 |
| Telemetry event schema | Pending code | Phase 7 |
| Bench harness (large form) | Pending code | Add under `/tests/perf` |

### 9.5 Open Questions & Resolutions
| Question | Status | Current Position / Action |
|----------|--------|---------------------------|
| Allow `$..` deep scan in JSONPath subset? | Rejected | Increases perf + ambiguity risk |
| Enum / options binding transform chaining? | Deferred | Single transform first; chain later |
| Worker offload for validation early? | Deferred | Only if p95 > 120ms after Phase 7 |
| External schema fetch (remote URL)? | Deferred | Require explicit import step |
| Cross-form data binding? | Open (future) | Potential after standardized global state |
| Script-defined dialogs w/ dynamic schema? | Limited | Must reference existing schemaId (Phase ≥5) |

### 9.6 Risk Closure Review
- High severity risks have explicit mitigations (sandbox escape, large schema perf) and phased validation points.
- No unmanaged high risks remain pre-implementation; only future-scope items are deferred not ignored.

### 9.7 Instrumentation & Observability Plan
Events (all structured):
- `dialog_open`, `dialog_close`, `dialog_stack_change`
- `form_submit`, `form_validate_start/end`, `form_autosave`
- `binding_resolution_error`, `binding_transform_timeout`
- `schema_validator_compile` (include duration)
- `perf_virtualization_threshold_hit`
Metrics Derived:
- Validation duration p50/p95
- Transform execution p95 (<25ms target)
- Dialog open latency (<100ms target)
- Cache hit ratios (validator, path parse)
Dashboards: Build after Phase 3; refine post Phase 6.

### 9.8 Performance Reference Targets (Reaffirmed)
| Operation | Target | Hard Fail Threshold |
|-----------|--------|---------------------|
| Dialog open (cold) | <100ms | >180ms |
| 500-field validation (cached) | <120ms | >250ms |
| Path resolution (cached AST) | <0.08ms | >0.25ms |
| Transform exec p95 | <25ms | >60ms |
| Form diff render (200 fields changed) | <90ms | >160ms |

### 9.9 Extension Points
- `registerBindingType(name, evaluatorFn)` future API.
- `registerTransformPreprocessor(fn)` for linting/analyzing transform code.
- `onDialogLifecycle(event, hook)` external plugin callbacks.
- Theming hooks for dialog chrome & field wrappers.

### 9.10 Dependency Inventory (Planned)
| Dependency | Purpose | Notes |
|-----------|---------|-------|
| ajv | JSON Schema validation | Peer or direct dep; watch bundle size |
| jsonforms (optional) | Auto form rendering | Evaluate tree-shaking footprint |
| zustand | Dialog & form stores | Already in stack? If not: small footprint |
| nanoid | IDs for dialogs/forms | Could reuse existing id util |

### 9.11 Security Considerations Recap
- Transform sandbox with explicit parameter injection only
- Disallow dynamic `new Function` outside sandbox
- JSONPath grammar prevents prototype & constructor traversal
- Validation results sanitized (no raw error stack leakage to user UI)

### 9.12 Documentation Tasks by Phase
| Phase | Doc Artifact |
|-------|--------------|
| 1 | Dialog usage quickstart |
| 2 | DynamicForm basic guide |
| 3 | Schema binding reference + JSONPath cheat sheet |
| 5 | Transform & computed binding cookbook |
| 6 | Diagnostics & troubleshooting page |
| 7 | Performance tuning FAQ |

### 9.13 Adoption KPIs
- Week 1 post Phase 3: ≥10 pages with at least one schema binding
- Week 2 post Phase 5: <3% transform errors / total transform calls
- Week 1 post Phase 6: Autosave abandonment <5%

### 9.14 Future Roadmap (Beyond Current Scope)
- Wizard / multi-step dialog support with progress persistence
- Schema-driven conditional branching (rules DSL)
- Collaborative real-time form editing
- Cross-dialog shared optimistic state layer
- AI-assisted schema field labeling & description generation

### 9.15 Exit Criteria (Program Level)
All core phases (0–6) deployed, KPIs within targets, no Sev1 incidents for 2 weeks, documentation complete, and performance benchmarks stable across three consecutive CI runs.

### 9.16 Final Notes
This plan intentionally narrows early scope to guarantee a stable core before layering advanced productivity features. Deviation should require explicit reassessment of risk & capacity.

---

## 8.x Implementation Linkage (Updated Through Current Phase)

### A. Initial Scaffold (Phase 1 Recap)
Initial scaffold files:
- `lib/feature-flags.ts` (feature gating)
- `lib/dialog/types.ts` (dialog types)
- `lib/dialog/store.ts` (zustand store implementation)
- `lib/dialog/context.tsx` (provider + hook)
- `components/dialog/DialogManager.tsx` (runtime mounting & placeholder rendering)
- `app/dialog-playground/page.tsx` (example usage, enables flag)
Implemented enhancements (Phase 1 incremental):
- Accessibility baseline: role="dialog", aria-modal for modal, labelled title id linkage
- Basic modal focus trap & initial auto-focus heuristic
- Keyboard shortcuts: Escape (close), Ctrl/Cmd+Enter (submit placeholder)
- Drag (pointer-based) via header, guarded by `draggable`
- Resize (SE handle) with min size constraints
- Store extensions: position & size mutators (`setDialogPosition`, `setDialogSize`)
- DynamicForm placeholder stub (`components/dynamic-form/DynamicFormStub.tsx`) wired for `dynamic-form` mode with change/submit simulation
- DynamicForm vComponent interface scaffold (`vComponents/DynamicForm/component-interface.ts`)
- DynamicForm property panel config (`vComponents/DynamicForm/property-config.tsx`) enabling schema/layout/readOnly attributes
- DynamicForm runtime auto renderer (`components/dynamic-form/DynamicForm.tsx`) with Ajv validation & basic field types (string, number, boolean)
- Dialog integration: dynamic-form mode now mounts runtime instead of stub; modeless form preview button in property panel

### B. Recently Completed Enhancements (Current Phase)

| Area | Capability Delivered | Key Files |
|------|----------------------|-----------|
| DynamicForm Rendering | Recursive object & array (1-level nested arrays) auto-render | `components/dynamic-form/DynamicForm.tsx` |
| Validation | Ajv compile per schema instance (strict disabled; TODO cache) | `components/dynamic-form/DynamicForm.tsx` |
| JSONPath Subset | Lightweight evaluator (dot + bracket + numeric) get/set/delete | `lib/jsonpath-lite.ts` |
| Bindings | One-way + write-back on change (when `bindings` + `model` provided) | `DynamicForm.tsx` (bindings), `openDynamicFormInDialog` initialPayload wiring |
| Event Emission | `onChange`, `onValidate`, `onSubmit` events with componentId/timestamp | `DynamicForm.tsx` |
| UI Schema | Root & nested `ui:order`, `ui:widget` (textarea) overrides | `DynamicForm.tsx` |
| Nested ui:order | Per-object reordering via `uiSchema[path]['ui:order']` | `DynamicForm.tsx` |
| Dialog Runtime | Pass bindings/model/uiSchema/initialValue into form | `DialogManager.tsx` |
| Programmatic Open | Helper to open dynamic form dialog (modal/modeless) | `lib/dialog/actions.ts` ( `openDynamicFormInDialog` ) |
| Dirty Tracking | Basic dirty flag (on first change) | `DynamicForm.tsx`, dialog store `setDirty` (future integration) |

### C. Usage Examples

Programmatically open a schema-bound form:
```ts
import { openDynamicFormInDialog } from '@/lib/dialog/actions';

await openDynamicFormInDialog({
  schemaId: 'userProfile',
  title: 'Edit Profile',
  model: profileState,
  bindings: {
    'name.first': 'profile.name.first',
    'name.last': 'profile.name.last',
    'email': 'profile.contact[0].value'
  },
  uiSchema: {
    'ui:order': ['name', 'email', 'bio'],
    name: { 'ui:order': ['last', 'first'] },
    bio: { 'ui:widget': 'textarea', rows: 4 }
  },
  initialValue: { bio: 'Short bio...' },
  type: 'modal'
});
```

DynamicForm inline (component tree):
```tsx
<DynamicForm
  schemaId="userProfile"
  model={profileState}
  bindings={{ 'email': 'profile.contact[0].value' }}
  uiSchema={{ 'ui:order': ['email', 'bio'], bio: { 'ui:widget': 'textarea', rows: 6 } }}
  onModelChange={setProfileState}
  emitEvent={(evt, payload) => console.log('form event', evt, payload)}
/>
```

### D. Event Payload Shapes (Current)
```ts
// onChange
{ timestamp: number; componentId: string; eventType: 'onChange'; path: string; value: any; fullData: any }
// onValidate
{ timestamp: number; componentId: string; eventType: 'onValidate'; valid: boolean; errors: AjvError[] | null }
// onSubmit
{ timestamp: number; componentId: string; eventType: 'onSubmit'; data: any }
```

### E. Known Limitations (Next Targets)
| Limitation | Planned Resolution |
|------------|--------------------|
| No validator caching | Introduce LRU keyed by schema JSON hash |
| No lifecycle mount/unmount events emitted | Add `useEffect` emit hooks in `DynamicForm` |
| Array-of-arrays unsupported | Depth-safe recursion with guard + UI affordances |
| No read-only visual differentiation | Add disabled style tokens + aria-disabled mapping |
| No transform layer yet | Integrate sandbox callouts after binding read/write |
| No maximize control UI | Add chrome button + store toggle + layout style |
| Lack of schema-based widget inference | Derive widget hints (format=email, etc.) |

### F. Updated Pending Items
Remaining (future phases): advanced focus restoration, maximize/restore UI, robust dirty-state enforcement (confirm on close), transform & computed binding pipeline, telemetry + diagnostics panel, lifecycle events, scriptable actions (setData/patchData dispatch surface), performance instrumentation & validator caching, enhanced accessibility annotations (aria-describedby for errors), nested array editor UX.
