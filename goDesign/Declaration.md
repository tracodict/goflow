## Declarations (Design Draft)

Purpose: Provide an in-editor panel for declaring workflow-level constructs (Color Sets, Variables, Global Refs, Lua Value Decls, Batch Ordering) similar to classic CPN tools, integrated with the existing side panel architecture. Use CodeMirror Lua Editor when code editing is required.

### Objectives
- Unified editing surface for all textual declarations.
- Low-friction create / delete / reorder.
- Immediate validation feedback (syntax + referential usage in arcs / guards).
- Diff‑friendly persistence (plain text blocks grouped by category).
- Extensible: future categories (Functions, Constants, Time, Guards Library).

### Scope (Initial)
Categories (tabs):
1. BatchOrdering (ordering / grouping meta)
2. Globref (reference variables / global references)
3. Color (user-defined color sets ONLY; built‑ins are implicit & not persisted)
4. Var (variables used in inscriptions / guards)
5. Lua (expressions / helper functions / policies)

### Non-Goals (for first pass)
- Rich multi-file module system.
- Advanced type inference UI.
- Versioning / history per declaration (global undo suffices initially).

### Data Model
Internal representation (per workflow):
```
declarations: {
	batchOrdering: string[]            // each item a raw line
	globref:       string[]
	color:         string[]            // excludes built-ins INT REAL STRING BOOL UNIT
	var:           string[]
	ml:            string[]            // multiline allowed; stored as individual logical entries
}
```
Server persistence (extension to workflow schema):
```
{
	id: string,
	...existingWorkflowFields,
	declarations?: {
		batchOrdering?: string[]
		globref?: string[]
		color?: string[]
		var?: string[]
		ml?: string[]
	}
}
```

### Actions
- Add Line (+ New)
- Delete Selected (- Delete)
- Reorder (Up / Down buttons or drag handle)  
- Inline Edit (single click)  
- Open in Lua Editor (for multi-line Lua entry)  
- Filter (client side substring, highlight matches)  
- Apply button. This will apply to in-memory workflowMeta, without saveWorkflow call. saveWorkflow will only be done when existing `save workflow` button is clicked.
- Validate by calling validation endpoint (runs syntax + semantic checks; forwards to existing toast + validation dialog if extended)  

### Validation Strategy
Client-side quick checks:
- Color: simple regex e.g. `^colset\s+\w+\s*=.*;?$`
- Var: identifier uniqueness, pattern `^[A-Za-z_]\w*$`.
- Globref: reserved keyword avoidance.
- Lua: parsed via lightweight sandbox / delegated server validation endpoint (future: `/api/cpn/decl/validate`).
On failure: show inline marker + destructive toast summarizing first N errors.

### State Integration

Most important, the `Color` defined, which are the identifiers after `^colset\s+\w+` at ColorSet definition, should be appended to built-in colors at place's context menu. The `Color` defined should also be used to render dropdown list at property panel for the place to change color of a place.

Location: augment existing `workflowMeta[wfId]` with `declarations`.  
Undo/Redo: snapshot includes `declarations` object.  
Broadcast: custom event `goflow-declarations` with minimal diff `{ kind, wfId, changes }` to allow dependent components (e.g. arc expression editors) to refresh variable / color suggestions.

### Accessibility / UX
- Keyboard: Arrow Up/Down to move selection; Shift+Up/Down to reorder; Enter to edit; Esc to cancel edit.
- Focus ring & ARIA roles for list (`role="listbox"`, items `role="option"`).
- Screen reader labels: include category + index.

### Error Surfacing
Reuse `ApiError` + `withApiErrorToast` for server-side validation errors. Compound errors collated into a single toast line separated by ` • `; clicking toast could open detailed dialog (stretch goal).

### Performance
- Virtualize list only if > 500 entries (phase 2). Initial simple map render.
- Debounced (300ms) filter.

### Merge Strategy with Existing Built-ins
- Built-in color sets remain implicit & not stored in `color` list; UI shows them via union at selection time but keeps them visually tagged (badge “built‑in”).

### UI Layout (Mermaid Mockup)
```mermaid
flowchart TD
		A[TabsB atchOrdering | Globref | Color | Var | Lua] --> B[List Area]
		B --> C[Inline Edit Row]
		B --> D[Filter Input]
		A --> E[Action Bar\n+ New | - Delete | Up | Down | Lua Editor]
		E --> B
		subgraph Panel[Declarations Panel]
			A
			E
			B
			D
		end
```

### Minimal Component Breakdown
- DeclarationsPanel (container, holds tab state, actions)
- DeclarationsList (generic list renderer, reuse across tabs)
- DeclarationRow (inline edit, status icons)
- MLModalEditor (for multi-line Lua entries)
- DeclarationsFilter (controlled input)

### Events & Props (Draft)
```
<DeclarationsPanel
	value={workflowMeta[wfid].declarations}
	onChange={(next) => updateWorkflowMeta(wfid, { declarations: next })}
	onValidate={() => validateDeclarations(wfid)}
	builtInColorSets={['INT','REAL','STRING','BOOL','UNIT']}
	disabled={loading}
/> 
```

### Save Flow
1. User edits lines (local dirty buffer per tab).  
2. On Apply or Save Workflow: merge into workflowMeta.declarations.  
3. `graphToServer` extended to attach declarations (omitting empty arrays).  
4. `saveWorkflow` transmits.

### Future Enhancements
- Quick doc hover & jump-to-usage.
- Batch import/export as text file.

### Open Questions
- Should Lua multi-line entries be collapsed to first line preview? (Probably yes.)
- Separate endpoint for declarations validation or reuse full workflow validation? (Start with reuse.)

---
