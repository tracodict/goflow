'use client'

import * as React from "react"
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MongoSSRMResponse, SSRMRequest, SortModelItem } from "@/lib/server/ssrm/mongo"

type FilterModel = Record<string, any> | null

export interface FieldDefinition {
  field: string
  label?: string
  groupable?: boolean
  pivotable?: boolean
  aggregatable?: boolean
  filterable?: boolean
  sortable?: boolean
}

export interface ValueFieldDefinition {
  field: string
  aggFunc: string
  label?: string
}

export const DEFAULT_PIVOT_TABLE_CONFIG = Object.freeze({
  database: "go_petri_flow",
  collection: "case_state",
  fieldDefinitions: [
    { field: "status", label: "Status", groupable: true, filterable: true, sortable: true },
    { field: "workflowId", label: "Workflow", groupable: true, filterable: true, sortable: true },
    { field: "mode", label: "Mode", pivotable: true, filterable: true, sortable: true },
    { field: "version", label: "Version", aggregatable: true, sortable: true },
    { field: "updatedAt", label: "Updated At", filterable: true, sortable: true },
  ] as FieldDefinition[],
  groupFields: ["status", "workflowId"],
  pivotFields: ["mode"],
  valueFields: [{ field: "version", aggFunc: "max", label: "Max Version" }] as ValueFieldDefinition[],
  nonAggregatedFields: ["caseId", "stateHash", "updatedAt"] as string[],
})

interface PivotRow extends Record<string, any> {
  __id: string
  __path: string[]
  __depth: number
  __hasChildren: boolean
  subRows?: PivotRow[]
  pivot?: Record<string, Record<string, any>>
}

export interface PivotTableProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  endpoint?: string
  database?: string
  collection?: string
  basePipeline?: Record<string, any>[]
  fieldDefinitions?: FieldDefinition[]
  defaultGroupFields?: string[]
  defaultPivotFields?: string[]
  defaultValueFields?: ValueFieldDefinition[]
  defaultFilterModel?: FilterModel
  nonAggregatedFields?: string[]
  pageSize?: number
}

const ROOT_KEY = ""
const KEY_DELIM = "||"

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString() : String(value)
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return String(value)
}

const ensureArray = <T,>(value?: T[]): T[] => (Array.isArray(value) ? value : [])

const QueryProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

export const PivotTable: React.FC<PivotTableProps> = (props) => {
  return (
    <QueryProvider>
      <PivotTableInner {...props} />
    </QueryProvider>
  )
}

const PivotTableInner: React.FC<PivotTableProps> = ({
  endpoint = "/api/ssrm",
  database = DEFAULT_PIVOT_TABLE_CONFIG.database,
  collection = DEFAULT_PIVOT_TABLE_CONFIG.collection,
  basePipeline = [],
  fieldDefinitions = DEFAULT_PIVOT_TABLE_CONFIG.fieldDefinitions,
  defaultGroupFields = DEFAULT_PIVOT_TABLE_CONFIG.groupFields,
  defaultPivotFields = DEFAULT_PIVOT_TABLE_CONFIG.pivotFields,
  defaultValueFields = DEFAULT_PIVOT_TABLE_CONFIG.valueFields,
  defaultFilterModel = null,
  nonAggregatedFields = DEFAULT_PIVOT_TABLE_CONFIG.nonAggregatedFields,
  pageSize = 200,
  className,
  style,
  ...rest
}) => {
  const queryClient = useQueryClient()
  const [groupFields] = React.useState<string[]>(() => ensureArray(defaultGroupFields))
  const [pivotFields] = React.useState<string[]>(() => ensureArray(defaultPivotFields))
  const [valueFields] = React.useState<ValueFieldDefinition[]>(() => ensureArray(defaultValueFields))
  const [filterModel] = React.useState<FilterModel>(() => defaultFilterModel)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(() => new Set())
  const [rowCache, setRowCache] = React.useState<Map<string, PivotRow[]>>(() => new Map())
  const [pivotKeys, setPivotKeys] = React.useState<string[]>([])
  const [loadingPaths, setLoadingPaths] = React.useState<Set<string>>(() => new Set())
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const pivotActive = pivotFields.length > 0

  const fieldDefinitionMap = React.useMemo(() => {
    const map = new Map<string, FieldDefinition>()
    for (const def of fieldDefinitions) {
      map.set(def.field, def)
    }
    return map
  }, [fieldDefinitions])

  const resolveSortField = React.useCallback(
    (columnId: string): string | null => {
      if (!columnId) return null
      if (columnId.startsWith("total:")) {
        return columnId.replace("total:", "")
      }
      if (columnId.startsWith("pivot:")) {
        return null
      }
      if (columnId.startsWith("detail:")) {
        return columnId.replace("detail:", "")
      }
      return columnId
    },
    [],
  )

  const buildRequest = React.useCallback(
    (groupKeys: string[]): SSRMRequest => {
      const rowGroupCols = groupFields.map((field) => ({
        id: field,
        displayName: fieldDefinitionMap.get(field)?.label ?? field,
        field,
      }))

      const valueCols = valueFields.map((value) => ({
        id: value.field,
        displayName: value.label ?? value.field,
        field: value.field,
        aggFunc: value.aggFunc,
      }))

      const pivotCols = pivotFields.map((field) => ({
        id: field,
        displayName: fieldDefinitionMap.get(field)?.label ?? field,
        field,
      }))

      const sortModel = sorting
        .map<SortModelItem | null>((sort) => {
          const colId = resolveSortField(sort.id)
          if (!colId) return null
          return { colId, sort: sort.desc ? "desc" : "asc" }
        })
        .filter((value): value is SortModelItem => value !== null)

      const request: SSRMRequest = {
        startRow: 0,
        endRow: pageSize,
        rowGroupCols,
        valueCols,
        pivotCols,
        pivotMode: pivotActive,
        groupKeys,
        filterModel,
        sortModel,
        basePipeline,
        database,
        collection,
      }

      return request
    },
    [
      groupFields,
      valueFields,
      pivotFields,
      sorting,
      resolveSortField,
      pivotActive,
      filterModel,
      basePipeline,
      database,
      collection,
      pageSize,
      fieldDefinitionMap,
    ],
  )

  const fetchSSRM = React.useCallback(
    async (groupKeys: string[]): Promise<MongoSSRMResponse> => {
      const payload = buildRequest(groupKeys)
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let message = `SSRM request failed (${response.status})`
        try {
          const error = await response.json()
          if (error?.error) {
            message = error.error
          }
        } catch {
          message = await response.text()
        }
        throw new Error(message || "Unknown SSRM error")
      }

      return response.json()
    },
    [buildRequest, endpoint],
  )

  const transformRows = React.useCallback(
    (rows: Record<string, any>[], groupKeys: string[]): PivotRow[] => {
      const depth = groupKeys.length
      const nextGroupField = groupFields[depth]

      return rows.map((row, index) => {
        const clone: PivotRow = { ...row } as PivotRow
        const path = [...groupKeys]

        if (nextGroupField) {
          const nextValue = row[nextGroupField]
          const displayValue =
            nextValue === null || nextValue === undefined || nextValue === ""
              ? `Level-${depth + 1}-${index}`
              : String(nextValue)
          path.push(displayValue)
        } else if (!pivotActive) {
          const identifier = row._id !== undefined ? String(row._id) : `row-${depth}-${index}`
          path.push(identifier)
        }

        clone.__path = path
        clone.__id = path.join(KEY_DELIM) || `root-${index}`
        clone.__depth = depth
        clone.__hasChildren = !pivotActive && depth < groupFields.length - 1
        return clone
      })
    },
    [groupFields, pivotActive],
  )

  const rootQueryKey = React.useMemo(
    () => [
      "pivot-table",
      endpoint,
      database ?? "",
      collection ?? "",
      JSON.stringify(basePipeline ?? []),
      JSON.stringify(groupFields),
      JSON.stringify(valueFields),
      JSON.stringify(pivotFields),
      JSON.stringify(filterModel ?? {}),
      JSON.stringify(sorting),
    ],
    [
      endpoint,
      database,
      collection,
      basePipeline,
      groupFields,
      valueFields,
      pivotFields,
      filterModel,
      sorting,
    ],
  )

  const rootQuery = useQuery({
    queryKey: rootQueryKey,
    queryFn: () => fetchSSRM([]),
    retry: 1,
  })

  React.useEffect(() => {
    if (rootQuery.data) {
      setRowCache(new Map([[ROOT_KEY, transformRows(rootQuery.data.rows, [])]]))
      setPivotKeys(rootQuery.data.pivotKeys ?? [])
      setExpandedPaths(new Set())
      setErrorMessage(null)
    }
  }, [rootQuery.data, transformRows])

  React.useEffect(() => {
    if (rootQuery.error) {
      const message =
        rootQuery.error instanceof Error ? rootQuery.error.message : "Unknown SSRM error"
      setErrorMessage(message)
    }
  }, [rootQuery.error])

  const loadPath = React.useCallback(
    async (groupKeys: string[], rowId: string) => {
      setLoadingPaths((prev) => {
        const next = new Set(prev)
        next.add(rowId)
        return next
      })

      try {
        const data = await queryClient.fetchQuery({
          queryKey: [...rootQueryKey, { path: groupKeys }],
          queryFn: () => fetchSSRM(groupKeys),
          retry: 1,
        })

        setRowCache((prev) => {
          const next = new Map(prev)
          next.set(groupKeys.join(KEY_DELIM), transformRows(data.rows, groupKeys))
          return next
        })

        if (data.pivotKeys?.length) {
          setPivotKeys((prev) => {
            const merged = new Set([...prev, ...data.pivotKeys])
            return Array.from(merged).sort()
          })
        }
        setErrorMessage(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown SSRM error"
        setErrorMessage(message)
        throw error
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev)
          next.delete(rowId)
          return next
        })
      }
    },
    [fetchSSRM, queryClient, rootQueryKey, transformRows],
  )

  const toggleRow = React.useCallback(
    async (row: PivotRow) => {
      if (!row.__hasChildren) {
        return
      }

      const isExpanded = expandedPaths.has(row.__id)
      if (isExpanded) {
        setExpandedPaths((prev) => {
          const next = new Set(prev)
          next.delete(row.__id)
          return next
        })
        return
      }

      const key = row.__path.join(KEY_DELIM)
      if (!rowCache.has(key)) {
        try {
          await loadPath(row.__path, row.__id)
        } catch {
          return
        }
      }

      setExpandedPaths((prev) => {
        const next = new Set(prev)
        next.add(row.__id)
        return next
      })
    },
    [expandedPaths, loadPath, rowCache],
  )

  const buildData = React.useCallback(
    (parentPath: string[], depth: number): PivotRow[] => {
      const key = parentPath.join(KEY_DELIM)
      const rows = rowCache.get(key) ?? []
      return rows.map((row) => {
        const includeChildren = expandedPaths.has(row.__id) && row.__hasChildren
        const subRows = includeChildren ? buildData(row.__path, depth + 1) : []
        return { ...row, subRows }
      })
    },
    [rowCache, expandedPaths],
  )

  const data = React.useMemo(() => buildData([], 0), [buildData])

  const columns = React.useMemo<ColumnDef<PivotRow>[]>(() => {
    const defs: ColumnDef<PivotRow>[] = []

    defs.push({
      id: "expander",
      header: "",
      cell: ({ row }) => {
        const original = row.original
        const depth = row.depth
        if (!original.__hasChildren) {
          return <div style={{ paddingLeft: depth * 12 }} />
        }
        const expanded = expandedPaths.has(original.__id)
        const loading = loadingPaths.has(original.__id)
        return (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            style={{ marginLeft: depth * 12 }}
            onClick={() => toggleRow(original)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        )
      },
      enableSorting: false,
      size: 40,
    })

    const firstGroupField = groupFields[0]
    for (const field of groupFields) {
      const label = fieldDefinitionMap.get(field)?.label ?? field
      const isFirstGroup = field === firstGroupField
      defs.push({
        id: field,
        accessorKey: field,
        header: label,
        cell: ({ getValue, row }) => {
          const value = formatCellValue(getValue())
          if (!isFirstGroup) {
            return value
          }
          return <span style={{ paddingLeft: row.depth * 12 }}>{value}</span>
        },
        enableSorting: true,
      })
    }

    for (const valueField of valueFields) {
      const header = valueField.label ?? valueField.field
      defs.push({
        id: `total:${valueField.field}`,
        accessorKey: valueField.field,
        header: `${header} (${valueField.aggFunc?.toUpperCase() ?? "SUM"})`,
        cell: ({ getValue }) => formatCellValue(getValue()),
        enableSorting: true,
      })
    }

    for (const pivotKey of pivotKeys) {
      for (const valueField of valueFields) {
        defs.push({
          id: `pivot:${pivotKey}:${valueField.field}`,
          header: `${pivotKey} • ${valueField.label ?? valueField.field}`,
          accessorFn: (row) => row.pivot?.[pivotKey]?.[valueField.field],
          cell: ({ getValue }) => formatCellValue(getValue()),
          enableSorting: false,
        })
      }
    }

    for (const field of nonAggregatedFields) {
      const label = fieldDefinitionMap.get(field)?.label ?? field
      defs.push({
        id: `detail:${field}`,
        accessorKey: field,
        header: label,
        cell: ({ getValue }) => formatCellValue(getValue()),
        enableSorting: false,
      })
    }

    return defs
  }, [
    groupFields,
    valueFields,
    pivotKeys,
    nonAggregatedFields,
    fieldDefinitionMap,
    expandedPaths,
    loadingPaths,
    toggleRow,
  ])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.__id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    getSubRows: (row) => row.subRows ?? [],
  })

  const handleRefresh = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: rootQueryKey })
  }, [queryClient, rootQueryKey])

  const loading = rootQuery.isLoading || rootQuery.isFetching

  const badges = [
    {
      label: "Groups",
      value: groupFields.length ? groupFields.join(", ") : "—",
    },
    {
      label: "Pivot",
      value: pivotFields.length ? pivotFields.join(", ") : "—",
    },
    {
      label: "Values",
      value: valueFields.length ? valueFields.map((v) => `${v.field}:${v.aggFunc}`).join(", ") : "—",
    },
  ]

  return (
    <div
      className={cn(
        "flex h-full min-h-[280px] w-full flex-col overflow-hidden rounded-md border border-border bg-background",
        className,
      )}
      style={style}
      {...rest}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {badges.map(({ label, value }) => (
            <Badge key={label} variant="secondary" className="font-normal">
              <span className="mr-1 text-muted-foreground">{label}:</span>
              {value}
            </Badge>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading ? "animate-spin" : undefined)} />
          Refresh
        </Button>
      </div>
      {errorMessage ? (
        <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                  {loading ? "Loading pivot data..." : "No results"}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/20">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap text-xs">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
