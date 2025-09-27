// ...existing code...

"use client"

import type React from "react"
import { useBuilderStore } from "../../../stores/pagebuilder/editor"
import { useSavedQueriesStore } from "../../../stores/saved-queries"
import { useEffect } from "react"

export const PropertiesTab: React.FC = () => {
	const { elements, selectedElementId, updateElement } = useBuilderStore()
	const { queries, hydrated, hydrate } = useSavedQueriesStore()
	const selectedElement = selectedElementId ? elements[selectedElementId] : null

	// Hydrate queries for data grid component
	useEffect(() => {
		if (!hydrated) {
			hydrate()
		}
	}, [hydrated, hydrate])

	if (!selectedElement) return null

	const handleContentUpdate = (content: string) => {
		updateElement(selectedElement.id, { content })
	}

	const handleAttributeUpdate = (key: string, value: string) => {
		const updatedAttributes = {
			...selectedElement.attributes,
			[key]: value,
		}
		updateElement(selectedElement.id, { attributes: updatedAttributes })
	}

	return (
		<div className="h-full overflow-y-auto">
			{/* No header bar here, handled by panel shell */}
			{selectedElement.content !== undefined && (
				<div className="px-4 py-2 border-b border-border bg-card">
					<label className="block text-sm font-medium mb-1 text-card-foreground">Content</label>
					<textarea
						value={selectedElement.content || ""}
						onChange={(e) => handleContentUpdate(e.target.value)}
						className="w-full p-2 border border-input rounded bg-background text-foreground resize-none"
						rows={3}
					/>
				</div>
			)}
			{/* Common attributes based on element type */}
			<div className="px-4 py-2 space-y-3">

				{selectedElement.tagName === "img" && (
					<>
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">Source URL</label>
							<input
								type="text"
								value={selectedElement.attributes?.src || ""}
								onChange={(e) => handleAttributeUpdate("src", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
								placeholder="https://example.com/image.jpg"
							/>
						</div>
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">Alt Text</label>
							<input
								type="text"
								value={selectedElement.attributes?.alt || ""}
								onChange={(e) => handleAttributeUpdate("alt", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
								placeholder="Image description"
							/>
						</div>
					</>
				)}

				{selectedElement.tagName === "a" && (
					<div>
						<label className="block text-xs font-medium mb-1 text-muted-foreground">Link URL</label>
						<input
							type="text"
							value={selectedElement.attributes?.href || ""}
							onChange={(e) => handleAttributeUpdate("href", e.target.value)}
							className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
							placeholder="https://example.com"
						/>
					</div>
				)}

				{selectedElement.tagName === "input" && (
					<>
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">Input Type</label>
							<select
								value={selectedElement.attributes?.type || "text"}
								onChange={(e) => handleAttributeUpdate("type", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
							>
								<option value="text">Text</option>
								<option value="email">Email</option>
								<option value="password">Password</option>
								<option value="number">Number</option>
								<option value="tel">Phone</option>
								<option value="url">URL</option>
								<option value="date">Date</option>
								<option value="time">Time</option>
								<option value="checkbox">Checkbox</option>
								<option value="radio">Radio</option>
							</select>
						</div>
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">Placeholder</label>
							<input
								type="text"
								value={selectedElement.attributes?.placeholder || ""}
								onChange={(e) => handleAttributeUpdate("placeholder", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
								placeholder="Enter placeholder text"
							/>
						</div>
					</>
				)}

				{selectedElement.tagName === "button" && (
					<div>
						<label className="block text-xs font-medium mb-1 text-muted-foreground">Button Type</label>
						<select
							value={selectedElement.attributes?.type || "button"}
							onChange={(e) => handleAttributeUpdate("type", e.target.value)}
							className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
						>
							<option value="button">Button</option>
							<option value="submit">Submit</option>
							<option value="reset">Reset</option>
						</select>
					</div>
				)}

				{selectedElement.tagName === "iframe" && (
					<>
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">Source URL</label>
							<input
								type="text"
								value={selectedElement.attributes?.src || ""}
								onChange={(e) => handleAttributeUpdate("src", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
								placeholder="https://www.youtube.com/embed/..."
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label className="block text-xs font-medium mb-1 text-muted-foreground">Width</label>
								<input
									type="text"
									value={selectedElement.attributes?.width || ""}
									onChange={(e) => handleAttributeUpdate("width", e.target.value)}
									className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
									placeholder="560"
								/>
							</div>
							<div>
								<label className="block text-xs font-medium mb-1 text-muted-foreground">Height</label>
								<input
									type="text"
									value={selectedElement.attributes?.height || ""}
									onChange={(e) => handleAttributeUpdate("height", e.target.value)}
									className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
									placeholder="315"
								/>
							</div>
						</div>
					</>
				)}

				{/* Data Grid Properties */}
				{selectedElement.attributes?.["data-type"] === "data-grid" && (
					<>
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">Query</label>
							<select
								value={selectedElement.attributes?.["data-query-name"] || ""}
								onChange={(e) => handleAttributeUpdate("data-query-name", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
							>
								<option value="">Select a query...</option>
								{queries.map((query) => (
									<option key={query.name} value={query.name}>
										{query.name} ({query.type})
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">Auto Refresh</label>
							<select
								value={selectedElement.attributes?.["data-auto-refresh"] || "false"}
								onChange={(e) => handleAttributeUpdate("data-auto-refresh", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
							>
								<option value="false">Manual</option>
								<option value="true">Automatic</option>
							</select>
						</div>
					</>
				)}
			</div>
		</div>
	)
}
// ...existing code from pure/src/components/tabs/PropertiesTab.tsx
