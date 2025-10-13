"use client"

import * as React from "react"

import { Combobox, type ComboboxOption } from "./Combobox"

export interface PageBuilderComboboxProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-component-type"?: string
  "data-kind"?: string
  "data-options"?: string
  "data-query-id"?: string
  "data-query-name"?: string
  "data-key-field"?: string
  "data-value-field"?: string
  "data-search-param"?: string
  "data-static-params"?: string
  "data-debounce-ms"?: string
  "data-placeholder"?: string
  "data-label"?: string
  "data-default-value"?: string
  "data-disabled"?: string
}

export const PageBuilderCombobox: React.FC<PageBuilderComboboxProps> = ({
  "data-component-type": componentType,
  "data-kind": dataKind,
  "data-options": dataOptions,
  "data-query-id": dataQueryId,
  "data-query-name": dataQueryName,
  "data-key-field": dataKeyField,
  "data-value-field": dataValueField,
  "data-search-param": dataSearchParam,
  "data-static-params": dataStaticParams,
  "data-debounce-ms": dataDebounceMs,
  "data-placeholder": dataPlaceholder,
  "data-label": dataLabel,
  "data-default-value": dataDefaultValue,
  "data-disabled": dataDisabled,
  className,
  style,
  onClick,
  ...rest
}) => {
  const kind = dataKind === "server" ? "server" : "local"
  const disabled = dataDisabled === "true"
  const debounceMs = dataDebounceMs ? Number(dataDebounceMs) : undefined
  const placeholder = dataPlaceholder ?? "Select option"
  const label = dataLabel
  const defaultValue = dataDefaultValue ?? undefined

  const handleValueChange = React.useCallback(
    (value: string | null, option?: ComboboxOption | null) => {
      if (componentType) {
        try {
          window.dispatchEvent(
            new CustomEvent("goflow-combobox-change", {
              detail: {
                componentType,
                value,
                option,
              },
            }),
          )
        } catch (error) {
          console.warn("[Combobox] Failed to dispatch change event", error)
        }
      }
    },
    [componentType],
  )

  return (
    <div
      {...rest}
      onClick={onClick}
      className={className}
      style={style}
      data-component-type={componentType ?? "Combobox"}
    >
      <Combobox
        kind={kind}
        optionsJson={dataOptions}
        queryId={dataQueryId}
        queryName={dataQueryName}
        keyField={dataKeyField}
        valueField={dataValueField}
        searchParam={dataSearchParam}
        staticParamsJson={dataStaticParams}
        debounceMs={debounceMs}
        placeholder={placeholder}
        label={label}
        defaultValue={defaultValue}
        disabled={disabled}
        onValueChange={handleValueChange}
      />
    </div>
  )
}

PageBuilderCombobox.displayName = "PageBuilderCombobox"
