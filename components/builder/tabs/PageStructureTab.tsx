"use client"

import type React from "react"
import { useState } from "react"
import { useFocusedTabStore, useFocusedTabId, useFocusedTabState } from "../../../stores/pagebuilder/editor-context"

export const PageStructureTab: React.FC = () => {
	const focusedTabId = useFocusedTabId() // Track focused tab changes
	const store = useFocusedTabStore()
	
	// Use the safe hook that handles null store internally - always calls the same hooks
	const elements = useFocusedTabState((state) => state.elements, {})
	const selectedElementId = useFocusedTabState((state) => state.selectedElementId, null)
	const draggedElementId = useFocusedTabState((state) => state.draggedElementId, null)
	
	// Get actions from store
	const setDraggedElement = store.getState().setDraggedElement
	const removeElement = store.getState().removeElement
	const selectElement = store.getState().selectElement
	const moveElement = store.getState().moveElement
	
	const [dragOverElementId, setDragOverElementId] = useState<string | null>(null)

	const handleDragStart = (e: React.DragEvent, elementId: string) => {
		e.dataTransfer.setData("text/plain", elementId)
		setDraggedElement(elementId)
	}

	const handleDragOver = (e: React.DragEvent, elementId: string) => {
		e.preventDefault()
		setDragOverElementId(elementId)
	}

	const handleDragLeave = (e: React.DragEvent) => {
		// Only clear drag over if we're leaving the entire component
		const relatedTarget = e.relatedTarget as HTMLElement
		const currentTarget = e.currentTarget as HTMLElement
		if (!currentTarget.contains(relatedTarget)) {
			setDragOverElementId(null)
		}
	}

	const handleDrop = (e: React.DragEvent, targetElementId: string) => {
		e.preventDefault()
		e.stopPropagation()

		const draggedId = e.dataTransfer.getData("text/plain")
		if (draggedId && draggedId !== targetElementId) {
			const targetElement = elements[targetElementId]
			const draggedElement = elements[draggedId]
			
			// Allow drop if:
			// 1. Target is a container element, OR
			// 2. Target is a sibling (drop will insert after the target)
			const isTargetContainer = targetElement && ["div", "section", "main", "article", "aside", "nav"].includes(targetElement.tagName)
			
			if (isTargetContainer) {
				// Drop into container as child
				moveElement(draggedId, targetElementId)
			} else if (targetElement && targetElement.parentId) {
				// Drop as sibling - insert after target
				const parentElement = elements[targetElement.parentId]
				if (parentElement) {
					const targetIndex = parentElement.childIds.indexOf(targetElementId)
					moveElement(draggedId, targetElement.parentId, targetIndex + 1)
				}
			}
		}
		setDraggedElement(null)
	}

	const handleDragEnd = () => {
		setDraggedElement(null)
	}

	const handleTreeKeyDown = (e: React.KeyboardEvent, elementId: string) => {
		if (e.key === "Delete" && elementId !== "page-root") {
			e.preventDefault()
			e.stopPropagation()
			removeElement(elementId)
		}
	}

	// Helper to recursively render tree
	const renderTree = (id: string, depth = 0) => {
		const element = elements[id]
		if (!element) return null
		const isContainer = ["div", "section", "main", "article", "aside", "nav"].includes(element.tagName)
		const isDragging = draggedElementId === id

		return (
			<div
				key={id}
				draggable={id !== "page-root"}
				onDragStart={(e) => handleDragStart(e, id)}
				onDragOver={(e) => handleDragOver(e, id)}
				onDrop={(e) => handleDrop(e, id)}
				onDragEnd={handleDragEnd}
				onKeyDown={(e) => handleTreeKeyDown(e, id)}
				tabIndex={0}
				className={`pl-${depth * 4} py-1 flex items-center gap-2 rounded hover:bg-muted cursor-pointer ${
					selectedElementId === id ? "bg-primary/10 border-l-4 border-primary" : ""
				} ${isDragging ? "opacity-50" : ""} ${isContainer ? "border-l-2 border-dashed border-muted-foreground/30" : ""}`}
				onClick={() => selectElement(id)}
			>
				<span className="font-mono text-primary text-xs">{element.tagName}</span>
				<span className="text-muted-foreground text-xs">#{id}</span>
				{isContainer && element.childIds.length > 0 && (
					<span className="ml-2 text-muted-foreground text-xs">({element.childIds.length})</span>
				)}
			</div>
		)
	}

	// Recursive tree rendering for root
	const renderTreeRecursive = (id: string, depth = 0) => {
		const element = elements[id]
		if (!element) return null
		return (
			<div key={id}>
				{renderTree(id, depth)}
				{element.childIds.map((childId) => renderTreeRecursive(childId, depth + 1))}
			</div>
		)
	}

	return (
		<div className="h-full overflow-y-auto">
			{/* No header bar here, handled by panel shell */}
			<div className="p-4">
				<div className="text-xs">{renderTreeRecursive("page-root")}</div>
			</div>
		</div>
	)
}
