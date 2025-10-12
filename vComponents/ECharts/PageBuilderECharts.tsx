"use client"

import React from "react"
import { ECharts } from "./ECharts"

export interface PageBuilderEChartsProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-option"?: string
  "data-component-type"?: string
}

export const PageBuilderECharts: React.FC<PageBuilderEChartsProps> = ({
  "data-option": option,
  "data-component-type": componentType,
  className,
  style,
  ...rest
}) => {
  const trimmedOption = option?.trim() ?? ""
  const hasOption = trimmedOption.length > 0

  return (
    <ECharts
      data-component-type={componentType}
      option={trimmedOption}
      className={className}
      style={{
        border: "1px solid #e5e7eb",
        boxShadow: "inset 0 0 0 1px rgba(148, 163, 184, 0.12)",
        flex: 1,
        width: "100%",
        ...style,
      }}
    showPlaceholder={!hasOption}
      placeholder={"ECharts placeholder: configure 'option' JSON to render."}
      {...rest}
    />
  )
}

PageBuilderECharts.displayName = "PageBuilderECharts"
