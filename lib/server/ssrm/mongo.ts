import { Document, MongoClient } from "mongodb"

type FilterModel = Record<string, any>

type AdvancedFilterModel = Record<string, any>

export interface ColumnVO {
  id: string
  displayName: string
  field?: string
  aggFunc?: string
}

export interface SortModelItem {
  colId: string
  sort: "asc" | "desc"
}

export interface SSRMRequest {
  startRow?: number
  endRow?: number
  rowGroupCols?: ColumnVO[]
  valueCols?: ColumnVO[]
  pivotCols?: ColumnVO[]
  pivotMode?: boolean
  groupKeys?: any[]
  filterModel?: FilterModel | AdvancedFilterModel | null
  sortModel?: SortModelItem[]
  basePipeline?: Document[]
  database?: string
  collection?: string
}

export interface MongoSSRMOptions {
  client: MongoClient
  database: string
  collection: string
  basePipeline?: Document[]
}

type NormalisedSSRMRequest = {
  startRow?: number
  endRow?: number
  rowGroupCols: ColumnVO[]
  valueCols: ColumnVO[]
  pivotCols: ColumnVO[]
  pivotMode: boolean
  groupKeys: any[]
  filterModel: FilterModel | AdvancedFilterModel | null
  sortModel: SortModelItem[]
}

const ensureObjectIdField = (col: ColumnVO): string | undefined => {
  if (col.field && col.field.length > 0) return col.field
  if (col.id && col.id.length > 0) return col.id
  return undefined
}

const isGrouping = (groupKeys: any[], rowGroupCols: ColumnVO[]): boolean => {
  return groupKeys.length < rowGroupCols.length
}

class MongoSSRMBuilder {
  private pipeline: Document[]
  private grouped = false

  constructor(private readonly request: NormalisedSSRMRequest) {
    this.pipeline = []
  }

  public static fromRequest(request: SSRMRequest): MongoSSRMBuilder {
    return new MongoSSRMBuilder({
      startRow: request.startRow,
      endRow: request.endRow,
      rowGroupCols: request.rowGroupCols ?? [],
      valueCols: request.valueCols ?? [],
      pivotCols: request.pivotCols ?? [],
      pivotMode: Boolean(request.pivotMode),
      groupKeys: request.groupKeys ?? [],
      filterModel: request.filterModel ?? null,
      sortModel: request.sortModel ?? [],
    })
  }

  public match(): this {
    const { filterModel, rowGroupCols, groupKeys, sortModel } = this.request
    const matchStage: Document = {}

    if (filterModel && typeof filterModel === "object") {
      for (const [key, rawFilter] of Object.entries(filterModel)) {
        if (!rawFilter || typeof rawFilter !== "object") continue
        const filterType = rawFilter.filterType as string | undefined
        switch (filterType) {
          case "text": {
            const value = rawFilter.filter
            if (typeof value === "string") {
              matchStage[key] = { $regex: value, $options: "i" }
            }
            break
          }
          case "number": {
            const value = rawFilter.filter
            if (typeof value === "number") {
              matchStage[key] = value
            }
            break
          }
          case "date": {
            const from = rawFilter.dateFrom
            const to = rawFilter.dateTo
            if (from || to) {
              const range: Document = {}
              if (from) range.$gte = from
              if (to) range.$lte = to
              matchStage[key] = range
            }
            break
          }
          default: {
            // Support equals filter shape from advanced filter model { value: ..., operator: ... }
            if (rawFilter.value !== undefined) {
              matchStage[key] = rawFilter.value
            }
          }
        }
      }
    }

    if (Object.keys(matchStage).length > 0) {
      this.pipeline.push({ $match: matchStage })
    }

    if (rowGroupCols.length > 0 && groupKeys.length > 0) {
      const groupFilter: Document = {}
      const upto = Math.min(rowGroupCols.length, groupKeys.length)
      for (let i = 0; i < upto; i++) {
        const groupCol = rowGroupCols[i]
        const field = ensureObjectIdField(groupCol)
        if (!field) continue
        groupFilter[field] = groupKeys[i]
      }
      if (Object.keys(groupFilter).length > 0) {
        this.pipeline.push({ $match: groupFilter })
      }
    }

    return this
  }

  public sort(isGrouped: boolean): this {
    const { sortModel, rowGroupCols, groupKeys } = this.request
    if (!Array.isArray(sortModel) || sortModel.length === 0) {
      return this
    }

    const isGroupedContext = isGrouped && isGrouping(groupKeys, rowGroupCols)
    const idPrefix = isGroupedContext ? "_id." : ""

    const sortStage: Document = {}
    for (const sortItem of sortModel) {
      if (!sortItem || typeof sortItem !== "object") continue
      const colId = sortItem.colId
      if (!colId || colId.startsWith("ag-Grid-AutoColumn")) continue
      const sortOrder = sortItem.sort === "desc" ? -1 : 1
      sortStage[idPrefix + colId] = sortOrder
    }

    if (Object.keys(sortStage).length > 0) {
      this.pipeline.push({ $sort: sortStage })
    }

    return this
  }

  public group(): this {
    const { rowGroupCols, pivotCols, valueCols, groupKeys, pivotMode } = this.request
    const hasPivot = pivotMode && pivotCols.length > 0

    if (rowGroupCols.length === 0 && !hasPivot) {
      if (valueCols.length === 0) {
        return this
      }
      const globalGroupStage: Document = { _id: null }
      for (const valueCol of valueCols) {
        const field = ensureObjectIdField(valueCol)
        if (!field) continue
        const agg = (valueCol.aggFunc ?? "sum").toLowerCase()
        if (agg === "count") {
          globalGroupStage[field] = { $sum: 1 }
        } else {
          globalGroupStage[field] = { [`$${agg}`]: `$${field}` }
        }
      }
      this.pipeline.push({ $group: globalGroupStage })
      this.grouped = true
      return this
    }

    if (!hasPivot && rowGroupCols.length === groupKeys.length) {
      return this
    }

    const depth = groupKeys.length
    const groupStage: Document = { _id: {} }
    const idDoc = groupStage._id as Document

    if (!hasPivot) {
      for (let i = 0; i < rowGroupCols.length; i++) {
        const field = ensureObjectIdField(rowGroupCols[i])
        if (!field) continue
        if (i < depth) {
          idDoc[field] = groupKeys[i]
        } else if (i === depth) {
          idDoc[field] = `$${field}`
          break
        }
      }
    } else {
      for (let i = 0; i < rowGroupCols.length; i++) {
        const field = ensureObjectIdField(rowGroupCols[i])
        if (!field) continue
        if (i < depth) {
          idDoc[field] = groupKeys[i]
        } else {
          idDoc[field] = `$${field}`
        }
      }

      for (const pivotCol of pivotCols) {
        const field = ensureObjectIdField(pivotCol)
        if (!field) continue
        idDoc[field] = `$${field}`
      }
    }

    if (Object.keys(idDoc).length === 0 && valueCols.length === 0) {
      return this
    }

    for (const valueCol of valueCols) {
      const field = ensureObjectIdField(valueCol)
      if (!field) continue
      const agg = (valueCol.aggFunc ?? "sum").toLowerCase()
      if (agg === "count") {
        groupStage[field] = { $sum: 1 }
      } else {
        groupStage[field] = { [`$${agg}`]: `$${field}` }
      }
    }

    this.pipeline.push({ $group: groupStage })
    this.grouped = true

    return this
  }

  public skipAndLimit(): this {
    const { startRow, endRow } = this.request
    if (typeof startRow === "number") {
      this.pipeline.push({ $skip: startRow })
    }
    if (typeof endRow === "number" && typeof startRow === "number") {
      this.pipeline.push({ $limit: endRow - startRow })
    }
    return this
  }

  public build(): Document[] {
    return [...this.pipeline]
  }

  public hasGroupStage(): boolean {
    return this.grouped
  }

  public pivot(): this {
    const { pivotMode, pivotCols, rowGroupCols, valueCols } = this.request
    if (!pivotMode || pivotCols.length === 0 || !this.grouped) {
      return this
    }

    const pivotFields = pivotCols
      .map((col) => ensureObjectIdField(col))
      .filter((field): field is string => Boolean(field))

    if (pivotFields.length === 0) {
      return this
    }

    const groupId: Document = {}
    for (const groupCol of rowGroupCols) {
      const field = ensureObjectIdField(groupCol)
      if (!field) continue
      groupId[field] = `$_id.${field}`
    }

    const valueDoc: Document = {}
    for (const valueCol of valueCols) {
      const field = ensureObjectIdField(valueCol)
      if (!field) continue
      valueDoc[field] = `$${field}`
    }

    const pivotKeyExpression = pivotFields.length === 1
      ? `$_id.${pivotFields[0]}`
      : {
          $concat: pivotFields.flatMap((field, idx) => {
            const token = `$_id.${field}`
            if (idx === pivotFields.length - 1) {
              return [token]
            }
            return [token, "`"]
          }),
        }

    const totalAccumulators: Document = {}
    for (const valueCol of valueCols) {
      const field = ensureObjectIdField(valueCol)
      if (!field) continue
      const agg = (valueCol.aggFunc ?? "sum").toLowerCase()
      switch (agg) {
        case "avg":
          totalAccumulators[field] = { $avg: `$${field}` }
          break
        case "min":
        case "max":
          totalAccumulators[field] = { [`$${agg}`]: `$${field}` }
          break
        case "count":
          totalAccumulators[field] = { $sum: `$${field}` }
          break
        default:
          totalAccumulators[field] = { $sum: `$${field}` }
          break
      }
    }

    this.pipeline.push({
      $group: {
        _id: groupId,
        pivotRows: {
          $push: {
            pivotKey: pivotKeyExpression,
            values: valueDoc,
          },
        },
        ...totalAccumulators,
      },
    })

    this.pipeline.push({
      $addFields: {
        pivot: {
          $arrayToObject: {
            $map: {
              input: "$pivotRows",
              as: "row",
              in: {
                k: "$$row.pivotKey",
                v: "$$row.values",
              },
            },
          },
        },
      },
    })

    this.pipeline.push({ $project: { pivotRows: 0 } })

    return this
  }
}

export interface MongoSSRMResponse {
  rows: Document[]
  pivotKeys: string[]
  pipeline: Document[]
  lastRow: number | null
}

export async function processMongoSSRM(options: MongoSSRMOptions, request: SSRMRequest): Promise<MongoSSRMResponse> {
  const { client, database, collection, basePipeline = [] } = options
  const db = client.db(database)
  const coll = db.collection(collection)

  const builder = MongoSSRMBuilder.fromRequest(request)
  const hasGrouping = (request.rowGroupCols?.length ?? 0) > 0
  const hasPivot = Boolean(request.pivotMode && (request.pivotCols?.length ?? 0) > 0)
  const hasValueAgg = (request.valueCols?.length ?? 0) > 0

  builder.match()

  if (hasGrouping || hasPivot || hasValueAgg) {
    builder.group()
    if (hasPivot) {
      builder.pivot()
    }
    builder.sort(builder.hasGroupStage())
  } else {
    builder.sort(false)
  }

  builder.skipAndLimit()

  const ssrmPipeline = builder.build()
  const pipeline: Document[] = [...basePipeline, ...ssrmPipeline]

  const cursor = coll.aggregate(pipeline, { allowDiskUse: true })
  const rawResults = await cursor.toArray()

  const startRow = request.startRow ?? 0
  const requestedCount =
    typeof request.startRow === "number" && typeof request.endRow === "number"
      ? request.endRow - request.startRow
      : undefined

  const flattenRows = (docs: Document[]): Document[] => {
    return docs.map((doc) => {
      if (!doc || typeof doc !== "object") return doc
      const { _id, ...rest } = doc as any
      const isPlainObject =
        _id && typeof _id === "object" && Object.getPrototypeOf(_id) === Object.prototype
      if (isPlainObject) {
        return { ..._id, ...rest }
      }
      return { _id, ...rest }
    })
  }

  if (!Array.isArray(rawResults) || rawResults.length === 0) {
    return {
      rows: [],
      pivotKeys: [],
      pipeline: JSON.parse(JSON.stringify(pipeline)),
      lastRow: requestedCount !== undefined ? startRow : null,
    }
  }

  const flattened = flattenRows(rawResults as Document[])
  const pivotKeySet = new Set<string>()

  if (hasPivot) {
    for (const row of flattened) {
      const pivot = (row as any).pivot
      if (pivot && typeof pivot === "object") {
        for (const key of Object.keys(pivot)) {
          pivotKeySet.add(String(key))
        }
      }
    }
  }

  const lastRow =
    requestedCount !== undefined && flattened.length < requestedCount
      ? startRow + flattened.length
      : null

  return {
    rows: JSON.parse(JSON.stringify(flattened)) as Document[],
    pivotKeys: Array.from(pivotKeySet.values()).sort(),
    pipeline: JSON.parse(JSON.stringify(pipeline)),
    lastRow,
  }
}
