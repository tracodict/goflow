"use client"

import React, { useRef, useState, useEffect, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'

export interface ScriptEditorProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  minHeight?: number
  maxHeight?: number
  initialHeight?: number
  className?: string
}

/**
 * Resizable CodeMirror-based script editor for property panel script fields.
 * - Vertical resize via drag handle
 * - Controlled value
 */
export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  value,
  onChange,
  placeholder,
  minHeight = 120,
  maxHeight = 600,
  initialHeight = 180,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(initialHeight)
  const [isResizing, setIsResizing] = useState(false)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newHeight = Math.min(Math.max(e.clientY - rect.top, minHeight), maxHeight)
    setHeight(newHeight)
  }, [isResizing, minHeight, maxHeight])

  const stopResize = useCallback(() => setIsResizing(false), [])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', stopResize)
      return () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', stopResize)
      }
    }
  }, [isResizing, onMouseMove, stopResize])

  return (
    <div className={`border rounded-md bg-background relative group ${className}`} ref={containerRef} style={{ userSelect: isResizing ? 'none' : 'auto' }}>
      <CodeMirror
        value={value || ''}
        height={height + 'px'}
        basicSetup={{ lineNumbers: true, foldGutter: true }}
        extensions={[javascript({ jsx: true, typescript: true })]}
        onChange={(val) => onChange(val)}
      />
      {placeholder && !value && (
        <div className="pointer-events-none absolute top-2 left-3 text-xs text-muted-foreground/50 select-none">
          {placeholder}
        </div>
      )}
      <div
        onMouseDown={startResize}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-transparent group-hover:bg-muted/40 transition-colors"
        title="Drag to resize"
      />
    </div>
  )
}

export default ScriptEditor