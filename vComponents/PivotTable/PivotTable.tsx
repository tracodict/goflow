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
  getExpandedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  __path?: string[]
  __groupKeys: unknown[]
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

const ROOT_KEY = "__root__"
const KEY_DELIM = "||"
const PIVOT_KEY_DELIMITER = "`"

type FitMode = "standard" | "fit-width" | "fit-content"

interface PivotTreeNode {
  value: string
  fullKey?: string
  children: Map<string, PivotTreeNode>
}

const serializeGroupKeys = (keys: unknown[]): string =>
  keys
    .map((value) => {
      if (value === null) return "null"
      if (value === undefined) return "undefined"
      if (typeof value === "object") return `object:${JSON.stringify(value)}`
      return `${typeof value}:${String(value)}`
    })
    .join(KEY_DELIM)

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
  pageSize: defaultPageSize = 200,
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
  const [pageSize, setPageSize] = React.useState<number>(defaultPageSize)
  const [pageIndex, setPageIndex] = React.useState<number>(0)
  const [totalRows, setTotalRows] = React.useState<number | null>(null)
  const [fitMode, setFitMode] = React.useState<FitMode>("standard")
  const [zoom, setZoom] = React.useState<number>(100)

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
    (groupKeys: unknown[]): SSRMRequest => {
      const depth = groupKeys.length
      const isRoot = depth === 0
      const startRow = isRoot ? pageIndex * pageSize : 0
      const endRow = startRow + pageSize
      let effectiveGroupFields: string[]
      if (groupFields.length === 0) {
        effectiveGroupFields = []
      } else if (depth >= groupFields.length) {
        effectiveGroupFields = [...groupFields]
      } else {
        effectiveGroupFields = groupFields.slice(0, depth + 1)
      }
      const rowGroupCols = effectiveGroupFields.map((field) => ({
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
        startRow,
        endRow,
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
      pageIndex,
      fieldDefinitionMap,
    ],
  )

  const fetchSSRM = React.useCallback(
    async (groupKeys: unknown[]): Promise<MongoSSRMResponse> => {
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
    (rows: Record<string, any>[], groupKeys: unknown[]): PivotRow[] => {
      const depth = groupKeys.length
      const nextGroupField = groupFields[depth]

      return rows.map((row, index) => {
        const clone: PivotRow = { ...row } as PivotRow

        let rowGroupKeys: unknown[]
        if (nextGroupField) {
          const nextValue = row[nextGroupField]
          rowGroupKeys = [...groupKeys, nextValue]
        } else {
          rowGroupKeys = [...groupKeys]
        }

        let idBase: string
        if (rowGroupKeys.length === 0) {
          idBase = `${ROOT_KEY}${KEY_DELIM}${index}`
        } else {
          idBase = serializeGroupKeys(rowGroupKeys)
        }

        if (!nextGroupField && !pivotActive) {
          const identifier = row._id !== undefined ? String(row._id) : `detail-${depth}-${index}`
          idBase = `${idBase}${KEY_DELIM}${identifier}`
        }

        clone.__groupKeys = rowGroupKeys
        clone.__id = idBase
        clone.__depth = depth
        const hasMoreGroupLevels = depth < groupFields.length - 1
        const canLoadDetails = !pivotActive && depth === groupFields.length - 1
        clone.__hasChildren = hasMoreGroupLevels || canLoadDetails
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
      pageSize,
      pageIndex,
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
      pageSize,
      pageIndex,
    ],
  )

  const rootQuery = useQuery({
    queryKey: rootQueryKey,
    queryFn: () => fetchSSRM([]),
    retry: 1,
  })

  React.useEffect(() => {
    if (rootQuery.data) {
      const lastRow = typeof rootQuery.data.lastRow === "number" ? rootQuery.data.lastRow : null
      setTotalRows(lastRow)
      if (lastRow !== null && lastRow >= 0) {
        const maxPageIndex = Math.max(0, Math.ceil(lastRow / pageSize) - 1)
        if (pageIndex > maxPageIndex) {
          setPageIndex(maxPageIndex)
        }
      }
      setRowCache(new Map([[ROOT_KEY, transformRows(rootQuery.data.rows, [])]]))
      setPivotKeys(rootQuery.data.pivotKeys ?? [])
      setExpandedPaths(new Set())
      setErrorMessage(null)
    }
  }, [rootQuery.data, transformRows, pageSize, pageIndex])

  React.useEffect(() => {
    if (rootQuery.error) {
      const message =
        rootQuery.error instanceof Error ? rootQuery.error.message : "Unknown SSRM error"
      setErrorMessage(message)
    }
  }, [rootQuery.error])

  const loadPath = React.useCallback(
    async (groupKeys: unknown[], rowId: string) => {
      const pathKey = groupKeys.length ? serializeGroupKeys(groupKeys) : ROOT_KEY
      if (rowCache.has(pathKey)) {
        return
      }

      setLoadingPaths((prev) => {
        const next = new Set(prev)
        next.add(rowId)
        return next
      })

      try {
        const pathKey = groupKeys.length ? serializeGroupKeys(groupKeys) : ROOT_KEY
        const data = await queryClient.fetchQuery({
          queryKey: [...rootQueryKey, { path: pathKey }],
          queryFn: () => fetchSSRM(groupKeys),
          retry: 1,
        })

        setRowCache((prev) => {
          const next = new Map(prev)
          next.set(pathKey, transformRows(data.rows, groupKeys))
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
    [fetchSSRM, queryClient, rootQueryKey, transformRows, rowCache],
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

      const groupKeys = Array.isArray(row.__groupKeys) ? row.__groupKeys : []
      try {
        await loadPath(groupKeys, row.__id)
      } catch {
        return
      }

      setExpandedPaths((prev) => {
        const next = new Set(prev)
        next.add(row.__id)
        return next
      })
    },
    [expandedPaths, loadPath],
  )

  const buildData = React.useCallback(
    (groupKeys: unknown[]): PivotRow[] => {
      const cacheKey = groupKeys.length ? serializeGroupKeys(groupKeys) : ROOT_KEY
      const rows = rowCache.get(cacheKey) ?? []
      return rows.map((row) => {
        const includeChildren = expandedPaths.has(row.__id) && row.__hasChildren
        const subRows = includeChildren ? buildData(row.__groupKeys) : []
        return { ...row, subRows }
      })
    },
    [rowCache, expandedPaths],
  )

  const data = React.useMemo(() => buildData([]), [buildData])

  const pivotTree = React.useMemo(() => {
    if (!pivotActive || pivotFields.length === 0 || pivotKeys.length === 0) {
      return null
    }
    const root = new Map<string, PivotTreeNode>()
    for (const key of pivotKeys) {
      const parts = pivotFields.length === 1 ? [key] : key.split(PIVOT_KEY_DELIMITER)
      let current = root
      parts.forEach((part, idx) => {
        const mapKey = `${idx}:${part}`
        const existing = current.get(mapKey)
        if (!existing) {
          const node: PivotTreeNode = {
            value: part,
            children: new Map(),
          }
          current.set(mapKey, node)
        }
        const node = current.get(mapKey)!
        if (idx === parts.length - 1) {
          node.fullKey = key
        }
        current = node.children
      })
    }
    return root
  }, [pivotActive, pivotFields, pivotKeys])

  const pivotHeaderColumns = React.useMemo<ColumnDef<PivotRow>[]>(() => {
    if (!pivotActive || !pivotTree || pivotFields.length === 0 || valueFields.length === 0) {
      return []
    }

    const buildLevel = (nodes: Map<string, PivotTreeNode>, depth: number): ColumnDef<PivotRow>[] => {
      const field = pivotFields[depth]
      const fieldLabel = fieldDefinitionMap.get(field)?.label ?? field
      const columns: ColumnDef<PivotRow>[] = []

      for (const [mapKey, node] of nodes.entries()) {
        const displayValue = formatCellValue(node.value)
        const headerContent = (
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-muted-foreground">{fieldLabel}</span>
            <span>{displayValue}</span>
          </div>
        )

        if (depth === pivotFields.length - 1) {
          const pivotKey = node.fullKey ?? String(node.value)
          const leafColumns = valueFields.map<ColumnDef<PivotRow>>((valueField) => ({
            id: `pivot:${pivotKey}:${valueField.field}`,
            header: valueField.label ?? valueField.field,
            accessorFn: (row) => row.pivot?.[pivotKey]?.[valueField.field],
            cell: ({ getValue }) => formatCellValue(getValue()),
            enableSorting: false,
          }))
          columns.push({
            id: `pivot-level-${depth}:${mapKey}`,
            header: () => headerContent,
            columns: leafColumns,
          })
        } else {
          const childColumns = buildLevel(node.children, depth + 1)
          columns.push({
            id: `pivot-level-${depth}:${mapKey}`,
            header: () => headerContent,
            columns: childColumns,
          })
        }
      }

      return columns
    }

    return buildLevel(pivotTree, 0)
  }, [pivotActive, pivotTree, pivotFields, valueFields, fieldDefinitionMap])

  const expandedState = React.useMemo(() => {
    const state: Record<string, boolean> = {}
    expandedPaths.forEach((value) => {
      state[value] = true
    })
    return state
  }, [expandedPaths])

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
          const depth = row.depth
          const fieldIndex = groupFields.indexOf(field)
          if (fieldIndex === -1) {
            return value
          }
          if (fieldIndex < depth) {
            return ""
          }
          if (fieldIndex === 0) {
            return <span style={{ paddingLeft: depth * 12 }}>{value}</span>
          }
          return value
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

    if (pivotHeaderColumns.length > 0) {
      defs.push(...pivotHeaderColumns)
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
    nonAggregatedFields,
    fieldDefinitionMap,
    expandedPaths,
    loadingPaths,
    toggleRow,
    pivotHeaderColumns,
  ])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, expanded: expandedState },
    onSortingChange: setSorting,
    getRowId: (row) => row.__id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    getSubRows: (row) => row.subRows ?? [],
    getExpandedRowModel: getExpandedRowModel(),
    autoResetExpanded: false,
    getRowCanExpand: (row) => Boolean(row.original.__hasChildren),
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

  const zoomScale = React.useMemo(() => Math.max(zoom, 10) / 100, [zoom])
  const fitLabels: Record<FitMode, string> = {
    standard: "Standard",
    "fit-width": "FitToWidth",
    "fit-content": "FitToContent",
  }
  const cycleFitMode = React.useCallback(() => {
    setFitMode((prev) => {
      if (prev === "standard") return "fit-width"
      if (prev === "fit-width") return "fit-content"
      return "standard"
    })
  }, [])
  const onZoomChange = React.useCallback((value: number[]) => {
    if (!value || value.length === 0) return
    const next = value[0]
    setZoom(Math.min(Math.max(next, 50), 200))
  }, [])
  const pageSizeOptions = React.useMemo(() => [25, 50, 100, 200, 500], [])
  const totalPages = React.useMemo(() => {
    if (totalRows === null || totalRows < 0) return null
    if (totalRows === 0) return 1
    return Math.max(1, Math.ceil(totalRows / pageSize))
  }, [totalRows, pageSize])
  const canGoPrev = pageIndex > 0
  const canGoNext = totalPages === null ? true : pageIndex < totalPages - 1
  const handlePrevPage = React.useCallback(() => {
    setPageIndex((prev) => Math.max(prev - 1, 0))
  }, [])
  const handleNextPage = React.useCallback(() => {
    setPageIndex((prev) => {
      if (totalPages === null) return prev + 1
      return Math.min(prev + 1, totalPages - 1)
    })
  }, [totalPages])
  const handlePageSizeChange = React.useCallback((value: string) => {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) {
      setPageSize(numeric)
      setPageIndex(0)
    }
  }, [])
  const visibleRows = rowCache.get(ROOT_KEY)?.length ?? 0
  const rowStart = totalRows === 0 ? 0 : pageIndex * pageSize + (visibleRows > 0 ? 1 : 0)
  const rowEnd = totalRows === null ? pageIndex * pageSize + visibleRows : Math.min(totalRows, pageIndex * pageSize + visibleRows)

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
        <div
          className="inline-block origin-top-left"
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: "top left",
            width: fitMode === "fit-width" ? `${(1 / zoomScale) * 100}%` : undefined,
          }}
        >
          <Table
            className={cn(
              "text-xs",
              fitMode === "fit-width" ? "table-fixed w-full" : "table-auto",
              fitMode === "fit-content" ? "min-w-max" : "min-w-full",
            )}
          >
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
      <div className="flex items-center justify-between gap-4 border-t px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={cycleFitMode}>
            {fitLabels[fitMode]}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Zoom</span>
            <Slider
              className="w-32"
              min={50}
              max={200}
              step={5}
              value={[zoom]}
              onValueChange={onZoomChange}
            />
            <span>{zoom}%</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rows</span>
            <span>
              {rowStart === 0 && rowEnd === 0 ? "0" : `${rowStart}-${rowEnd}`}
              {totalRows !== null && totalRows >= 0 ? ` / ${totalRows}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Page Size</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-7 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon" onClick={handlePrevPage} disabled={!canGoPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Page {pageIndex + 1}
              {totalPages ? ` / ${totalPages}` : ""}
            </span>
            <Button variant="secondary" size="icon" onClick={handleNextPage} disabled={!canGoNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
