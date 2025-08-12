"use client"

import type React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import CodeMirror from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { javascript } from "@codemirror/lang-javascript"
import { EditorView } from "@codemirror/view"
import type { Extension } from "@codemirror/state"

type FloatingCodeMirrorProps = {
  anchorRef: React.RefObject<HTMLElement | null>
  scrollParents?: Array<HTMLElement | Window>
  height: number
  language: "json" | "javascript" | "text"
  value: string
  onChange?: (val: string) => void
  className?: string
  extensions?: Extension[]
  placeholder?: string
}

export function FloatingCodeMirror({
  anchorRef,
  scrollParents = [],
  height,
  language,
  value,
  onChange,
  className,
  extensions = [],
  placeholder,
}: FloatingCodeMirrorProps) {
  const [mounted, setMounted] = useState(false)
  const portalDivRef = useRef<HTMLDivElement | null>(null)

  const lastRectRef = useRef<{ l: number; t: number; w: number; h: number } | null>(null)
  const rafRef = useRef<number | null>(null)

  // Create overlay node once
  useLayoutEffect(() => {
    const el = document.createElement("div")
    el.style.position = "fixed"
    el.style.zIndex = "1000"
    el.style.left = "0px"
    el.style.top = "0px"
    el.style.width = "0px"
    el.style.height = "0px"
    el.style.pointerEvents = "auto"
    el.style.transform = "none"
    el.style.contain = "strict"
    ;(el.style as any).contentVisibility = "auto"
    el.className = className || ""
    document.body.appendChild(el)
    portalDivRef.current = el
    setMounted(true)
    return () => {
      document.body.removeChild(el)
      portalDivRef.current = null
    }
  }, [className])

  const writePosition = () => {
    const anchor = anchorRef.current
    const container = portalDivRef.current
    if (!anchor || !container) return
    const rect = anchor.getBoundingClientRect()
    const next = {
      l: Math.round(rect.left),
      t: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    }
    const prev = lastRectRef.current
    if (!prev || prev.l !== next.l || prev.t !== next.t || prev.w !== next.w || prev.h !== next.h) {
      container.style.left = `${next.l}px`
      container.style.top = `${next.t}px`
      container.style.width = `${next.w}px`
      container.style.height = `${next.h}px`
      lastRectRef.current = next
    }
  }

  const scheduleWrite = () => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      writePosition()
      requestAnimationFrame(writePosition)
    })
  }

  // Observe anchor size/position changes safely
  useEffect(() => {
    scheduleWrite()
    const anchor = anchorRef.current
    if (!anchor) return

    let ro: ResizeObserver | null = new ResizeObserver(() => {
      scheduleWrite()
    })
    ro.observe(anchor)

    const onScroll = () => scheduleWrite()
    const onResize = () => scheduleWrite()

    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onScroll, { passive: true })
    for (const sp of scrollParents) {
      sp.addEventListener?.("scroll", onScroll, { passive: true } as any)
    }

    scheduleWrite()

    return () => {
      ro?.disconnect()
      ro = null
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onScroll)
      for (const sp of scrollParents) {
        sp.removeEventListener?.("scroll", onScroll as any)
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [anchorRef, scrollParents])

  const languageExtensions = useMemo<Extension[]>(() => {
    const base: Extension[] = [EditorView.lineWrapping]
    switch (language) {
      case "json":
        return [...base, json()]
      case "javascript":
        return [...base, javascript()]
      default:
        return base
    }
  }, [language])

  const editor = useMemo(() => {
    if (!mounted || !portalDivRef.current) return null
    return (
      <div style={{ width: "100%", height }}>
        <CodeMirror
          value={value}
          height={`${height}px`}
          theme="light"
          basicSetup={{
            lineNumbers: true,
            bracketMatching: true,
            closeBrackets: true,
            highlightActiveLine: true,
            indentOnInput: true,
            defaultKeymap: true,
          }}
          extensions={[...languageExtensions, ...extensions]}
          onChange={(val) => onChange?.(val)}
          placeholder={placeholder}
        />
      </div>
    )
  }, [mounted, height, value, onChange, languageExtensions, extensions, placeholder])

  if (!mounted || !portalDivRef.current) return null
  return createPortal(editor, portalDivRef.current)
}
