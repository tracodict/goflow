"use client"

import React, { useState, useEffect } from "react"
import { useFocusedTabStore, useFocusedTabId } from "../../../stores/pagebuilder/editor-context"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../ui/accordion"

type SpaceSVGProps = {
	styles: Record<string, string>;
	onEdit: (property: string, value?: string) => void;
	activeProperty?: string | null;
};

const SpaceSVG: React.FC<SpaceSVGProps> = ({ styles, onEdit, activeProperty }) => {
	const getValueDisplay = (value: string | undefined) => {
		if (!value || value === "0" || value === "0px") return "0"
		return value.replace("px", "")
	}

	const marginTop = getValueDisplay(styles.marginTop)
	const marginRight = getValueDisplay(styles.marginRight)
	const marginBottom = getValueDisplay(styles.marginBottom)
	const marginLeft = getValueDisplay(styles.marginLeft)
	const paddingTop = getValueDisplay(styles.paddingTop)
	const paddingRight = getValueDisplay(styles.paddingRight)
	const paddingBottom = getValueDisplay(styles.paddingBottom)
	const paddingLeft = getValueDisplay(styles.paddingLeft)

	return (
		<div className="flex justify-center p-4">
			<svg
				width="200"
				height="160"
				viewBox="0 0 200 160"
				className="border border-border rounded"
				style={{ background: "hsl(var(--background))" }}
			>
				<rect
					x="10"
					y="10"
					width="180"
					height="140"
					fill="rgb(254 215 170 / 0.4)"
					stroke="rgb(251 146 60)"
					strokeWidth="1"
					strokeDasharray="2,2"
					rx="4"
				/>

				{/* Margin labels */}
				<text x="100" y="25" textAnchor="middle" className="fill-orange-600 text-xs font-mono">
					{marginTop}
				</text>
				<text
					x="25"
					y="85"
					textAnchor="middle"
					className="fill-orange-600 text-xs font-mono"
					transform="rotate(-90, 25, 85)"
				>
					{marginLeft}
				</text>
				<text
					x="175"
					y="85"
					textAnchor="middle"
					className="fill-orange-600 text-xs font-mono"
					transform="rotate(90, 175, 85)"
				>
					{marginRight}
				</text>
				<text x="100" y="145" textAnchor="middle" className="fill-orange-600 text-xs font-mono">
					{marginBottom}
				</text>

				<rect
					x="30"
					y="30"
					width="140"
					height="100"
					fill="rgb(254 240 138 / 0.4)"
					stroke="rgb(250 204 21)"
					strokeWidth="2"
					rx="2"
				/>

				<rect
					x="50"
					y="50"
					width="100"
					height="60"
					fill="rgb(187 247 208 / 0.4)"
					stroke="rgb(34 197 94)"
					strokeWidth="1"
					strokeDasharray="2,2"
					rx="2"
				/>

				{/* Padding labels */}
				<text x="100" y="45" textAnchor="middle" className="fill-green-600 text-xs font-mono">
					{paddingTop}
				</text>
				<text
					x="45"
					y="85"
					textAnchor="middle"
					className="fill-green-600 text-xs font-mono"
					transform="rotate(-90, 45, 85)"
				>
					{paddingLeft}
				</text>
				<text
					x="155"
					y="85"
					textAnchor="middle"
					className="fill-green-600 text-xs font-mono"
					transform="rotate(90, 155, 85)"
				>
					{paddingRight}
				</text>
				<text x="100" y="125" textAnchor="middle" className="fill-green-600 text-xs font-mono">
					{paddingBottom}
				</text>

				<rect
					x="70"
					y="70"
					width="60"
					height="20"
					fill="rgb(191 219 254 / 0.6)"
					stroke="rgb(59 130 246)"
					strokeWidth="1"
					rx="1"
				/>

				{/* Content label */}
				<text x="100" y="83" textAnchor="middle" className="fill-blue-600 text-xs font-mono">
					content
				</text>

				{/* Interactive click areas */}
				<rect
					x="30"
					y="10"
					width="140"
					height="20"
					fill="transparent"
					className="cursor-pointer"
					onClick={() => onEdit("marginTop")}
				/>
				<rect
					x="10"
					y="30"
					width="20"
					height="100"
					fill="transparent"
					className="cursor-pointer"
					onClick={() => onEdit("marginLeft")}
				/>
				<rect
					x="170"
					y="30"
					width="20"
					height="100"
					fill="transparent"
					className="cursor-pointer"
					onClick={() => onEdit("marginRight")}
				/>
				<rect
					x="30"
					y="130"
					width="140"
					height="20"
					fill="transparent"
					className="cursor-pointer"
					onClick={() => onEdit("marginBottom")}
				/>

				<rect
					x="50"
					y="30"
					width="100"
					height="20"
					fill="transparent"
					className="cursor-pointer"
					onClick={() => onEdit("paddingTop")}
				/>
				<rect
					x="30"
					y="50"
					width="20"
					height="60"
					fill="transparent"
					className="cursor-pointer"
					onClick={() => onEdit("paddingLeft")}
				/>
				<rect
					x="150"
					y="50"
					width="20"
					height="60"
					fill="transparent"
					className="cursor-pointer"
					onClick={() => onEdit("paddingRight")}
				/>
				<rect
					x="50"
					y="110"
					width="100"
					height="20"
					fill="transparent"
					className="cursor-pointer"
					onClick={() => onEdit("paddingBottom")}
				/>

				<g transform="translate(10, 155)">
					<rect
						x="0"
						y="0"
						width="8"
						height="8"
						fill="rgb(254 215 170 / 0.4)"
						stroke="rgb(251 146 60)"
						strokeWidth="0.5"
					/>
					<text x="12" y="7" className="fill-current text-xs">
						margin
					</text>

					<rect
						x="50"
						y="0"
						width="8"
						height="8"
						fill="rgb(187 247 208 / 0.4)"
						stroke="rgb(34 197 94)"
						strokeWidth="0.5"
					/>
					<text x="62" y="7" className="fill-current text-xs">
						padding
					</text>

					<rect
						x="105"
						y="0"
						width="8"
						height="8"
						fill="rgb(191 219 254 / 0.6)"
						stroke="rgb(59 130 246)"
						strokeWidth="0.5"
					/>
					<text x="117" y="7" className="fill-current text-xs">
						content
					</text>
				</g>
			</svg>
		</div>
	)
}

const SIZE_PROPERTIES = [
	{ key: "width", label: "Width", type: "text", placeholder: "e.g. 100px" },
	{ key: "height", label: "Height", type: "text", placeholder: "e.g. 100px" },
	{ key: "minWidth", label: "Min Width", type: "text", placeholder: "e.g. 0" },
	{ key: "minHeight", label: "Min Height", type: "text", placeholder: "e.g. 0" },
	{ key: "maxWidth", label: "Max Width", type: "text", placeholder: "e.g. none" },
	{ key: "maxHeight", label: "Max Height", type: "text", placeholder: "e.g. none" },
	{ key: "aspectRatio", label: "Aspect Ratio", type: "text", placeholder: "e.g. 16/9" },
]

const SPACE_PROPERTIES = [
	{ key: "marginTop", label: "Margin Top", type: "text", placeholder: "e.g. 8px" },
	{ key: "marginRight", label: "Margin Right", type: "text", placeholder: "e.g. 8px" },
	{ key: "marginBottom", label: "Margin Bottom", type: "text", placeholder: "e.g. 8px" },
	{ key: "marginLeft", label: "Margin Left", type: "text", placeholder: "e.g. 8px" },
	{ key: "paddingTop", label: "Padding Top", type: "text", placeholder: "e.g. 8px" },
	{ key: "paddingRight", label: "Padding Right", type: "text", placeholder: "e.g. 8px" },
	{ key: "paddingBottom", label: "Padding Bottom", type: "text", placeholder: "e.g. 8px" },
	{ key: "paddingLeft", label: "Padding Left", type: "text", placeholder: "e.g. 8px" },
]

export const StylesTab: React.FC = () => {
	const focusedTabId = useFocusedTabId()
	const store = useFocusedTabStore()
	const [elements, setElements] = useState<Record<string, any>>({})
	const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
	
	// Subscribe to store changes
	useEffect(() => {
		if (!store) {
			setElements({})
			setSelectedElementId(null)
			return
		}
		
		// Get initial values
		setElements(store.getState().elements)
		setSelectedElementId(store.getState().selectedElementId)
		
		// Subscribe to changes
		let prevElements = store.getState().elements
		let prevSelectedId = store.getState().selectedElementId
		
		const unsubscribe = store.subscribe(() => {
			const state = store.getState()
			if (state.elements !== prevElements) {
				prevElements = state.elements
				setElements(state.elements)
			}
			if (state.selectedElementId !== prevSelectedId) {
				prevSelectedId = state.selectedElementId
				setSelectedElementId(state.selectedElementId)
			}
		})
		
		return unsubscribe
	}, [store, focusedTabId])
	
	const updateElement = store.getState().updateElement

	const selectedElement = selectedElementId ? elements[selectedElementId] : null

	if (!selectedElement) return null

		const handleStyleUpdate = (property: string, value?: string) => {
			const updatedStyles = {
				...selectedElement.styles,
				[property]: value ?? "",
			}
			updateElement(selectedElement.id, { styles: updatedStyles })
		}

	return (
		<div className="h-full overflow-y-auto">
			{/* No header bar here, handled by panel shell */}
			<Accordion type="multiple" className="px-4 py-2">
				{/* Layout section */}
				<AccordionItem value="layout">
					<AccordionTrigger className="text-left font-semibold text-foreground">Layout</AccordionTrigger>
					<AccordionContent className="pt-4">
						<label className="block text-sm font-medium mb-1 text-foreground">Display Type</label>
						<select
							value={selectedElement.styles.display || "block"}
							onChange={(e) => {
								const display = e.target.value
								handleStyleUpdate("display", display)
								if (display === "block" && !selectedElement.styles.width) {
									handleStyleUpdate("width", "auto")
								}
							}}
							className="w-full p-2 border border-input rounded bg-background text-foreground text-sm mb-2"
						>
							<option value="block">Block</option>
							<option value="inline">Inline</option>
							<option value="flex">Flex</option>
							<option value="inline-flex">Inline Flex</option>
							<option value="grid">Grid</option>
						</select>

						{/* Flex Controls */}
						{(selectedElement.styles.display === "flex" || selectedElement.styles.display === "inline-flex") && (
							<div className="space-y-2">
								<label className="block text-sm font-medium mb-1 text-foreground">Flex Direction</label>
								<select
									value={selectedElement.styles.flexDirection || "row"}
									onChange={(e) => handleStyleUpdate("flexDirection", e.target.value)}
									className="w-full p-2 border border-input rounded bg-background text-foreground text-sm"
								>
									<option value="row">Row</option>
									<option value="column">Column</option>
									<option value="row-reverse">Row Reverse</option>
									<option value="column-reverse">Column Reverse</option>
								</select>
								<label className="block text-sm font-medium mb-1 text-foreground">Justify Content</label>
								<select
									value={selectedElement.styles.justifyContent || "flex-start"}
									onChange={(e) => handleStyleUpdate("justifyContent", e.target.value)}
									className="w-full p-2 border border-input rounded bg-background text-foreground text-sm"
								>
									<option value="flex-start">Flex Start</option>
									<option value="center">Center</option>
									<option value="flex-end">Flex End</option>
									<option value="space-between">Space Between</option>
									<option value="space-around">Space Around</option>
									<option value="space-evenly">Space Evenly</option>
								</select>
								<label className="block text-sm font-medium mb-1 text-foreground">Align Items</label>
								<select
									value={selectedElement.styles.alignItems || "stretch"}
									onChange={(e) => handleStyleUpdate("alignItems", e.target.value)}
									className="w-full p-2 border border-input rounded bg-background text-foreground text-sm"
								>
									<option value="stretch">Stretch</option>
									<option value="flex-start">Flex Start</option>
									<option value="center">Center</option>
									<option value="flex-end">Flex End</option>
									<option value="baseline">Baseline</option>
								</select>
								<label className="block text-sm font-medium mb-1 text-foreground">Flex Wrap</label>
								<select
									value={selectedElement.styles.flexWrap || "nowrap"}
									onChange={(e) => handleStyleUpdate("flexWrap", e.target.value)}
									className="w-full p-2 border border-input rounded bg-background text-foreground text-sm"
								>
									<option value="nowrap">No Wrap</option>
									<option value="wrap">Wrap</option>
									<option value="wrap-reverse">Wrap Reverse</option>
								</select>
							</div>
						)}

						{/* Grid Controls */}
						{selectedElement.styles.display === "grid" && (
							<div className="space-y-2">
								<label className="block text-sm font-medium mb-1 text-foreground">Grid Template Columns</label>
								<input
									type="text"
									value={selectedElement.styles.gridTemplateColumns || ""}
									onChange={(e) => handleStyleUpdate("gridTemplateColumns", e.target.value)}
									className="w-full p-2 border border-input rounded bg-background text-foreground text-sm"
									placeholder="e.g. repeat(3, 1fr) or 200px 1fr 100px"
								/>
								<label className="block text-sm font-medium mb-1 text-foreground">Grid Template Rows</label>
								<input
									type="text"
									value={selectedElement.styles.gridTemplateRows || ""}
									onChange={(e) => handleStyleUpdate("gridTemplateRows", e.target.value)}
									className="w-full p-2 border border-input rounded bg-background text-foreground text-sm"
									placeholder="e.g. auto 1fr auto"
								/>
								<label className="block text-sm font-medium mb-1 text-foreground">Grid Gap</label>
								<input
									type="text"
									value={selectedElement.styles.gap || ""}
									onChange={(e) => handleStyleUpdate("gap", e.target.value)}
									className="w-full p-2 border border-input rounded bg-background text-foreground text-sm"
									placeholder="e.g. 16px or 1rem"
								/>
								<label className="block text-sm font-medium mb-1 text-foreground">Grid Auto Flow</label>
								<select
									value={selectedElement.styles.gridAutoFlow || "row"}
									onChange={(e) => handleStyleUpdate("gridAutoFlow", e.target.value)}
									className="w-full p-2 border border-input rounded bg-background text-foreground text-sm"
								>
									<option value="row">Row</option>
									<option value="column">Column</option>
									<option value="dense">Dense</option>
									<option value="row dense">Row Dense</option>
									<option value="column dense">Column Dense</option>
								</select>
							</div>
						)}
					</AccordionContent>
				</AccordionItem>

				{/* Size Section */}
				<AccordionItem value="size">
					<AccordionTrigger className="text-left font-semibold text-foreground">Size</AccordionTrigger>
					<AccordionContent className="pt-4">
						<div className="grid grid-cols-2 gap-3">
							{SIZE_PROPERTIES.map(({ key, label, type, placeholder }) => (
								<div key={key} className="flex flex-col gap-1">
									<label className="text-xs font-medium text-muted-foreground">{label}</label>
									<input
										type={type}
										value={selectedElement.styles[key] || ""}
										onChange={(e) => handleStyleUpdate(key, e.target.value)}
										placeholder={placeholder}
										className="h-8 px-2 border border-input rounded text-xs bg-background text-foreground"
									/>
								</div>
							))}
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Space Section with interactive SVG */}
				<AccordionItem value="space">
					<AccordionTrigger className="text-left font-semibold text-foreground">Space</AccordionTrigger>
					<AccordionContent className="pt-4">
						<div className="mb-4">
							<SpaceSVG styles={selectedElement.styles} onEdit={handleStyleUpdate} activeProperty={null} />
						</div>
						<div className="grid grid-cols-2 gap-3">
							{SPACE_PROPERTIES.map(({ key, label, type, placeholder }) => (
								<div key={key} className="flex flex-col gap-1">
									<label className="text-xs font-medium text-muted-foreground">{label}</label>
									<input
										id={key + "-input"}
										type={type}
										value={selectedElement.styles[key] || ""}
										onChange={(e) => handleStyleUpdate(key, e.target.value)}
										placeholder={placeholder}
										className="h-8 px-2 border border-input rounded text-xs bg-background text-foreground"
									/>
								</div>
							))}
						</div>
					</AccordionContent>
				</AccordionItem>

				{/* Typography */}
				<AccordionItem value="typography">
					<AccordionTrigger className="text-left font-semibold text-foreground">Typography</AccordionTrigger>
					<AccordionContent className="pt-4">
						<label className="block text-sm font-medium mb-1 text-foreground">Font Size</label>
						<input
							type="text"
							value={selectedElement.styles.fontSize || ""}
							onChange={(e) => handleStyleUpdate("fontSize", e.target.value)}
							className="w-full p-2 border border-input rounded text-xs bg-background text-foreground mb-2"
							placeholder="e.g. 16px"
						/>
						<label className="block text-sm font-medium mb-1 text-foreground">Text Color</label>
						<input
							type="color"
							value={selectedElement.styles.color || "#111827"}
							onChange={(e) => handleStyleUpdate("color", e.target.value)}
							className="w-16 h-8 border border-input rounded bg-background text-sm"
						/>
					</AccordionContent>
				</AccordionItem>

				{/* Background Section */}
				<AccordionItem value="background">
					<AccordionTrigger className="text-left font-semibold text-foreground">Background</AccordionTrigger>
					<AccordionContent className="pt-4">
						<label className="block text-sm font-medium mb-1 text-foreground">Background Color</label>
						<input
							type="color"
							value={selectedElement.styles.backgroundColor || "#f9fafb"}
							onChange={(e) => handleStyleUpdate("backgroundColor", e.target.value)}
							className="w-16 h-8 border border-input rounded bg-background text-sm"
						/>
					</AccordionContent>
				</AccordionItem>

				{/* Border Section */}
				<AccordionItem value="border">
					<AccordionTrigger className="text-left font-semibold text-foreground">Border</AccordionTrigger>
					<AccordionContent className="pt-4">
						<label className="block text-sm font-medium mb-1 text-foreground">Border</label>
						<input
							type="text"
							value={selectedElement.styles.border || ""}
							onChange={(e) => handleStyleUpdate("border", e.target.value)}
							className="w-full p-2 border border-input rounded text-xs bg-background text-foreground mb-2"
							placeholder="e.g. 1px solid #e5e7eb"
						/>
						<label className="block text-sm font-medium mb-1 text-foreground">Border Radius</label>
						<input
							type="text"
							value={selectedElement.styles.borderRadius || ""}
							onChange={(e) => handleStyleUpdate("borderRadius", e.target.value)}
							className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
							placeholder="e.g. 8px"
						/>
					</AccordionContent>
				</AccordionItem>

				{/* Advanced Section */}
				<AccordionItem value="advanced">
					<AccordionTrigger className="text-left font-semibold text-foreground">Advanced</AccordionTrigger>
					<AccordionContent className="pt-4">
						<label className="block text-sm font-medium mb-1 text-foreground">Box Shadow</label>
						<input
							type="text"
							value={selectedElement.styles.boxShadow || ""}
							onChange={(e) => handleStyleUpdate("boxShadow", e.target.value)}
							className="w-full p-2 border border-input rounded text-xs bg-background text-foreground mb-2"
							placeholder="e.g. 0 2px 8px rgba(0,0,0,0.1)"
						/>
						<label className="block text-sm font-medium mb-1 text-foreground">Opacity</label>
						<input
							type="text"
							value={selectedElement.styles.opacity || ""}
							onChange={(e) => handleStyleUpdate("opacity", e.target.value)}
							className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
							placeholder="e.g. 1"
						/>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	)
}
