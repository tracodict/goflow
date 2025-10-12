"use client"

import React, { useEffect, useMemo, useRef } from "react"
import type { ECharts as EChartsInstance, EChartsOption } from "echarts"
import * as echarts from "echarts"

const DEFAULT_GRID = {
  left: 50,
  right: 50,
  top: 60,
  bottom: 50,
  containLabel: true,
}

const DEFAULT_OPTION: EChartsOption = {
  title: {
    text: "Sample Chart",
    left: "center",
  },
  tooltip: {
    trigger: "axis",
  },
  grid: { ...DEFAULT_GRID },
  xAxis: {
    type: "category",
    data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  yAxis: {
    type: "value",
  },
  series: [
    {
      name: "Value",
      type: "line",
      smooth: true,
      data: [120, 132, 101, 134, 90, 230, 210],
    },
  ],
}

const ensureGridSpacing = (option: EChartsOption) => {
  const applyDefaults = (grid: any) => {
    if (!grid || typeof grid !== "object") return
    if (grid.left == null) grid.left = DEFAULT_GRID.left
    if (grid.right == null) grid.right = DEFAULT_GRID.right
    if (grid.top == null) grid.top = DEFAULT_GRID.top
    if (grid.bottom == null) grid.bottom = DEFAULT_GRID.bottom
    if (grid.containLabel == null) grid.containLabel = DEFAULT_GRID.containLabel
  }

  if (!option.grid) {
    option.grid = { ...DEFAULT_GRID }
  } else if (Array.isArray(option.grid)) {
    option.grid.forEach((entry) => applyDefaults(entry))
  } else if (typeof option.grid === "object") {
    applyDefaults(option.grid)
  }
}

const parseOption = (option?: string): EChartsOption => {
  if (!option) return DEFAULT_OPTION
  try {
    const parsed = JSON.parse(option) as EChartsOption
    if (parsed && typeof parsed === "object") {
      ensureGridSpacing(parsed)
      return parsed
    }
  } catch (error) {
    console.warn("[ECharts] Failed to parse option, using fallback", error)
  }
  return DEFAULT_OPTION
}

export interface EChartsProps extends React.HTMLAttributes<HTMLDivElement> {
  option?: string
  showPlaceholder?: boolean
  placeholder?: React.ReactNode
}

export const ECharts: React.FC<EChartsProps> = ({
  option,
  style,
  className,
  showPlaceholder = false,
  placeholder,
  ...rest
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<EChartsInstance | null>(null)

  const parsedOption = useMemo(() => parseOption(option), [option])

  useEffect(() => {
    if (showPlaceholder) {
      if (chartRef.current) {
        chartRef.current.dispose()
        chartRef.current = null
      }
      return
    }

    const container = containerRef.current
    if (!container) return

    if (!chartRef.current) {
      chartRef.current = echarts.init(container, undefined, {
        renderer: "canvas",
      })
    }

    const chart = chartRef.current
    chart.setOption(parsedOption, true)
    chart.resize()

    const handleWindowResize = () => chart.resize()
    window.addEventListener("resize", handleWindowResize)

    let resizeObserver: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        chartRef.current?.resize()
      })
      resizeObserver.observe(container)
    }

    return () => {
      window.removeEventListener("resize", handleWindowResize)
      resizeObserver?.disconnect()
    }
  }, [showPlaceholder, parsedOption])

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.dispose()
        chartRef.current = null
      }
    }
  }, [])

  // Guard against style overrides that remove sizing
  const mergedStyle = useMemo<React.CSSProperties>(() => {
    const base: React.CSSProperties = {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      flex: 1,
      backgroundColor: "#ffffff",
      borderRadius: "8px",
    }

    if (!style?.height && !style?.minHeight) {
      base.minHeight = "320px"
    }

    return { ...base, ...style }
  }, [style])

  return (
    <div className={className} style={mergedStyle} {...rest}>
      {showPlaceholder ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6b7280",
            fontSize: "14px",
            fontStyle: "italic",
          }}
        >
          {placeholder || "ECharts: add option JSON in the properties panel."}
        </div>
      ) : (
        <div ref={containerRef} style={{ width: "100%", height: "100%", flex: 1 }} />
      )}
    </div>
  )
}

ECharts.displayName = "ECharts"
