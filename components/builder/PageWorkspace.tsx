"use client"

import type React from "react"
import { useEffect } from "react"
import { useBuilderStore } from "../../stores/pagebuilder/editor"
import { PageElement } from "./PageElement"
import { VerticalToolbar } from "./VerticalToolbar"

interface WorkspaceProps {
	rootElementId?: string
}

export const PageWorkspace: React.FC<WorkspaceProps> = ({ rootElementId = "page-root" }) => {
	const { selectElement, setHoveredElement, isPreviewMode, selectedElementId, removeElement } = useBuilderStore()

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
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
	}

	return (
		<div
				className="workspace-area group"
				style={{
					flex: 1,
					backgroundColor: "#ffffff",
					padding: "0px",
					overflow: "visible",
					position: "relative",
					minHeight: "100%",
				}}
				onClick={handleWorkspaceClick}
				onMouseLeave={handleMouseLeave}
				tabIndex={0}
			>
				<div className="w-full">
					<div className="w-full">
						<PageElement elementId={rootElementId} onElementHover={handleElementHover} onElementClick={handleElementClick} />
					</div>
				</div>
				{/* Vertical toolbar moved to Builder so it can position relative to right panel */}
			</div>
	)
}
