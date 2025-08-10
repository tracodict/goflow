"use client"

import { useEffect, useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CronError = { description: string } | null

type Props = {
  value?: string
  setValue: (v: string) => void
  onError?: (err: CronError) => void
  humanizeLabels?: boolean
  humanizeValue?: boolean
  leadingZero?: boolean
  clearButton?: boolean
  className?: string
}

/**
 * CronLite
 * Minimal, dependency-free cron(5) editor.
 * Supports "*" wildcard or single numeric values for each field.
 */
export function CronLite({
  value,
  setValue,
  onError,
  humanizeLabels = true,
  humanizeValue = true,
  leadingZero = false,
  clearButton = true,
  className,
}: Props) {
  const [minute, setMinute] = useState<string>("*")
  const [hour, setHour] = useState<string>("*")
  const [dom, setDom] = useState<string>("*")
  const [month, setMonth] = useState<string>("*")
  const [dow, setDow] = useState<string>("*")

  const pad = (n: number) => (leadingZero ? String(n).padStart(2, "0") : String(n))

  const minutes = useMemo(() => ["*", ...Array.from({ length: 60 }, (_, i) => pad(i))], [leadingZero])
  const hours = useMemo(() => ["*", ...Array.from({ length: 24 }, (_, i) => pad(i))], [leadingZero])
  const doms = ["*", ...Array.from({ length: 31 }, (_, i) => String(i + 1))]
  const months = ["*", ...Array.from({ length: 12 }, (_, i) => String(i + 1))]
  const dows = ["*", "0", "1", "2", "3", "4", "5", "6"]

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  // Parse incoming value
  useEffect(() => {
    if (!value) {
      onError?.(null)
      return
    }
    const parts = value.trim().split(/\s+/)
    if (parts.length !== 5) {
      onError?.({ description: "Cron must have 5 fields: m h dom mon dow" })
      return
    }
    const [m, h, d, mo, dw] = parts
    const valid =
      isValidField(m, minutes) &&
      isValidField(h, hours) &&
      isValidField(d, doms) &&
      isValidField(mo, months) &&
      isValidField(dw, dows)
    if (!valid) {
      onError?.({ description: "Invalid cron field. Only '*' or single numeric values are supported." })
      return
    }
    setMinute(m)
    setHour(h)
    setDom(d)
    setMonth(mo)
    setDow(dw)
    onError?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Build expression whenever fields change
  useEffect(() => {
    const expr = [minute, hour, dom, month, dow].join(" ")
    setValue(expr)
    const valid =
      isValidField(minute, minutes) &&
      isValidField(hour, hours) &&
      isValidField(dom, doms) &&
      isValidField(month, months) &&
      isValidField(dow, dows)
    onError?.(valid ? null : { description: "Invalid cron expression." })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute, hour, dom, month, dow])

  const clear = () => {
    setMinute("*")
    setHour("*")
    setDom("*")
    setMonth("*")
    setDow("*")
    setValue("")
    onError?.(null)
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <Field
        label="Minute"
        value={minute}
        onChange={setMinute}
        options={minutes}
        tooltip={humanizeValue ? "0-59 or *" : undefined}
      />
      <Field
        label="Hour"
        value={hour}
        onChange={setHour}
        options={hours}
        tooltip={humanizeValue ? "0-23 or *" : undefined}
      />
      <Field
        label="Day of month"
        value={dom}
        onChange={setDom}
        options={doms}
        tooltip={humanizeValue ? "1-31 or *" : undefined}
      />
      <Field
        label="Month"
        value={month}
        onChange={setMonth}
        options={months}
        renderOption={(v) => (humanizeLabels && v !== "*" ? `${v} (${monthNames[Number(v) - 1]})` : v)}
      />
      <Field
        label="Day of week"
        value={dow}
        onChange={setDow}
        options={dows}
        renderOption={(v) => (humanizeLabels && v !== "*" ? `${v} (${dowNames[Number(v)]})` : v)}
      />

      {clearButton ? (
        <div className="pt-1">
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Clear
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function isValidField(val: string, allowed: string[]) {
  return allowed.includes(val)
}

function Field({
  label,
  value,
  onChange,
  options,
  renderOption,
  tooltip,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  renderOption?: (v: string) => string
  tooltip?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs" title={tooltip}>
        {label}
      </Label>
      <select
        className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {renderOption ? renderOption(opt) : opt}
          </option>
        ))}
      </select>
    </div>
  )
}

CronLite.defaultProps = {
  humanizeLabels: true,
  humanizeValue: true,
  leadingZero: false,
  clearButton: true,
}
