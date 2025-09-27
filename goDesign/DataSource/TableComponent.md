# Table Component Detailed Design

Status: Draft v0.1

## 1. Purpose
Lightweight, data-agnostic tabular display bound to query results. Subset of Appsmith TableWidgetV2 focusing on read + selection.

## 2. Core Props
```ts
interface TableDataViewProps {
  data: any[]
  loading?: boolean
  columns?: ColumnSpec[] // optional custom schema
  pageSize?: number // default 25
  initialSort?: { field: string; direction: 'asc'|'desc' }[]
  onRowSelect?: (row: any, index: number) => void
  emptyMessage?: string
}
interface ColumnSpec {
  key: string
  label?: string
  type?: 'text'|'number'|'date'|'image'
  sortable?: boolean
  width?: number | string
  format?: (value:any,row:any)=>React.ReactNode
}
```

## 3. Derived Columns
If `columns` omitted, derive keys from union of object keys in first 20 rows; preserve insertion order; limit 20 columns.

## 4. Sorting
- Client sort when `data.length <= pageSize * 5` else warn for large dataset.
- Clicking header toggles asc -> desc -> none.
- Emits internal state; future server-sort integration will emit callback.

## 5. Pagination
- Client side: maintain `currentPage` in internal state.
- Show simple pager (Prev / Page X / Next) + page size select (25, 50, 100).

## 6. Selection
- Single row selection highlight; expose selected row via callback.

## 7. Loading & Empty
- While `loading=true` show skeleton rows (same column layout) – 5 placeholder rows.
- Empty (no rows & !loading) -> show center message.

## 8. Accessibility
- Table rendered with semantic `<table>`.
- Headers `<th scope="col">`.
- ARIA role grid only if interactive expansions added later.

## 9. Styling
- Use Tailwind tokens already in project (bg-white, border, text-xs, etc).
- Zebra rows via `odd:bg-neutral-50`.
- Hover highlight via `hover:bg-emerald-50`.

## 10. Performance
- Virtualization deferred (Phase 3) – acceptable up to ~5k cells (e.g. 200 rows * 25 cols) for initial version.

## 11. Future Enhancements
- Column reorder + resize.
- Sticky header + horizontal scroll.
- Inline cell editing (ties to mutation queries).
- Row action buttons and bulk selection.
- Server pagination & infinite scroll.

END
