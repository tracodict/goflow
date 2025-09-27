"use client"


import React from "react"
import { useBuilderStore } from "../../stores/pagebuilder/editor"
import { DataGrid } from "./DataGrid"

type PageElementProps = {
  elementId: string
  onElementClick?: (id: string) => void
  onElementHover?: (id: string) => void
}

import type { JSX } from "react/jsx-runtime"

const renderHTMLElement = (element: any) => {
  const TagName = element.tagName as keyof JSX.IntrinsicElements
  const combinedStyles = { ...element.styles }
  const attributes = { ...element.attributes }
  return {
    TagName,
    props: attributes,
    styles: combinedStyles,
    textContent: element.content,
  }
}

export const PageElement: React.FC<PageElementProps> = ({ elementId, onElementClick, onElementHover }) => {
  const {
    elements,
    selectedElementId,
    hoveredElementId,
    isPreviewMode,
    draggedElementId,
    setDraggedElement,
    moveElement,
    showContainerBorders,
    selectElement,
  } = useBuilderStore()

  const element = elements[elementId]
  if (!element) return null

  const { TagName, props, styles, textContent } = renderHTMLElement(element)
  const isSelected = selectedElementId === elementId
  const isHovered = hoveredElementId === elementId
  const isDragging = draggedElementId === elementId
  const isContainer = ["div", "section", "main", "article", "aside", "nav"].includes(element.tagName)

  const handleClick = (e: React.MouseEvent) => {
    if (isPreviewMode) return
    e.stopPropagation()
    selectElement(elementId)
    onElementClick?.(elementId)
  }

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (isPreviewMode) return
    e.stopPropagation()
    onElementHover?.(elementId)
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (isPreviewMode || elementId === "page-root") return
    e.dataTransfer.setData("text/plain", elementId)
    setDraggedElement(elementId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (isPreviewMode || !isContainer) return
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    if (isPreviewMode || !isContainer) return
    e.preventDefault()
    e.stopPropagation()

    const draggedId = e.dataTransfer.getData("text/plain")
    if (draggedId && draggedId !== elementId) {
      moveElement(draggedId, elementId)
    }
    setDraggedElement(null)
  }

  const handleDragEnd = () => {
    setDraggedElement(null)
  }

  const interactiveStyles = isPreviewMode
    ? {}
    : {
        outline: isSelected ? "2px solid #3b82f6" : isHovered ? "1px solid #60a5fa" : "none",
        outlineOffset: "-1px",
        cursor: "pointer",
      }

  const finalStyles = (() => {
    const baseStyles = { ...styles }
    if (isContainer && !isPreviewMode && showContainerBorders) {
      return {
        ...baseStyles,
        border: "2px dotted #d1d5db",
        borderRadius: "0px",
        ...interactiveStyles,
        position: "relative" as const,
        opacity: isDragging ? 0.5 : baseStyles.opacity || 1,
      }
    }
    return {
      ...baseStyles,
      ...interactiveStyles,
      position: "relative" as const,
      opacity: isDragging ? 0.5 : baseStyles.opacity || 1,
    }
  })()

  // Special handling for input, textarea, img
  if (TagName === "input") {
    return (
      <input
        id={elementId}
        {...props}
        style={finalStyles}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        value={textContent}
        readOnly
      />
    )
  }

  if (TagName === "textarea") {
    return (
      <textarea
        id={elementId}
        {...props}
        style={finalStyles}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        value={textContent}
        readOnly
      />
    )
  }

  if (TagName === "img") {
    return (
      <img
        id={elementId}
        {...props}
        style={finalStyles}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        src={textContent}
        alt=""
      />
    )
  }

  // Special handling for data-grid elements
  if (element.attributes?.["data-type"] === "data-grid") {
    return (
      <DataGrid
        queryName={element.attributes?.["data-query-name"]}
        autoRefresh={element.attributes?.["data-auto-refresh"] === "true"}
        style={finalStyles}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
      />
    )
  }

  // Recursively render children
  const hasChildren = element.childIds && element.childIds.length > 0
  const children = hasChildren
    ? element.childIds.map((childId) => (
        <PageElement
          key={childId}
          elementId={childId}
          onElementClick={onElementClick}
          onElementHover={onElementHover}
        />
      ))
    : null

  // For container elements, render both text content and children
  const content = isContainer
    ? [
        textContent && <span key="text-content">{textContent}</span>,
        ...(children as React.ReactNode[] || []),
      ].filter(Boolean)
    : textContent || children

  // For all other elements, use React.createElement
  return React.createElement(
    TagName,
    {
      id: elementId,
      ...props,
      style: finalStyles,
      onClick: handleClick,
      onMouseEnter: handleMouseEnter,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
      onDragEnd: handleDragEnd,
    },
    content
  )
}
