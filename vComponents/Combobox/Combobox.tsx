"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { executeQuery } from "@/lib/datastore-client"
import { useSystemSettings, DEFAULT_SETTINGS } from "@/components/petri/system-settings-context"

export interface ComboboxOption {
  key: string
  value: string
  meta?: Record<string, unknown>
}

export interface ComboboxProps extends React.HTMLAttributes<HTMLDivElement> {
  kind?: "local" | "server"
  options?: ComboboxOption[]
  optionsJson?: string
  queryId?: string
  queryName?: string
  keyField?: string
  valueField?: string
  searchParam?: string
  staticParams?: Record<string, unknown>
  staticParamsJson?: string
  debounceMs?: number
  placeholder?: string
  label?: string
  defaultValue?: string
  disabled?: boolean
  onValueChange?: (value: string | null, option?: ComboboxOption | null) => void
}

const DEFAULT_DEBOUNCE = 700

const parseOptions = (optionsJson?: string): ComboboxOption[] => {
  if (!optionsJson) return []
  try {
    const parsed = JSON.parse(optionsJson)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (!item) return null
        if (typeof item === "object") {
          const key = item.key ?? item.value ?? item.id
          const value = item.value ?? item.label ?? item.key ?? item.id
          if (key === undefined || value === undefined) return null
          return { key: String(key), value: String(value), meta: item }
        }
        return {
          key: String(item),
          value: String(item),
        }
      })
      .filter((item): item is ComboboxOption => Boolean(item?.key))
  } catch (error) {
    console.warn("[Combobox] Failed to parse options", error)
    return []
  }
}

const parseStaticParams = (staticParamsJson?: string): Record<string, unknown> | undefined => {
  if (!staticParamsJson) return undefined
  try {
    const parsed = JSON.parse(staticParamsJson)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed
    }
  } catch (error) {
    console.warn("[Combobox] Failed to parse static params", error)
  }
  return undefined
}

export const Combobox: React.FC<ComboboxProps> = ({
  kind = "local",
  options,
  optionsJson,
  queryId,
  queryName,
  keyField,
  valueField,
  searchParam = "search",
  staticParams,
  staticParamsJson,
  debounceMs = DEFAULT_DEBOUNCE,
  placeholder = "Select option",
  label,
  defaultValue,
  disabled = false,
  className,
  style,
  onValueChange,
  ...rest
}) => {
  const { settings } = useSystemSettings()
  const flowServiceUrl = React.useMemo(
    () => settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl,
    [settings?.flowServiceUrl],
  )

  const parsedStaticParams = React.useMemo(
    () => staticParams ?? parseStaticParams(staticParamsJson) ?? {},
    [staticParams, staticParamsJson],
  )

  const localOptions = React.useMemo(() => {
    if (Array.isArray(options) && options.length > 0) {
      return options
    }
    return parseOptions(optionsJson) || []
  }, [options, optionsJson])

  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [serverOptions, setServerOptions] = React.useState<ComboboxOption[]>([])
  const [selectedKey, setSelectedKey] = React.useState<string | null>(defaultValue ?? null)

  const optionsRef = React.useRef<ComboboxOption[]>(localOptions)
  const debounceRef = React.useRef<number | null>(null)
  const requestIdRef = React.useRef(0)

  React.useEffect(() => {
    if (kind === "local") {
      optionsRef.current = localOptions
    }
  }, [kind, localOptions])

  const fetchOptions = React.useCallback(
    async (term: string) => {
      if (kind !== "server") return
      if (!queryId || !keyField || !valueField) {
        setServerError("Missing query configuration")
        setServerOptions([])
        return
      }
      if (!flowServiceUrl) {
        setServerError("Missing flow service URL")
        setServerOptions([])
        return
      }

      setServerError(null)
      const currentRequest = ++requestIdRef.current
      setLoading(true)

      try {
        const params: Record<string, unknown> = { ...parsedStaticParams }
        if (searchParam) {
          params[searchParam] = term
        }
        const result = await executeQuery(flowServiceUrl, queryId, params)
        if (requestIdRef.current !== currentRequest) {
          return
        }
        const deduped: ComboboxOption[] = []
        const seen = new Set<string>()
        for (const row of result?.rows ?? []) {
          if (!row) continue
          const rawRow = row as Record<string, unknown>
          const rawKey = keyField ? rawRow[keyField] : undefined
          if (rawKey === undefined || rawKey === null) continue
          const rawValue = valueField ? rawRow[valueField] : undefined
          const optionKey = String(rawKey)
          if (seen.has(optionKey)) continue
          const optionValue = rawValue === undefined || rawValue === null ? optionKey : String(rawValue)
          deduped.push({ key: optionKey, value: optionValue, meta: rawRow })
          seen.add(optionKey)
        }
        optionsRef.current = deduped
        setServerOptions(deduped)
      } catch (error) {
        if (requestIdRef.current !== currentRequest) {
          return
        }
        const message = error instanceof Error ? error.message : "Failed to fetch options"
        setServerError(message)
        setServerOptions([])
      } finally {
        if (requestIdRef.current === currentRequest) {
          setLoading(false)
        }
      }
    },
    [kind, queryId, keyField, valueField, flowServiceUrl, parsedStaticParams, searchParam],
  )

  React.useEffect(() => {
    if (kind === "server") {
      fetchOptions("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, fetchOptions, queryId, keyField, valueField])

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const displayedOptions = kind === "server" ? serverOptions : localOptions

  const selectedOption = React.useMemo(() => {
    if (!selectedKey) return null
    return displayedOptions.find((option) => option.key === selectedKey) ?? null
  }, [displayedOptions, selectedKey])

  const handleSelect = React.useCallback(
    (value: string) => {
      const option = displayedOptions.find((item) => item.key === value) ?? null
      setSelectedKey(value)
      setOpen(false)
      onValueChange?.(value, option)
      if (!option && kind === "server" && value) {
        // Preserve selection label if option not currently in list
        optionsRef.current = [
          { key: value, value },
          ...optionsRef.current.filter((item) => item.key !== value),
        ]
      }
    },
    [displayedOptions, kind, onValueChange],
  )

  const handleSearchChange = React.useCallback(
    (value: string) => {
      setSearchTerm(value)
      if (kind !== "server") return
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
      const timeout = window.setTimeout(() => {
        fetchOptions(value)
      }, Math.max(100, Number.isFinite(debounceMs) ? debounceMs : DEFAULT_DEBOUNCE))
      debounceRef.current = timeout
    },
    [kind, fetchOptions, debounceMs],
  )

  const handleClear = React.useCallback(() => {
    setSelectedKey(null)
    onValueChange?.(null, null)
  }, [onValueChange])

  const hasConfigurationIssue = React.useMemo(() => {
    if (kind === "server") {
      return !queryId || !keyField || !valueField
    }
    return false
  }, [kind, queryId, keyField, valueField])

  const triggerLabel = selectedOption?.value ?? selectedKey ?? placeholder

  return (
    <div
      className={cn("flex w-full flex-col gap-2", className)}
      style={style}
      data-kind={kind}
      {...rest}
    >
      {label ? (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex w-full items-center justify-between"
            disabled={disabled || hasConfigurationIssue}
          >
            <span className={cn("truncate", !selectedOption && !selectedKey && "text-muted-foreground")}>{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(320px,100vw-32px)] p-0" align="start">
          <Command>
            <CommandInput
              placeholder={kind === "server" ? "Type to search..." : "Search options"}
              value={searchTerm}
              onValueChange={handleSearchChange}
              disabled={disabled || hasConfigurationIssue}
            />
            <CommandEmpty>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading options…
                </div>
              ) : hasConfigurationIssue ? (
                <span className="text-xs text-destructive">Configure query, key, and value fields.</span>
              ) : serverError ? (
                <span className="text-xs text-destructive">{serverError}</span>
              ) : (
                <span className="text-xs text-muted-foreground">No options found.</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {displayedOptions.map((option) => (
                <CommandItem
                  key={option.key}
                  value={option.key}
                  onSelect={handleSelect}
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedKey === option.key ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{option.value}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        {selectedOption ? <span>Selected: {selectedOption.value}</span> : <span>Selected: none</span>}
        <button
          type="button"
          className="text-[11px] text-primary underline-offset-2 hover:underline disabled:text-muted-foreground"
          onClick={handleClear}
          disabled={!selectedKey || disabled}
        >
          Clear
        </button>
      </div>
      {kind === "server" && queryName ? (
        <span className="text-[10px] text-muted-foreground">Query: {queryName}</span>
      ) : null}
    </div>
  )
}

Combobox.displayName = "Combobox"
