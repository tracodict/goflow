"use client"

import type React from "react"
import { useEffect } from "react"
import { useBuilderStoreContext } from "../../stores/pagebuilder/editor-context"
import { PageElement } from "./PageElement"
import { VerticalToolbar } from "./VerticalToolbar"

interface WorkspaceProps {
	rootElementId?: string
	panelId?: string
	tabId?: string
	onActivate?: (panelId: string, tabId: string) => void
}

export const PageWorkspace: React.FC<WorkspaceProps> = ({ 
	rootElementId = "page-root",
	panelId,
	tabId,
	onActivate
}) => {
	const store = useBuilderStoreContext()
	const { selectElement, setHoveredElement, isPreviewMode, selectedElementId, removeElement } = store()

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't delete elements if user is typing in an input field
			const target = e.target as HTMLElement
			const isInputField = target.tagName === 'INPUT' || 
			                     target.tagName === 'TEXTAREA' || 
			                     target.isContentEditable
			
			if (isInputField) {
				return // Let the input handle the key event
			}
			
			if ((e.key === "Delete" || e.key === "Backspace") && selectedElementId && selectedElementId !== "page-root" && !isPreviewMode) {
				e.preventDefault()
				removeElement(selectedElementId)
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [selectedElementId, isPreviewMode, removeElement])

	const handleWorkspaceClick = (e: React.MouseEvent) => {
		// Clear selection only if clicking on workspace itself
		if (e.target === e.currentTarget && !isPreviewMode) {
			selectElement(null)
		}
	}

	const handleMouseLeave = () => {
		if (!isPreviewMode) {
			setHoveredElement(null)
		}
	}

	const handleElementHover = (elementId: string) => {
		setHoveredElement(elementId)
	}

	const handleElementClick = (elementId: string) => {
		selectElement(elementId)
		// Auto-activate the parent tab when an element is selected
		if (onActivate && panelId && tabId) {
			onActivate(panelId, tabId)
		}
	}

	return (
		<div
				className="workspace-area group"
				style={{
					flex: 1,
					backgroundColor: "#ffffff",
					padding: "0px",
					overflow: "auto",
					position: "relative",
					minHeight: "100%",
				}}
				onClick={handleWorkspaceClick}
				onMouseLeave={handleMouseLeave}
				tabIndex={0}
			>
				<div className="h-full w-full">
					<div className="h-full w-full overflow-auto scrollbar-hide group-hover:scrollbar-default" style={{ height: '100%' }}>
						<PageElement elementId={rootElementId} onElementHover={handleElementHover} onElementClick={handleElementClick} />
					</div>
				</div>
				{/* Vertical toolbar moved to Builder so it can position relative to right panel */}
			</div>
	)
}
