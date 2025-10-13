'use client'

import * as React from "react"
import {
  PivotTable,
  type FieldDefinition,
  type PivotTableProps,
  type ValueFieldDefinition,
  DEFAULT_PIVOT_TABLE_CONFIG,
} from "./PivotTable"
import { cn } from "@/lib/utils"

const cloneFallback = <T,>(fallback: T): T => {
  if (fallback === null || typeof fallback !== "object") return fallback
  try {
    return structuredClone(fallback)
  } catch {
    return JSON.parse(JSON.stringify(fallback)) as T
  }
}

const safeParse = <T,>(value: string | undefined, fallback: T): T => {
  if (!value) return cloneFallback(fallback)
  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.warn("PivotTable: Failed to parse attribute", { value, error })
    return cloneFallback(fallback)
  }
}

export interface PageBuilderPivotTableProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  "data-element-id"?: string
  "data-ssrm-endpoint"?: string
  "data-ssrm-database"?: string
  "data-ssrm-collection"?: string
  "data-base-pipeline"?: string
  "data-field-definitions"?: string
  "data-default-group-fields"?: string
  "data-default-pivot-fields"?: string
  "data-default-value-fields"?: string
  "data-filter-model"?: string
  "data-non-aggregated-fields"?: string
  "data-page-size"?: string
}

export const PageBuilderPivotTable: React.FC<PageBuilderPivotTableProps> = ({
  "data-ssrm-endpoint": endpointAttr,
  "data-ssrm-database": databaseAttr,
  "data-ssrm-collection": collectionAttr,
  "data-base-pipeline": basePipelineAttr,
  "data-field-definitions": fieldDefinitionsAttr,
  "data-default-group-fields": defaultGroupFieldsAttr,
  "data-default-pivot-fields": defaultPivotFieldsAttr,
  "data-default-value-fields": defaultValueFieldsAttr,
  "data-filter-model": filterModelAttr,
  "data-non-aggregated-fields": nonAggregatedAttr,
  "data-page-size": pageSizeAttr,
  className,
  style,
  ...rest
}) => {
  const basePipeline = React.useMemo(
    () => safeParse<Record<string, any>[]>(basePipelineAttr, []),
    [basePipelineAttr],
  )
  const fieldDefinitions = React.useMemo(
    () => safeParse<FieldDefinition[]>(fieldDefinitionsAttr, DEFAULT_PIVOT_TABLE_CONFIG.fieldDefinitions),
    [fieldDefinitionsAttr],
  )
  const defaultGroupFields = React.useMemo(
    () => safeParse<string[]>(defaultGroupFieldsAttr, DEFAULT_PIVOT_TABLE_CONFIG.groupFields),
    [defaultGroupFieldsAttr],
  )
  const defaultPivotFields = React.useMemo(
    () => safeParse<string[]>(defaultPivotFieldsAttr, DEFAULT_PIVOT_TABLE_CONFIG.pivotFields),
    [defaultPivotFieldsAttr],
  )
  const defaultValueFields = React.useMemo(
    () => safeParse<ValueFieldDefinition[]>(defaultValueFieldsAttr, DEFAULT_PIVOT_TABLE_CONFIG.valueFields),
    [defaultValueFieldsAttr],
  )
  const defaultFilterModel = React.useMemo(
    () => safeParse<Record<string, any> | null>(filterModelAttr, null),
    [filterModelAttr],
  )
  const nonAggregatedFields = React.useMemo(
    () =>
      safeParse<string[]>(
        nonAggregatedAttr,
        DEFAULT_PIVOT_TABLE_CONFIG.nonAggregatedFields,
      ),
    [nonAggregatedAttr],
  )

  const pageSize = React.useMemo(() => {
    const parsed = pageSizeAttr ? Number(pageSizeAttr) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 200
  }, [pageSizeAttr])

  const pivotProps: PivotTableProps = React.useMemo(
    () => ({
      endpoint: endpointAttr || "/api/ssrm",
  database: databaseAttr || DEFAULT_PIVOT_TABLE_CONFIG.database,
  collection: collectionAttr || DEFAULT_PIVOT_TABLE_CONFIG.collection,
      basePipeline,
      fieldDefinitions,
      defaultGroupFields,
      defaultPivotFields,
      defaultValueFields,
      defaultFilterModel,
      nonAggregatedFields,
      pageSize,
      className: cn("w-full", className),
      style,
    }),
    [
      endpointAttr,
      databaseAttr,
      collectionAttr,
      basePipeline,
      fieldDefinitions,
      defaultGroupFields,
      defaultPivotFields,
      defaultValueFields,
      defaultFilterModel,
      nonAggregatedFields,
      pageSize,
      className,
      style,
    ],
  )

  return <PivotTable {...pivotProps} {...rest} />
}
