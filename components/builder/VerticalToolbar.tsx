"use client"


import type React from "react"
import { Button } from "../ui/button"
import { Eye, Square, ZoomIn, ZoomOut } from 'lucide-react'
import { useBuilderStore } from "../../stores/pagebuilder/editor"

export const VerticalToolbar: React.FC<{ leftOffset?: number; rightOffset?: number; bottomOffset?: number }> = ({ leftOffset, rightOffset = 24, bottomOffset = 24 }) => {
	const { isPreviewMode, togglePreviewMode, showContainerBorders, toggleContainerBorders, canvasScale, setCanvasScale } = useBuilderStore()

	const containerStyle: React.CSSProperties = {
		position: 'absolute',
		left: typeof leftOffset === 'number' ? `${leftOffset}px` : undefined,
		right: typeof leftOffset === 'number' ? undefined : (typeof rightOffset === 'number' ? `${rightOffset}px` : rightOffset),
		bottom: typeof bottomOffset === 'number' ? `${bottomOffset}px` : bottomOffset,
		zIndex: 10,
		pointerEvents: 'auto',
	}

	const controlClass = 'w-8 h-8 flex items-center justify-center rounded bg-white border border-border shadow-sm hover:bg-neutral-50'

	return (
		<div style={containerStyle} aria-label="Vertical toolbar">
			<div className="flex flex-col items-center gap-2 p-1 rounded-md bg-transparent">
				<button onClick={togglePreviewMode} title={isPreviewMode ? 'Exit Preview' : 'Preview'} className={controlClass} aria-pressed={isPreviewMode}>
					<Eye className="h-4 w-4" />
				</button>

				<button onClick={toggleContainerBorders} title="Toggle Container Borders" className={controlClass} aria-pressed={showContainerBorders}>
					<Square className="h-4 w-4" />
				</button>

				<div className="flex flex-col items-center gap-2 mt-1">
					<button
						onClick={() => setCanvasScale(Math.min(2, +(canvasScale + 0.05).toFixed(2)))}
						title="Zoom in"
						className={controlClass}
						aria-label="Zoom in"
					>
						<ZoomIn className="h-4 w-4" />
					</button>

					<button
						onClick={() => setCanvasScale(Math.max(0.5, +(canvasScale - 0.05).toFixed(2)))}
						title="Zoom out"
						className={controlClass}
						aria-label="Zoom out"
					>
						<ZoomOut className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	)
}
