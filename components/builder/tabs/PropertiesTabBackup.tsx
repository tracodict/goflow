// ...existing code...

"use client"

import React, { useState, useEffect } from "react"
import { useBuilderStore } from "../../../stores/pagebuilder/editor"
import { useSavedQueriesStore } from "../../../stores/saved-queries"
import { MenuConfigForm } from "../forms/menu-config-form"

export const PropertiesTab: React.FC = () => {
	const { elements, selectedElementId, updateElement } = useBuilderStore()
	const [showMenuConfig, setShowMenuConfig] = useState(false)
	const [menuConfigData, setMenuConfigData] = useState<any>(null)
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

				{/* vComponent Button Properties */}
				{selectedElement.attributes?.["data-component-type"] === "Button" && (
					<div className="space-y-3 border-t pt-3 mt-3">
						<h4 className="text-sm font-medium text-foreground">Button Events</h4>
						
						{/* onClick Event */}
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">onClick Script</label>
							<textarea
								value={selectedElement.attributes?.["data-onclick-script"] || ""}
								onChange={(e) => handleAttributeUpdate("data-onclick-script", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground font-mono resize-none"
								rows={3}
								placeholder="// JavaScript code for onClick event
// Available: payload, context, component, page, app"
							/>
							<div className="text-[10px] text-muted-foreground mt-1">
								Event payload includes: timestamp, componentId, modifierKeys, position
							</div>
						</div>

						{/* onMount Event */}
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">onMount Script</label>
							<textarea
								value={selectedElement.attributes?.["data-onmount-script"] || ""}
								onChange={(e) => handleAttributeUpdate("data-onmount-script", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground font-mono resize-none"
								rows={2}
								placeholder="// JavaScript code for onMount event
// Executed when button is first rendered"
							/>
						</div>

						{/* onUnmount Event */}
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">onUnmount Script</label>
							<textarea
								value={selectedElement.attributes?.["data-onunmount-script"] || ""}
								onChange={(e) => handleAttributeUpdate("data-onunmount-script", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground font-mono resize-none"
								rows={2}
								placeholder="// JavaScript code for onUnmount event
// Executed when button is removed"
							/>
						</div>

						{/* Button State Properties */}
						<div className="space-y-2">
							<h5 className="text-xs font-medium text-muted-foreground">State Properties</h5>
							<div className="grid grid-cols-2 gap-2">
								<label className="flex items-center space-x-2">
									<input
										type="checkbox"
										checked={selectedElement.attributes?.["data-loading"] === "true"}
										onChange={(e) => handleAttributeUpdate("data-loading", e.target.checked ? "true" : "false")}
										className="rounded"
									/>
									<span className="text-xs text-muted-foreground">Loading</span>
								</label>
								<label className="flex items-center space-x-2">
									<input
										type="checkbox"
										checked={selectedElement.attributes?.["data-disabled"] === "true"}
										onChange={(e) => handleAttributeUpdate("data-disabled", e.target.checked ? "true" : "false")}
										className="rounded"
									/>
									<span className="text-xs text-muted-foreground">Disabled</span>
								</label>
							</div>
							<div>
								<label className="block text-xs font-medium mb-1 text-muted-foreground">Loading Text</label>
								<input
									type="text"
									value={selectedElement.attributes?.["data-loading-text"] || ""}
									onChange={(e) => handleAttributeUpdate("data-loading-text", e.target.value)}
									className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
									placeholder="Loading..."
								/>
							</div>
						</div>
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
				{(selectedElement.attributes?.["data-type"] === "data-grid" ||
				  selectedElement.attributes?.["data-component-type"] === "data-grid") && (
					<>
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">Query</label>
							<select
								value={selectedElement.attributes?.["data-query-name"] || ""}
								onChange={(e) => handleAttributeUpdate("data-query-name", e.target.value)}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
							>
								<option value="">Select a query...</option>
								{queries.filter(q => q.type !== 's3').map((query) => (
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

				{/* S3 Explorer Properties */}
				{(selectedElement.attributes?.["data-type"] === "s3-explorer" ||
				  selectedElement.attributes?.["data-component-type"] === "s3-explorer") && (
					<div>
						<label className="block text-xs font-medium mb-1 text-muted-foreground">S3 Query</label>
						<select
							value={selectedElement.attributes?.["data-query-name"] || ""}
							onChange={(e) => handleAttributeUpdate("data-query-name", e.target.value)}
							className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
						>
							<option value="">Select an S3 query...</option>
							{queries.filter(q => q.type === 's3').map((query) => (
								<option key={query.name} value={query.name}>
									{query.name}
								</option>
							))}
						</select>
					</div>
				)}

				{/* Enhanced Navigation Menu Properties */}
				{(selectedElement.attributes?.["data-type"] === "enhanced-navigation-menu" ||
				  selectedElement.attributes?.["data-component-type"] === "NavigationMenu") && (
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<label className="text-xs font-medium text-muted-foreground">Menu Configuration</label>
							<button 
								onClick={openMenuConfig}
								className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/80"
							>
								Configure Menu
							</button>
						</div>
						
						<div>
							<label className="block text-xs font-medium mb-1 text-muted-foreground">Orientation</label>
							<select
								value={(() => {
									try {
										const config = JSON.parse(selectedElement.attributes?.["data-config"] || '{}')
										return config.orientation || 'horizontal'
									} catch {
										return 'horizontal'
									}
								})()}
								onChange={(e) => {
									try {
										const currentConfig = JSON.parse(selectedElement.attributes?.["data-config"] || '{}')
										const newConfig = { ...currentConfig, orientation: e.target.value }
										handleAttributeUpdate("data-config", JSON.stringify(newConfig))
									} catch (err) {
										console.error('Failed to update menu orientation:', err)
									}
								}}
								className="w-full p-2 border border-input rounded text-xs bg-background text-foreground"
							>
								<option value="horizontal">Horizontal</option>
								<option value="vertical">Vertical</option>
							</select>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<div>
								<label className="flex items-center space-x-2">
									<input
										type="checkbox"
										checked={(() => {
											try {
												const config = JSON.parse(selectedElement.attributes?.["data-config"] || '{}')
												return config.showIcons || false
											} catch {
												return false
											}
										})()}
										onChange={(e) => {
											try {
												const currentConfig = JSON.parse(selectedElement.attributes?.["data-config"] || '{}')
												const newConfig = { ...currentConfig, showIcons: e.target.checked }
												handleAttributeUpdate("data-config", JSON.stringify(newConfig))
											} catch (err) {
												console.error('Failed to update menu showIcons:', err)
											}
										}}
										className="rounded"
									/>
									<span className="text-xs text-muted-foreground">Show Icons</span>
								</label>
							</div>
							<div>
								<label className="flex items-center space-x-2">
									<input
										type="checkbox"
										checked={(() => {
											try {
												const config = JSON.parse(selectedElement.attributes?.["data-config"] || '{}')
												return config.showBadges || false
											} catch {
												return false
											}
										})()}
										onChange={(e) => {
											try {
												const currentConfig = JSON.parse(selectedElement.attributes?.["data-config"] || '{}')
												const newConfig = { ...currentConfig, showBadges: e.target.checked }
												handleAttributeUpdate("data-config", JSON.stringify(newConfig))
											} catch (err) {
												console.error('Failed to update menu showBadges:', err)
											}
										}}
										className="rounded"
									/>
									<span className="text-xs text-muted-foreground">Show Badges</span>
								</label>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Menu Configuration Form */}
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
// ...existing code from pure/src/components/tabs/PropertiesTab.tsx
