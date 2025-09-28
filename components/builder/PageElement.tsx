"use client"

import React from "react"
import { useBuilderStore } from "../../stores/pagebuilder/editor"


// Import vComponents to ensure all renderers are registered
import { componentRendererRegistry } from "../../vComponents"

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
        userSelect: "none" as const,
        pointerEvents: "auto" as const,
      }

  const finalStyles = (() => {
    const baseStyles = { ...styles }
    if (isContainer && !isPreviewMode && showContainerBorders) {
      // Use specific border properties instead of shorthand to avoid conflicts
      const containerBorderStyles = {
        borderTopWidth: "2px",
        borderRightWidth: "2px", 
        borderBottomWidth: "2px",
        borderLeftWidth: "2px",
        borderTopStyle: "dotted",
        borderRightStyle: "dotted",
        borderBottomStyle: "dotted", 
        borderLeftStyle: "dotted",
        borderTopColor: "#d1d5db",
        borderRightColor: "#d1d5db",
        borderBottomColor: "#d1d5db",
        borderLeftColor: "#d1d5db",
        borderRadius: "0px",
      }
      return {
        ...baseStyles,
        ...containerBorderStyles,
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



  // Check for legacy data-type attributes and convert to data-component-type
  const legacyType = element.attributes?.["data-type"]
  const componentType = element.attributes?.["data-component-type"] || 
    (legacyType === "enhanced-navigation-menu" ? "NavigationMenu" :
     legacyType === "data-grid" ? "data-grid" :
     legacyType === "s3-explorer" ? "s3-explorer" : legacyType)

  // Dynamic vComponent rendering using the component registry
  if (componentType && componentRendererRegistry.hasRenderer(componentType)) {
    const renderer = componentRendererRegistry.getRenderer(componentType)
    if (renderer) {
      const ComponentClass = renderer.getComponent()
      
      // Prepare props for the component
      const componentProps = {
        "data-element-id": elementId,
        className: element.attributes?.class,
        style: isPreviewMode ? styles : { ...styles, ...interactiveStyles },
        onClick: isPreviewMode ? undefined : handleClick,
        onMouseEnter: isPreviewMode ? undefined : handleMouseEnter,
        onDragStart: isPreviewMode ? undefined : handleDragStart,
        onDragOver: isPreviewMode ? undefined : handleDragOver,
        onDrop: isPreviewMode ? undefined : handleDrop,
        onDragEnd: isPreviewMode ? undefined : handleDragEnd,
        draggable: !isPreviewMode && elementId !== "page-root",
        ...element.attributes
      }
      
      return (
        <ComponentClass {...componentProps}>
          {textContent || componentType}
        </ComponentClass>
      )
    }
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

	// Only filter interactive event handlers while preserving all other props
	const filteredProps = isPreviewMode
		? props
		: {
				...props,
				// Override only interactive event handlers in editor mode
				onClick: undefined,
				onDoubleClick: undefined,
				onMouseDown: undefined,
				onMouseUp: undefined,
				onMouseMove: undefined,
				onDragStart: undefined,
				onDrag: undefined,
				onDragEnd: undefined,
				onDrop: undefined,
				onDragOver: undefined,
				onDragEnter: undefined,
				onDragLeave: undefined,
				onTouchStart: undefined,
				onTouchMove: undefined,
				onTouchEnd: undefined,
				onPointerDown: undefined,
				onPointerMove: undefined,
				onPointerUp: undefined
		}

  // Special handling for iframe elements (YouTube, etc.)
  if (TagName === "iframe") {
    return (
      <div
        id={`${elementId}-wrapper`}
        style={{...finalStyles, ...interactiveStyles, position: "relative"}}
        onClick={isPreviewMode ? undefined : handleClick}
        onMouseEnter={isPreviewMode ? undefined : handleMouseEnter}
        onDragStart={isPreviewMode ? undefined : handleDragStart}
        onDragOver={isPreviewMode ? undefined : handleDragOver}
        onDrop={isPreviewMode ? undefined : handleDrop}
        onDragEnd={isPreviewMode ? undefined : handleDragEnd}
        draggable={!isPreviewMode && elementId !== "page-root"}
      >
        <iframe
          id={elementId}
          {...filteredProps}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            pointerEvents: isPreviewMode ? "auto" : "none"
          }}
          src={props.src || textContent}
        />
        {!isPreviewMode && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "transparent",
              cursor: "pointer",
              zIndex: 1
            }}
          />
        )}
      </div>
    )
  }

  // For all other elements, use React.createElement
  return React.createElement(
    TagName,
    {
      id: elementId,
      ...filteredProps,
      style: {...finalStyles, ...interactiveStyles},
      onClick: isPreviewMode ? filteredProps.onClick : handleClick,
      onMouseEnter: isPreviewMode ? filteredProps.onMouseEnter : handleMouseEnter,
      onDragStart: isPreviewMode ? filteredProps.onDragStart : handleDragStart,
      onDragOver: isPreviewMode ? filteredProps.onDragOver : handleDragOver,
      onDrop: isPreviewMode ? filteredProps.onDrop : handleDrop,
      onDragEnd: isPreviewMode ? filteredProps.onDragEnd : handleDragEnd,
      draggable: !isPreviewMode && elementId !== "page-root",
    },
    content
  )
}
