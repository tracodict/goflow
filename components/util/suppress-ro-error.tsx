"use client"

import { useEffect } from "react"

// Suppress known benign ResizeObserver loop warnings that some browsers emit as window errors.
export function SuppressResizeObserverError() {
  useEffect(() => {
    const messages = new Set([
      "ResizeObserver loop completed with undelivered notifications.",
      "ResizeObserver loop limit exceeded",
    ])

    const onError = (e: ErrorEvent) => {
      if (typeof e.message === "string" && messages.has(e.message)) {
        e.stopImmediatePropagation()
        e.preventDefault()
        return false
      }
      return undefined
    }

    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = (e?.reason && (e.reason.message || e.reason)) as string
      if (typeof msg === "string" && messages.has(msg)) {
        e.stopImmediatePropagation()
        e.preventDefault()
        return false
      }
      return undefined
    }

    window.addEventListener("error", onError, true)
    window.addEventListener("unhandledrejection", onRejection, true)
    return () => {
      window.removeEventListener("error", onError, true)
      window.removeEventListener("unhandledrejection", onRejection, true)
    }
  }, [])

  return null
}
