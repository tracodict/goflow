# JSON Schema Builder Integration & Design

## Goals

Provide an in-app, visual JSON Schema editor ("Schema Builder") to create and maintain JSON Schemas associated with a workflow's declarations ( `jsonSchemas` section in `DeclarationsPanel`). The builder should:

1. Offer a visual field-based editor (add / edit / delete / reorder properties, toggle required) powered by existing `SchemaVisualEditor`.
2. Allow raw JSON editing to remain (current CodeMirror) – users can freely switch between raw and visual modes (Phase 2).
3. Persist schema changes back into the workflow declarations (staged locally until user presses existing "Apply" / workflow save action).
4. Be non-invasive: no backend changes required initially; operates purely client-side.
5. Support future enhancements: inference from sample JSON, validation, localization, schema versioning.

## Existing Assets Reused

Component: `jsonjoy-builder/src/components/SchemaEditor/SchemaVisualEditor.tsx`

Key capabilities:
- Add / edit / remove top-level object properties
- Mark properties as required
- Works with a `JSONSchema` object in memory

Supporting types & helpers (already in library):
- `createFieldSchema`, `updateObjectProperty`, `updatePropertyRequired`
- Type definitions under `jsonjoy-builder/src/types/jsonSchema.ts`

## Scope (Phase 1)

| Feature | Status | Notes |
|---------|--------|-------|
| Visual editor modal launch from each schema row | NEW | Edit icon (square-pen) per schema card |
| Local draft editing | NEW | Draft stored in component state until Apply in modal |
| Persist into `lines.jsonSchemas[i].schema` | NEW | Replaces existing schema object |
| Keep existing raw CodeMirror JSON editor | KEEP | Allows power users to hand-edit |
| Icon-only actions (Delete / Up / Down) | CHANGE | Replace labeled buttons with lucide icons |
| Internationalization | DEFERRED | Could pass translation context later |
| Schema Inference / Validation integration | DEFERRED | Future phases; library supports inference & Ajv validation |

## UX Flow

1. User navigates to Declarations → `jsonSchemas` tab.
2. Each schema card shows: name input + icon buttons: Delete / Up / Down / Edit.
3. Clicking Edit opens modal overlay (z-index > Lua editor) containing visual builder.
4. User edits fields; changes update a local `draftSchema` state via `onChange`.
5. User clicks Apply → modal closes; underlying schema JSON is replaced; CodeMirror reflects new JSON.
6. User can optionally further refine JSON manually; must still click global "Apply" to stage declarations.

## Data Model

`lines.jsonSchemas: Array<{ name: string; schema: JSONSchema }>`

Modal state additions:
```ts
const [schemaEditorIndex, setSchemaEditorIndex] = useState<number | null>(null)
const [schemaDraft, setSchemaDraft] = useState<JSONSchema | null>(null)
```

Open modal: set both states.
Apply modal: mutate `lines.jsonSchemas[idx].schema = schemaDraft`.

## Component Contracts

SchemaVisualEditor props:
- Input: `schema: JSONSchema`
- Output: `onChange(next: JSONSchema)` – must be fully immutable (replace state object).

Success Criteria:
- Editing a property label updates underlying schema correctly (including required array consistency).
- Deleting property removes it from `properties` and `required` if present.
- Reordering properties (not supported directly in Phase 1) is out-of-scope; order is object key insertion order.

## Edge Cases & Handling

| Case | Handling |
|------|----------|
| Non-object root schema (boolean schema) | Visual editor will treat / convert to object schema if needed (library handles) |
| Empty schema `{}` | Visual editor shows empty state with add field prompt |
| Concurrent raw JSON edits while modal open | Modal edits operate on snapshot; closing with Apply overwrites; Cancel discards |
| Invalid JSON typed manually then opening visual builder | Visual builder operates on last valid object; if parse fails we keep old schema; (Phase 1: assume CodeMirror content stays valid) |

## Accessibility & Styling

Modal uses existing overlay pattern (similar to Lua editor) with scrollable interior. Icon buttons have `aria-label` attributes (Phase 1 minimal: rely on tooltip later).

## Future Enhancements (Backlog)

- Add tab switcher inside schema card: [Visual | JSON].
- Integrate schema validation using Ajv on every change (show errors inline).
- Schema inference: button to paste sample JSON and auto-generate properties.
- Version history (undo stack per schema).
- Export/import schemas as separate files.
- Global schema registry across workflows.

## Execution Plan

1. Documentation (this file) – DONE.
2. Update `DeclarationsPanel`:
	- Import icons + `SchemaVisualEditor`.
	- Add state: `schemaEditorIndex`, `schemaDraft`.
	- Replace per-schema action buttons with icon-only (trash-2, move-up, move-down) + new edit (square-pen).
	- Add modal overlay rendering `SchemaVisualEditor` when `schemaEditorIndex != null`.
3. Wire Apply button in modal to persist draft into `lines.jsonSchemas`.
4. Ensure existing JSON CodeMirror reflects updated schema (it will, since state mutated).
5. Run TypeScript checks.
6. Verify no regression to Lua editor modal stacking (use higher z-index if needed).

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Icon buttons reduce discoverability | Add tooltips in later iteration |
| SchemaVisualEditor import path brittle | Centralize export later via barrel file |
| Large schemas performance | Defer virtualization until proven issue |

## Acceptance Checklist

- [ ] Edit icon opens visual editor modal.
- [ ] Cancel closes without mutation.
- [ ] Apply persists changes & closes modal.
- [ ] Existing Delete/Up/Down actions still work via icons.
- [ ] No TypeScript errors.

---
Author: Generated design based on existing `jsonjoy-builder` assets.
Date: 2025-09-23

