"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useBuilderStore } from "../../../stores/pagebuilder/editor"
import { useSavedQueriesStore } from "../../../stores/saved-queries" 
import { useDataSourceStore } from "../../../stores/filestore-datasource"
import { useSystemSettings, DEFAULT_SETTINGS } from "../../petri/system-settings-context"
import { getPropertyConfig, PropertyConfigRenderer } from "../../../vComponents/property-config-registry"

export const PropertiesTab: React.FC = () => {
	const { elements, selectedElementId, updateElement } = useBuilderStore()
	const { queries, hydrated, hydrate } = useSavedQueriesStore()
	const { dataSources, loading: datasourcesLoading, fetchDataSources } = useDataSourceStore()
	const { settings } = useSystemSettings()
	const selectedElement = selectedElementId ? elements[selectedElementId] : null

	// Hydrate queries and datasources
	useEffect(() => {
		if (!hydrated) {
			hydrate()
		}
	}, [hydrated, hydrate])
	
	useEffect(() => {
		if (!datasourcesLoading && dataSources.length === 0) {
			const flowServiceUrl = settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
			fetchDataSources(flowServiceUrl)
		}
	}, [datasourcesLoading, dataSources.length, fetchDataSources, settings?.flowServiceUrl])

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


	// Get the component type to determine which property config to use
	const getComponentType = (): string | null => {
		const attributes = selectedElement.attributes || {}
		
		// Check for vComponent types first
		if (attributes["data-component-type"]) {
			return attributes["data-component-type"]
		}
		
		// Check for legacy data-type values
		if (attributes["data-type"]) {
			return attributes["data-type"]
		}
		
		return null
	}

	const componentType = getComponentType()
	const propertyConfig = componentType ? getPropertyConfig(componentType) : null

	const handlePropertyKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
		if (event.key !== "Backspace" && event.key !== "Delete") return
		const target = event.target as HTMLElement | null
		if (!target) return
		const isFormElement =
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement ||
			target.isContentEditable
		if (!isFormElement) return
		event.stopPropagation()
		;(event.nativeEvent as KeyboardEvent | undefined)?.stopImmediatePropagation?.()
	}, [])

	return (
		<div className="h-full overflow-y-auto" onKeyDown={handlePropertyKeyDown}>
			{/* Content field for elements that support it */}
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
			
			<div className="px-4 py-2 space-y-3">
				{/* Standard HTML element properties */}
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

				{/* vComponent properties - use decoupled property configs */}
				{propertyConfig && (
								<PropertyConfigRenderer
									config={propertyConfig}
									attributes={selectedElement.attributes || {}}
									onAttributeUpdate={handleAttributeUpdate}
									queries={queries}
									datasources={dataSources}
								/>
				)}
			</div>

		</div>
	)
}