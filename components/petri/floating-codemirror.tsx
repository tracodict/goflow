"use client"

import type React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import CodeMirror from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { javascript } from "@codemirror/lang-javascript"
import { EditorView } from "@codemirror/view"
import type { Extension } from "@codemirror/state"
import { GripHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  /** Enable vertical resizing */
  resizable?: boolean
  /** Minimum height when resizable */
  minHeight?: number
  /** Maximum height when resizable */
  maxHeight?: number
  /** Storage key for persisting height */
  storageKey?: string
}

export function FloatingCodeMirror({
  anchorRef,
  scrollParents = [],
  height: initialHeight,
  language,
  value,
  onChange,
  className,
  extensions = [],
  placeholder,
  resizable = false,
  minHeight = 100,
  maxHeight = 600,
  storageKey,
}: FloatingCodeMirrorProps) {
  const [mounted, setMounted] = useState(false)
  const portalDivRef = useRef<HTMLDivElement | null>(null)

  const lastRectRef = useRef<{ l: number; t: number; w: number; h: number } | null>(null)
  const rafRef = useRef<number | null>(null)

  // Resize state
  const getPersistedHeight = useCallback(() => {
    if (resizable && storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`floating-codemirror-height-${storageKey}`)
      if (saved) {
        const height = parseInt(saved, 10)
        if (!isNaN(height) && height >= minHeight && height <= maxHeight) {
          return height
        }
      }
    }
    return initialHeight
  }, [resizable, storageKey, initialHeight, minHeight, maxHeight])

  const [currentHeight, setCurrentHeight] = useState(getPersistedHeight)
  const [isResizing, setIsResizing] = useState(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  // Height persistence
  useEffect(() => {
    if (resizable && storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`floating-codemirror-height-${storageKey}`, currentHeight.toString())
    }
  }, [currentHeight, resizable, storageKey])

  // Resize event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!resizable) return
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    startYRef.current = e.clientY
    startHeightRef.current = currentHeight
    // Prevent text selection during drag
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ns-resize'
  }, [resizable, currentHeight])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    e.preventDefault()
    const deltaY = e.clientY - startYRef.current
    const newHeight = Math.max(
      minHeight,
      Math.min(maxHeight, startHeightRef.current + deltaY)
    )
    
    setCurrentHeight(newHeight)
  }, [isResizing, minHeight, maxHeight])

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false)
      // Restore normal cursor and text selection
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Attach global mouse event listeners during resize
  useEffect(() => {
    if (isResizing) {
      // Add listeners to document and window for better event capture
      document.addEventListener('mousemove', handleMouseMove, { passive: false })
      document.addEventListener('mouseup', handleMouseUp, { passive: false })
      window.addEventListener('mouseup', handleMouseUp, { passive: false })
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('mouseup', handleMouseUp)
        // Ensure cursor is restored on cleanup
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

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
      <div 
        className="relative border rounded-md overflow-hidden bg-white"
        style={{ width: "100%", height: currentHeight }}
      >
        <div className="h-full">
          <CodeMirror
            value={value}
            height="100%"
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
        
        {/* Resize handle */}
        {resizable && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-2 cursor-row-resize",
              "flex items-center justify-center",
              "bg-transparent hover:bg-gray-100/50 transition-colors",
              "group",
              isResizing && "bg-blue-100/50"
            )}
            onMouseDown={handleMouseDown}
          >
            <GripHorizontal 
              className={cn(
                "w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity",
                isResizing && "opacity-100 text-blue-500"
              )} 
            />
          </div>
        )}
        
        {/* Resize overlay when dragging */}
        {isResizing && (
          <div className="fixed inset-0 z-[1001] cursor-row-resize" />
        )}
      </div>
    )
  }, [mounted, currentHeight, value, onChange, languageExtensions, extensions, placeholder, resizable, isResizing, handleMouseDown])

  if (!mounted || !portalDivRef.current) return null
  return createPortal(editor, portalDivRef.current)
}
