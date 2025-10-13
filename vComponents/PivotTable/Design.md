### Prompts

make a design to use tanstack and shadcn to support server side data query:
1. default base query to fetch data from server
2. allow to define advanced filter, and server side filtering/sorting to support advanced filter based on combination of constraints
3. allow to define an array of group fields, and server side group by these group fields
4. server side expand query that can return the data based on existing sorting/filtering while the current expanding group columns determine the subset of data to return
5. allow to define an array of pivot fields.
6. server side pivot so that results from steps 1-4 would go through pivot fields and determine how to aggregate
7. allow to define aggregation fields, these fields should be aggregated based on group fields and pivot fields's definition
8. allow to define selective aggregation paths so that only a subset of group fields would be considered to group data
9. allow to define non-aggregated fields, which would only be queried and displayed when expanding group fields to the end and no pivot field is defined.

### Architecture Overview

To implement server-side data querying with TanStack (specifically TanStack Table v8 for table management and TanStack Query v5 for data fetching) and shadcn/ui (for UI components like Data Table), we'll design a system where the frontend controls the UI state (e.g., filters, sorts, groups, pivots) but delegates all data processing to the server. This ensures efficient handling of large datasets without client-side overhead.

Key principles:
- **Server-Side Everything**: Filtering, sorting, grouping, pivoting, and aggregation happen on the server (e.g., via SQL, MongoDB, or a custom query engine). The frontend sends query parameters in API requests.
- **State Management**: Use TanStack Table's state (e.g., `columnFilters`, `sorting`, `grouping`) to drive API params. Extend it with custom states for pivots, aggregations, and selective paths.
- **Fetching**: TanStack Query handles caching, optimistic updates, and refetching on state changes.
- **UI Integration**: Wrap TanStack Table in shadcn's `<DataTable>` component, adding custom toolbars for filters, groups, pivots, etc.
- **Expandability**: For grouped/expandable rows, use server-side "expand" queries to fetch sub-data on demand.
- **Assumptions**: Backend API endpoint (e.g., `/api/data`) accepts a JSON payload with query params and returns structured data (e.g., rows, aggregates, metadata).

The design supports all 9 requirements by composing query params progressively.

### Frontend Components

1. **DataTable Component (using shadcn/ui and TanStack Table)**:
   - Extend shadcn's DataTable to include custom props for groups, pivots, aggregations.
   - Use `useTable` from `@tanstack/react-table` with manual modes enabled:
     - `manualFiltering: true`
     - `manualSorting: true`
     - `manualGrouping: true` (but grouping is server-side; client just tracks state)
     - `manualPagination: true` (if needed, though grouping/pivoting may replace traditional pagination)
   - Custom states:
     - `groupFields: string[]` (e.g., ['category', 'subcategory'])
     - `pivotFields: string[]` (e.g., ['region'])
     - `aggregationFields: { field: string; aggregator: 'sum' | 'avg' | 'count' | etc. }[]`
     - `selectiveAggregationPaths: string[][]` (e.g., [['category'], ['category', 'subcategory']]) – subsets of groupFields for partial aggregations.
     - `nonAggregatedFields: string[]` (e.g., ['details', 'notes']) – only fetched when fully expanded and no pivots.
     - `expandedGroups: Record<string, boolean>` (tracks which group levels are expanded)
   - Toolbar: Use shadcn's `<DropdownMenu>` or `<Select>` for defining groups, pivots, aggregations via UI.

2. **Query Hook (using TanStack Query)**:
   - A custom `useServerDataQuery` hook that takes table state and composes API params.
   - Query key: Based on all states (filters, sorts, groups, pivots, etc.) for automatic refetching.
   - On expand: Trigger separate queries for sub-data.

### API Payload Structure

The frontend sends a single payload to the server for base/aggregated queries. Example JSON:

```json
{
  "baseQuery": "SELECT * FROM data_table",  // Or any base SQL/query string (requirement 1)
  "filters": [  // Array for advanced constraints (requirement 2)
    { "field": "age", "operator": ">", "value": 30 },
    { "field": "status", "operator": "in", "value": ["active", "pending"] },
    { "combination": "AND" }  // Support AND/OR nesting
  ],
  "sorting": [  // Array for multi-sort (requirement 2)
    { "field": "name", "direction": "asc" },
    { "field": "date", "direction": "desc" }
  ],
  "groupFields": ["category", "subcategory"],  // Requirement 3
  "expandPath": ["category=Electronics", "subcategory=Phones"],  // For on-demand expand (requirement 4); empty for top-level
  "pivotFields": ["region"],  // Requirement 5
  "aggregationFields": [  // Requirement 7
    { "field": "sales", "aggregator": "sum" },
    { "field": "quantity", "aggregator": "avg" }
  ],
  "selectiveAggregationPaths": [  // Requirement 8; subsets of groupFields
    ["category"],  // Aggregate only at category level
    ["category", "subcategory"]  // Aggregate at full group
  ],
  "nonAggregatedFields": ["details", "notes"],  // Requirement 9; include only if !pivotFields.length && fullyExpanded
  "limit": 100,  // Optional pagination
  "offset": 0
}
```

Server responds with:
- For grouped/pivoted: Nested structure with aggregates (e.g., { groups: [...], aggregates: { ... } })
- For expanded leaf nodes (no pivots): Raw rows including non-aggregated fields.

### Handling Each Requirement

1. **Default Base Query**:
   - Define a default `baseQuery` string or object in the API payload.
   - On initial load: Fetch with empty filters/sorts/groups/pivots.
   - TanStack Query: `useQuery({ queryKey: ['data', state], queryFn: fetchServerData })`

2. **Advanced Filter and Server-Side Filtering/Sorting**:
   - Use TanStack Table's `columnFilters` and `sorting` states.
   - Convert to API payload: Filters as nested objects with operators (e.g., >, in, like) and combinators (AND/OR).
   - Server: Translate to SQL WHERE/ORDER BY clauses.
   - UI: shadcn `<Input>` or `<Popover>` for filter inputs; support multi-constraint combos.

3. **Array of Group Fields and Server-Side Group By**:
   - Table state: `grouping: string[]`
   - API: Send `groupFields` array.
   - Server: GROUP BY clause on these fields, compute aggregates.
   - Response: Hierarchical data (e.g., tree structure for groups).

4. **Server-Side Expand Query**:
   - When user expands a group row (via TanStack Table's `getExpandedRowModel`), trigger a new query with `expandPath`.
   - `expandPath`: Array of key-value pairs representing the current group hierarchy (e.g., filter to that subset).
   - Applies existing filters/sorts to the subset.
   - Use separate TanStack Query instance per expand (queryKey includes expandPath for caching).

5. **Array of Pivot Fields**:
   - Custom state: `pivotFields: string[]`
   - API: Send array; server pivots data (e.g., crosstab in SQL).
   - Pivoting happens post-grouping/filtering.

6. **Server-Side Pivot**:
   - Server processes results from 1-4, then applies pivot.
   - For each pivot value, aggregate across groups.
   - Response: Flattened pivot table structure (e.g., columns like "sales_East", "sales_West").

7. **Aggregation Fields**:
   - Define as array of objects with field and aggregator.
   - Server: Compute SUM, AVG, etc., grouped by groupFields and pivoted by pivotFields.

8. **Selective Aggregation Paths**:
   - API: Send subsets of groupFields.
   - Server: For each path, compute aggregates at that granularity (e.g., total at 'category', sub-totals at 'category + subcategory').
   - Response: Multi-level aggregates in the hierarchy.

9. **Non-Aggregated Fields**:
   - Only include in API payload if `pivotFields.length === 0` && expandPath covers all groupFields (i.e., leaf level).
   - Server: SELECT these fields only in leaf queries.
   - UI: Display in expanded rows as additional columns.

### Implementation Sketch (React Code)

```tsx
// hooks/useServerDataQuery.ts
import { useQuery } from '@tanstack/react-query';
import { TableState } from '@tanstack/react-table';

interface QueryParams { /* Match API payload */ }

const fetchServerData = async (params: QueryParams) => {
  const res = await fetch('/api/data', { method: 'POST', body: JSON.stringify(params) });
  return res.json();
};

export const useServerDataQuery = (state: TableState, customState: { groups: string[], pivots: string[], /* etc. */ }, expandPath?: string[]) => {
  const params: QueryParams = {
    // Compose from state.columnFilters, state.sorting, customState, etc.
    filters: state.columnFilters.map(/* convert */),
    sorting: state.sorting,
    groupFields: customState.groups,
    expandPath: expandPath || [],
    // ... other fields
  };
  return useQuery({
    queryKey: ['serverData', params], // Hash params for uniqueness
    queryFn: () => fetchServerData(params),
  });
};

// components/DataTable.tsx (extends shadcn)
import { DataTable } from '@/components/ui/data-table'; // shadcn
import { useReactTable } from '@tanstack/react-table';
import { useServerDataQuery } from '../hooks/useServerDataQuery';

export const ServerDataTable = ({ columns, defaultState }) => {
  const [tableState, setTableState] = useState(defaultState);
  const [customState, setCustomState] = useState({ groups: [], pivots: [], /* etc. */ });
  const [expanded, setExpanded] = useState({});

  const { data } = useServerDataQuery(tableState, customState);

  const table = useReactTable({
    data: data?.rows || [],
    columns,
    state: { ...tableState, grouping: customState.groups, expanded },
    onStateChange: setTableState,
    onExpandedChange: setExpanded,
    manualFiltering: true,
    manualSorting: true,
    manualGrouping: true,
    getExpandedRowModel: () => { /* Trigger sub-query on expand */ },
    // ... other options
  });

  // Toolbar for defining groups/pivots/aggs via shadcn UI
  return (
    <DataTable table={table}>
      {/* Custom toolbar with Select for groups, etc. */}
    </DataTable>
  );
};
```

### Server-Side Considerations

- **Query Builder**: Use libraries like Knex.js (Node) or SQLAlchemy (Python) to dynamically build queries from payload.
- **Performance**: Index fields for groups/filters. Use window functions for selective aggs.
- **Edge Cases**: Handle empty states (fallback to base query). Validate payloads to prevent injection.
- **Scalability**: For large data, add cursors instead of offset/limit.

This design is modular, extensible, and leverages TanStack/shadcn strengths while keeping the server authoritative.