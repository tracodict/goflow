# Dialog System (Phase 1 Scaffold)

This document summarizes the initial implementation of the dialog system as outlined in the design spec (PageBuilderForm.md §3 & §8).

## Current Scope
- Modal & modeless dialogs (drawer placeholder via `type='drawer'` accepted but rendered as standard shell)
- Open/close lifecycle with promise-based `open()` API
- Basic stacking & focus ordering (z-order managed by insertion order)
- Placeholder content rendering for three modes: dynamic-form, page, component
- Feature flag gating via `ff_dialogs`

## Not Yet Implemented (Planned)
- Focus trap for modal dialogs
- Accessibility attributes (aria-modal, labelledby)
- Maximize / restore UI
- Resizing, dragging (currently static positioning placeholder)
- Dirty state enforcement & prevent close
- Return payload semantics for dynamic form submit (placeholder only)

## File Map
| Path | Purpose |
|------|---------|
| `lib/feature-flags.ts` | Feature flag management API |
| `lib/dialog/types.ts` | Type definitions for configs & store |
| `lib/dialog/store.ts` | Zustand store with CRUD actions |
| `lib/dialog/context.tsx` | React provider + hook exposing API |
| `components/dialog/DialogManager.tsx` | Renders active dialogs |
| `app/dialog-playground/page.tsx` | Example usage page |

## Usage
Wrap your app (or a layout segment) with `DialogProvider` and render `DialogManager` once near root:
```tsx
<DialogProvider>
  <DialogManager />
  <App />
</DialogProvider>
```

Open a dialog:
```tsx
const dialog = useDialog();
const result = await dialog.open({
  type: 'modal',
  title: 'User Editor',
  content: { mode: 'dynamic-form', refId: 'user-profile', layout: 'auto' },
  size: 'md',
  returnOnClose: true,
});
console.log(result);
```

## API Surface (Current)
```ts
interface DialogAPI {
  open(cfg: DialogConfigInput): Promise<any>;
  close(id: string, result?: any): void;
  maximize(id: string): void; // no-op visual for now
  restore(id: string): void;  // no-op visual for now
  bringToFront(id: string): void;
  setData(id: string, data: any): void;
  getData(id: string): any;
  isDirty(id: string): boolean;
  dialogs: ActiveDialog[];
  featureEnabled: boolean;
}
```

## Feature Flags
Enable dialogs programmatically (e.g., playground or dev bootstrap):
```ts
import { setFeatureFlagOverrides } from '../lib/feature-flags';
setFeatureFlagOverrides({ ff_dialogs: true });
```

## Known Limitations
| Limitation | Planned Resolution |
|------------|--------------------|
| No keyboard focus management | Add focus trap (Phase 1 refinement) |
| No drag / resize | Implement pointer listeners (Phase 1.1) |
| No accessibility roles | Add roles + aria attributes (Phase 1.1) |
| No portal layering strategy for drawers | Drawer variant styling (Phase 4) |
| Placeholder dynamic-form rendering | Integrate real DynamicForm (Phase 2) |

## Migration Notes
Existing code can start calling `useDialog().open()` behind `ff_dialogs`; failures throw when disabled to surface early integration mistakes.

## Telemetry (Future)
Planned events: `dialog_open`, `dialog_close`, `dialog_error`, `dialog_stack_change` once telemetry bus utility is integrated.

## Next Steps
1. Add focus/keyboard management
2. Implement drag + simple resize (modal optional)
3. Integrate accessibility roles
4. Wire real DynamicForm when Phase 2 starts
5. Add test coverage (store actions & open/close promise semantics)

---

## Dynamic Form Dialogs

You can open a DynamicForm programmatically via the helper:
```ts
import { openDynamicFormInDialog } from '@/lib/dialog/actions';
await openDynamicFormInDialog({ schemaId: 'user-profile', title: 'Edit User' });
```

### DialogFormLauncher Component (Builder)

The Page Builder now includes a `FormLauncher` component that renders a clickable element and opens a dialog-hosted DynamicForm with zero custom code.

Property Panel Fields (data-* attributes):
- `data-schema-id` (required) – JSON Schema ID to load.
- `data-dialog-title` – Overrides dialog title (defaults to `Form: <schemaId>`).
- `data-dialog-width` / `data-dialog-height` – Initial size (numbers as strings).
- `data-bindings` – JSON mapping of form field paths to external JSONPath expressions.
- `data-ui-schema` – UI Schema JSON (ordering, widget hints, etc.).
- `data-initial-value` – Initial form model JSON.
- `data-onclick-script` – Optional script executed before opening; returning `{ cancel: true }` aborts opening.

Example `data-onclick-script`:
```js
// Prevent opening if user lacks permission
if (!page.getState().userCanEdit) {
  app.showNotification('You do not have edit rights', 'warning');
  return { cancel: true };
}
```

Requirements:
- Global provider: now use `<DialogRootClient>` (client component) inside the server `app/layout.tsx` instead of importing `DialogProvider` directly into a server component.
- Feature flag `ff_dialogs` enabled (set globally in layout).

Notes:
- If `ff_dialogs` is disabled, launcher logs a warning and does nothing.
- Invalid JSON in bindings/uiSchema/initialValue is ignored (fails soft).
- Width/height fallback to defaults if unparsable.
- Dialogs now reuse the same `PageBuilderDynamicForm` renderer used on pages, ensuring identical layout, scripts, and future enhancements.

### Visual Theme & Layout
Dialogs now default to a light theme using CSS variables instead of hard-coded dark colors. To customize, define (e.g. in `globals.css`):
```css
:root {
  --color-dialog-bg: #ffffff;
  --color-dialog-fg: #111827;
  --color-dialog-header-bg: #f3f4f6;
  --color-border: #e5e7eb;
}
```

Default dynamic form dialog width increased to 760px to enable multi-column responsive grid. Override per launcher with `data-dialog-width` / `data-dialog-height`.

