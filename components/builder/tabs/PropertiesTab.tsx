"use client"

import React, { useState, useEffect } from "react"
import { useBuilderStore } from "../../../stores/pagebuilder/editor"
import { useSavedQueriesStore } from "../../../stores/saved-queries" 
import { useDatasourceStore } from "../../../stores/datasource"
import { MenuConfigForm } from "../forms/menu-config-form"
import { getPropertyConfig, PropertyConfigRenderer } from "../../../vComponents/property-config-registry"

export const PropertiesTab: React.FC = () => {
	const { elements, selectedElementId, updateElement } = useBuilderStore()
	const [showMenuConfig, setShowMenuConfig] = useState(false)
	const [menuConfigData, setMenuConfigData] = useState<any>(null)
	const { queries, hydrated, hydrate } = useSavedQueriesStore()
	const { datasources, loading: datasourcesLoading, fetchDatasources } = useDatasourceStore()
	const selectedElement = selectedElementId ? elements[selectedElementId] : null

	// Hydrate queries and datasources
	useEffect(() => {
		if (!hydrated) {
			hydrate()
		}
	}, [hydrated, hydrate])
	
	useEffect(() => {
		if (!datasourcesLoading && datasources.length === 0) {
			fetchDatasources()
		}
	}, [datasourcesLoading, datasources.length, fetchDatasources])

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

	const openMenuConfig = () => {
		try {
			const currentConfig = JSON.parse(selectedElement.attributes?.["data-config"] || '{}')
			setMenuConfigData(currentConfig)
			setShowMenuConfig(true)
		} catch (err) {
			console.error('Failed to parse menu configuration:', err)
			// Set default config if parse fails
			setMenuConfigData({
				items: [],
				orientation: "horizontal",
				showIcons: true,
				showBadges: false
			})
			setShowMenuConfig(true)
		}
	}

	const handleMenuConfigSave = (configData: any) => {
		handleAttributeUpdate("data-config", JSON.stringify(configData))
	}

	const handleMenuConfigClose = () => {
		setShowMenuConfig(false)
		setMenuConfigData(null)
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

	return (
		<div className="h-full overflow-y-auto">
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
						datasources={datasources}
					/>
				)}
			</div>

			{/* Menu Configuration Form (special case for NavigationMenu) */}
			{menuConfigData && (
				<MenuConfigForm
					open={showMenuConfig}
					config={menuConfigData}
					onApply={handleMenuConfigSave}
					onClose={handleMenuConfigClose}
				/>
			)}
		</div>
	)
}