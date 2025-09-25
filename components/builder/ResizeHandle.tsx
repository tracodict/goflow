"use client"

import React, { useState, useCallback } from "react"
import { GripVertical } from "lucide-react"

interface ResizeHandleProps {
	direction: "left" | "right"
	onResize: (delta: number) => void
	className?: string
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ direction, onResize, className = "" }) => {
	const [isDragging, setIsDragging] = useState(false)
	const [startX, setStartX] = useState(0)

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		setIsDragging(true)
		setStartX(e.clientX)
		e.preventDefault()
	}, [])

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging) return

			const delta = e.clientX - startX
			const adjustedDelta = direction === "left" ? delta : -delta
			onResize(adjustedDelta)
			setStartX(e.clientX)
		},
		[isDragging, startX, direction, onResize],
	)

	const handleMouseUp = useCallback(() => {
		setIsDragging(false)
	}, [])

	React.useEffect(() => {
		if (isDragging) {
			document.addEventListener("mousemove", handleMouseMove)
			document.addEventListener("mouseup", handleMouseUp)
			document.body.style.cursor = "col-resize"
			document.body.style.userSelect = "none"

			return () => {
				document.removeEventListener("mousemove", handleMouseMove)
				document.removeEventListener("mouseup", handleMouseUp)
				document.body.style.cursor = ""
				document.body.style.userSelect = ""
			}
		}
	}, [isDragging, handleMouseMove, handleMouseUp])

	return (
			<div
				role="separator"
				aria-orientation="vertical"
				title="Drag to resize"
				className={`absolute ${direction === 'left' ? 'right-[-6px]' : 'left-[-6px]'} top-0 z-50 h-full w-2 cursor-col-resize ${className}`}
				onMouseDown={handleMouseDown}
				style={{ minWidth: "8px" }}
			>
				{/* visual knob, non-interactive so the parent receives events */}
				<div className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-neutral-200 p-0.5">
					<GripVertical className="h-3 w-3 text-neutral-500" />
				</div>
			</div>
	)
}
