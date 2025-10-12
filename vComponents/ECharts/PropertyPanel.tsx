"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { json as jsonLang } from "@codemirror/lang-json"
import type { CustomPropertyRenderProps } from "../property-config-types"

const DEFAULT_OPTION = JSON.stringify(
  {
    title: { text: "ECharts Example" },
    tooltip: {},
    grid: {
      left: 50,
      right: 50,
      top: 60,
      bottom: 50,
      containLabel: true,
    },
    xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    yAxis: { type: "value" },
    series: [
      { type: "bar", data: [120, 200, 150, 80, 70, 110, 130] },
    ],
  },
  null,
  2
)

const tryFormatJson = (input: string): { formatted: string; error?: string } => {
  try {
    const parsed = JSON.parse(input)
    return { formatted: JSON.stringify(parsed, null, 2) }
  } catch (error) {
    return { formatted: input, error: error instanceof Error ? error.message : String(error) }
  }
}

export const EChartsPropertyPanel: React.FC<CustomPropertyRenderProps> = ({
  attributes,
  onAttributeUpdate,
}) => {
  const rawAttribute = attributes["data-option"] ?? ""
  const [value, setValue] = useState<string>(() => (rawAttribute.trim() ? rawAttribute : DEFAULT_OPTION))
  const [error, setError] = useState<string | null>(null)
  const initializedRef = useRef(false)
  const valueRef = useRef(value)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  // Sync external attribute updates back into the editor
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      if (!rawAttribute.trim()) {
        setValue(DEFAULT_OPTION)
        onAttributeUpdate("data-option", DEFAULT_OPTION)
        setError(null)
        return
      }
    }
    if (rawAttribute !== valueRef.current) {
      setValue(rawAttribute)
    }
  }, [rawAttribute, onAttributeUpdate])

  const handleApply = useCallback(
    (next: string) => {
      setValue(next)

      if (!next.trim()) {
        setError(null)
        onAttributeUpdate("data-option", "")
        return
      }

      const { formatted, error: parseError } = tryFormatJson(next)
      if (parseError) {
        setError(parseError)
        return
      }

      setError(null)
      if (formatted !== next) {
        setValue(formatted)
      }
      onAttributeUpdate("data-option", formatted)
    },
    [onAttributeUpdate]
  )

  const handleFormatClick = useCallback(() => {
    const { formatted, error: parseError } = tryFormatJson(value)
    setValue(formatted)
    if (!parseError) {
      onAttributeUpdate("data-option", formatted)
    }
    setError(parseError ?? null)
  }, [value, onAttributeUpdate])

  const extensions = useMemo(() => [jsonLang()], [])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Option JSON</h4>
        <button
          type="button"
          onClick={handleFormatClick}
          className="rounded border border-input bg-secondary px-2 py-1 text-[11px] font-medium text-foreground transition hover:bg-secondary/80"
        >
          Format JSON
        </button>
      </div>
      <CodeMirror
        value={value}
        height="260px"
        theme="light"
        extensions={extensions}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
        onChange={(next) => handleApply(next)}
      />
      {error ? (
        <div className="text-[11px] text-destructive">Invalid JSON: {error}</div>
      ) : (
        <div className="text-[11px] text-muted-foreground">
          Provide a valid Apache ECharts option object. The editor auto-formats valid JSON as you edit.
        </div>
      )}
    </div>
  )
}

EChartsPropertyPanel.displayName = "EChartsPropertyPanel"
