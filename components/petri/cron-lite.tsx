"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Cron from 'react-cron-generator'

type CronError = { description: string } | null

type Props = {
  value?: string
  setValue: (v: string) => void
  onError?: (err: CronError) => void
  clearButton?: boolean
  className?: string
}

/**
 * CronLite
 * A wrapper around react-cron-generator for cron expression editing.
 */
export function CronLite({
  value,
  setValue,
  onError,
  clearButton = true,
  className,
}: Props) {
  useEffect(() => {
    if (!value) {
      onError?.(null)
      return
    }
    const parts = value.trim().split(/\s+/)
    if (parts.length !== 7) {
      onError?.({ description: "Cron must have 7 fields: s m h dom mon dow year" })
      return
    }
    onError?.(null)
  }, [value, onError])

  const handleChange = (cronExpression: string) => {
    setValue(cronExpression)
    onError?.(null)
  }

  const clear = () => {
    setValue("")
    onError?.(null)
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <Cron
        value={value}
        onChange={handleChange}
        showResultText={true}
        showResultCron={true}
      />
      {clearButton && (
        <div className="pt-1">
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Clear
          </Button>
        </div>
      )}
    </div>
  )
}

CronLite.defaultProps = {
  clearButton: true,
}
