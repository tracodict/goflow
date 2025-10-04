"use client"

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { GripHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

const DEFAULT_BASIC_SETUP = {
  lineNumbers: true,
  bracketMatching: true,
  closeBrackets: true,
  highlightActiveLine: true,
  indentOnInput: true,
} as const

export interface ResizableCodeMirrorProps {
  /** Current code value */
  value: string
  /** Called when code changes */
  onChange?: (value: string) => void
  /** Initial height in pixels */
  initialHeight?: number
  /** Minimum height in pixels */
  minHeight?: number
  /** Maximum height in pixels */
  maxHeight?: number
  /** CodeMirror extensions */
  extensions?: Extension[]
  /** Theme */
  theme?: string
  /** Basic setup options */
  basicSetup?: any
  /** Placeholder text */
  placeholder?: string
  /** Additional className for the container */
  className?: string
  /** Whether to show line numbers */
  lineNumbers?: boolean
  /** Whether to enable line wrapping */
  lineWrapping?: boolean
  /** Storage key for persisting height */
  storageKey?: string
  /** Whether to use flex-1 behavior (grow to fill container) */
  flex?: boolean
}

export function ResizableCodeMirror({
  value,
  onChange,
  initialHeight = 200,
  minHeight = 100,
  maxHeight = 600,
  extensions = [],
  theme = "light",
  basicSetup = DEFAULT_BASIC_SETUP,
  placeholder,
  className,
  storageKey,
  flex = false,
  ...props
}: ResizableCodeMirrorProps) {
  // Load persisted height or use initial height
  const getInitialHeight = useCallback(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`codemirror-height-${storageKey}`)
      if (saved) {
        const height = parseInt(saved, 10)
        if (!isNaN(height) && height >= minHeight && height <= maxHeight) {
          return height
        }
      }
    }
    return initialHeight
  }, [storageKey, initialHeight, minHeight, maxHeight])

  const [height, setHeight] = useState(getInitialHeight)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  // Persist height changes
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`codemirror-height-${storageKey}`, height.toString())
    }
  }, [height, storageKey])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startYRef.current = e.clientY
    startHeightRef.current = height
    // Prevent text selection during drag
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ns-resize'
  }, [height])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    e.preventDefault()
    const deltaY = e.clientY - startYRef.current
    const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + deltaY))
    setHeight(newHeight)
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
      // Add listeners to document to catch events even when mouse leaves the component
      document.addEventListener('mousemove', handleMouseMove, { passive: false })
      document.addEventListener('mouseup', handleMouseUp, { passive: false })
      
      // Also add mouseup to window to catch cases where mouse leaves the browser
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



  // Handle CodeMirror editor creation
  const handleEditorDidCreate = useCallback((view: EditorView) => {
    editorViewRef.current = view
  }, [])

  // Ask CodeMirror to re-measure when height changes
  useEffect(() => {
    if (editorViewRef.current) {
      // Invalidate measure and reflow editor
      try {
        ;(editorViewRef.current as any).requestMeasure?.()
      } catch {}
    }
  }, [height])

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative border rounded-md overflow-hidden bg-white",
        flex && "flex-1 min-h-0",
        className
      )}
      style={flex ? { minHeight: `${height}px` } : { height: `${height}px` }}
    >
      <div 
        style={{ height: `${height - 4}px` }}
      >
        <CodeMirror
          value={value}
          height={`${height - 4}px`}
          theme={theme as any}
          extensions={extensions}
          basicSetup={basicSetup}
          onChange={onChange}
          placeholder={placeholder}
          onCreateEditor={handleEditorDidCreate}
          {...props}
        />
      </div>
      
      {/* Resize handle */}
      <div
        data-resize-handle="true"
        className={cn(
          "absolute bottom-0 left-0 right-0 h-1 cursor-row-resize",
          "flex items-center justify-center",
          "bg-transparent hover:bg-gray-100/50 transition-colors",
          "group",
          isResizing && "bg-blue-100/50"
        )}
        onMouseDown={handleMouseDown}
      >
        <GripHorizontal 
          className={cn(
            "w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity",
            isResizing && "opacity-100 text-blue-500"
          )} 
        />
      </div>
      
      {/* Resize overlay when dragging - only show during active dragging */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-row-resize pointer-events-none" />
      )}
    </div>
  )
}