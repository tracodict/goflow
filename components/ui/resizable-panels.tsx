"use client"

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ResizablePanelsProps {
  children: [React.ReactNode, React.ReactNode]
  direction?: 'horizontal' | 'vertical'
  initialSplit?: number // percentage (0-100)
  minSize?: number // minimum percentage for first panel
  maxSize?: number // maximum percentage for first panel
  className?: string
  resizerClassName?: string
}

export function ResizablePanels({
  children,
  direction = 'vertical',
  initialSplit = 50,
  minSize = 10,
  maxSize = 90,
  className,
  resizerClassName
}: ResizablePanelsProps) {
  const [split, setSplit] = useState(initialSplit)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    
    let percentage: number
    if (direction === 'vertical') {
      const y = e.clientY - rect.top
      percentage = (y / rect.height) * 100
    } else {
      const x = e.clientX - rect.left
      percentage = (x / rect.width) * 100
    }

    // Clamp percentage within bounds
    const clampedPercentage = Math.min(Math.max(percentage, minSize), maxSize)
    setSplit(clampedPercentage)
  }, [isDragging, direction, minSize, maxSize])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'vertical' ? 'row-resize' : 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp, direction])

  const isVertical = direction === 'vertical'
  const firstPanelStyle = isVertical 
    ? { height: `${split}%` }
    : { width: `${split}%` }
  const secondPanelStyle = isVertical
    ? { height: `${100 - split}%` }
    : { width: `${100 - split}%` }

  return (
    <div 
      ref={containerRef}
      className={cn(
        'flex h-full',
        isVertical ? 'flex-col' : 'flex-row',
        className
      )}
    >
      {/* First Panel */}
      <div 
        style={firstPanelStyle}
        className="overflow-hidden"
      >
        {children[0]}
      </div>

      {/* Resizer */}
      <div
        className={cn(
          'bg-neutral-200 hover:bg-neutral-300 transition-colors duration-150 select-none',
          isVertical 
            ? 'h-1 cursor-row-resize hover:h-2 -my-0.5' 
            : 'w-1 cursor-col-resize hover:w-2 -mx-0.5',
          isDragging && (isVertical ? 'bg-blue-400 h-2' : 'bg-blue-400 w-2'),
          resizerClassName
        )}
        onMouseDown={handleMouseDown}
      />

      {/* Second Panel */}
      <div 
        style={secondPanelStyle}
        className="overflow-hidden"
      >
        {children[1]}
      </div>
    </div>
  )
}