import { create } from "zustand"

// Core types for our visual page builder
export interface Element {
	id: string
	tagName: string
	attributes: Record<string, any>
	styles: Record<string, any>
	content?: string
	childIds: string[]
	parentId?: string
}

export interface BuilderState {
	elements: Record<string, Element>
	selectedElementId: string | null
	hoveredElementId: string | null
	isPreviewMode: boolean
	canvasScale: number
	draggedElementId: string | null
	leftPanelWidth: number
	rightPanelWidth: number
	showContainerBorders: boolean
	hasUnsavedChanges: boolean

	// Actions
	addElement: (element: Element, parentId?: string) => void
	updateElement: (id: string, updates: Partial<Element>) => void
	removeElement: (id: string) => void
	selectElement: (id: string | null) => void
	setHoveredElement: (id: string | null) => void
	togglePreviewMode: () => void
	setCanvasScale: (scale: number) => void
	setDraggedElement: (id: string | null) => void
	moveElement: (elementId: string, newParentId: string, insertIndex?: number) => void
	setLeftPanelWidth: (width: number) => void
	setRightPanelWidth: (width: number) => void
	toggleContainerBorders: () => void
	markAsChanged: () => void
	markAsSaved: () => void
	loadElements: (elements: Record<string, Element>) => void
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
	elements: {
		"page-root": {
			id: "page-root",
			tagName: "div",
			attributes: { className: "page-container" },
			styles: {
				minHeight: "40vh",
				padding: "20px",
				backgroundColor: "#ffffff",
				fontFamily: "system-ui, sans-serif",
			},
			childIds: ["navigation-menu", "main-title", "data-grid", "welcome-button"],
		},

		"navigation-menu": {
			id: "navigation-menu",
			tagName: "NavigationMenu",
			attributes: {
				"data-component-type": "NavigationMenu",
				"data-scriptable": "true",
				"data-config": JSON.stringify({
					items: [
						{
							id: "home",
							label: "Home",
							href: "/Home"
						},
						{
							id: "services",
							label: "Services",
							children: [
								{
									id: "rfq",
									label: "RFQ",
									href: "/svc/rfq"
								},
								{
									id: "quote",
									label: "Quote",
									href: "/svc/quote"
								}
							]
						},
						{
							id: "help",
							label: "Help",
							href: "/help"
						}
					]
				})
			},
			styles: {
				padding: "8px 0",
				marginTop: "-20px",
				marginLeft: "-20px",
				marginBottom: "0px",
				display: "block",
				width: "100%"
			},
			childIds: [],
			parentId: "page-root",
		},

		"main-title": {
			id: "main-title",
			tagName: "h1",
			attributes: {},
			styles: {
				fontSize: "32px",
				fontWeight: "bold",
				color: "#1f2937",
				margin: "24px 0",
				lineHeight: "1.2",
				textAlign: "center"
			},
			content: "Welcome to Our Website",
			childIds: [],
			parentId: "page-root",
		},

		"data-grid": {
			id: "data-grid",
			tagName: "div",
			attributes: {
				"data-component-type": "data-grid",
				"data-scriptable": "true",
				"data-query-name": ""
			},
			styles: {
				width: "100%",
				minHeight: "200px",
				margin: "8px 0",
				border: "1px solid #e5e7eb",
				borderRadius: "6px"
			},
			content: "",
			childIds: [],
			parentId: "page-root",
		},

		"welcome-button": {
			id: "welcome-button",
			tagName: "div",
			attributes: {
				"data-component-type": "Button",
				"data-scriptable": "true",
				"data-onclick-script": "// Update Data Grid query to use saved 'Mock Query' and provide user feedback.\n(function handleClick(payload, context){\n  const gridId = 'data-grid';\n  // Use helper exposed in PageBuilderButton context\n  context.page.updateElementAttribute(gridId, 'data-query-name', 'Mock Query');\n  context.app.showNotification('Data Grid query set to Mock Query', 'info');\n})(payload, context);"
			},
			styles: {
				padding: "12px 24px",
				backgroundColor: "#3b82f6",
				color: "white",
				border: "none",
				borderRadius: "6px",
				cursor: "pointer",
				fontSize: "14px",
				fontWeight: "500",
				margin: "16px auto",
				display: "block",
				textAlign: "center"
			},
			content: "Set Data Grid Query",
			childIds: [],
			parentId: "page-root",
		},
	},
	selectedElementId: null,
	hoveredElementId: null,
	isPreviewMode: false,
	canvasScale: 1,
	draggedElementId: null,
	leftPanelWidth: 300,
	rightPanelWidth: 320,
	showContainerBorders: true,
	hasUnsavedChanges: false,

	addElement: (element, parentId = "page-root") => {
		console.log("[v0] Adding element:", {
			elementId: element.id,
			parentId,
			elementTagName: element.tagName,
		})

		set((state) => {
			const newElements = { ...state.elements }

			// Add the new element
			newElements[element.id] = { ...element, parentId }

			// Add to parent's children
			if (newElements[parentId]) {
				const oldChildIds = newElements[parentId].childIds
				const newChildIds = [...oldChildIds, element.id]

				newElements[parentId] = {
					...newElements[parentId],
					childIds: newChildIds,
				}

				console.log("[v0] Updated parent:", {
					parentId,
					oldChildIds,
					newChildIds,
					parentTagName: newElements[parentId].tagName,
				})
			}

			return { elements: newElements }
		})
	},

	updateElement: (id, updates) => {
		set((state) => ({
			elements: {
				...state.elements,
				[id]: { ...state.elements[id], ...updates },
			},
			hasUnsavedChanges: true,
		}))
	},

	removeElement: (id) => {
		set((state) => {
			const newElements = { ...state.elements }
			const element = newElements[id]

			if (!element || id === "page-root") return state

			// Remove from parent's children
			if (element.parentId && newElements[element.parentId]) {
				newElements[element.parentId] = {
					...newElements[element.parentId],
					childIds: newElements[element.parentId].childIds.filter((childId) => childId !== id),
				}
			}

			// Recursively remove children
			const removeRecursively = (elementId: string) => {
				const el = newElements[elementId]
				if (el) {
					el.childIds.forEach(removeRecursively)
					delete newElements[elementId]
				}
			}

			element.childIds.forEach(removeRecursively)
			delete newElements[id]

			return {
				elements: newElements,
				selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
				hasUnsavedChanges: true,
			}
		})
	},

	selectElement: (id) => {
		set({ selectedElementId: id })
	},

	setHoveredElement: (id) => {
		set({ hoveredElementId: id })
	},

	togglePreviewMode: () => {
		set((state) => ({ isPreviewMode: !state.isPreviewMode }))
	},

	setCanvasScale: (scale) => {
		set({ canvasScale: scale })
	},

	setDraggedElement: (id) => {
		set({ draggedElementId: id })
	},

	moveElement: (elementId, newParentId, insertIndex) => {
		set((state) => {
			const newElements = { ...state.elements }
			const element = newElements[elementId]

			if (!element || elementId === newParentId) return state

			// Prevent moving element into its own child
			const isDescendant = (parentId: string, childId: string): boolean => {
				const parent = newElements[parentId]
				if (!parent) return false
				if (parent.childIds.includes(childId)) return true
				return parent.childIds.some((id) => isDescendant(id, childId))
			}

			if (isDescendant(elementId, newParentId)) return state

			// Remove from old parent
			if (element.parentId && newElements[element.parentId]) {
				newElements[element.parentId] = {
					...newElements[element.parentId],
					childIds: newElements[element.parentId].childIds.filter((id) => id !== elementId),
				}
			}

			// Add to new parent
			if (newElements[newParentId]) {
				const newChildIds = [...newElements[newParentId].childIds]
				if (insertIndex !== undefined && insertIndex >= 0) {
					newChildIds.splice(insertIndex, 0, elementId)
				} else {
					newChildIds.push(elementId)
				}

				newElements[newParentId] = {
					...newElements[newParentId],
					childIds: newChildIds,
				}
			}

			// Update element's parent
			newElements[elementId] = {
				...element,
				parentId: newParentId,
			}

			return { elements: newElements, hasUnsavedChanges: true }
		})
	},

	setLeftPanelWidth: (width) => {
		set({ leftPanelWidth: Math.max(200, Math.min(600, width)) })
	},

	setRightPanelWidth: (width) => {
		set({ rightPanelWidth: Math.max(200, Math.min(600, width)) })
	},

	toggleContainerBorders: () => {
		set((state) => ({ showContainerBorders: !state.showContainerBorders }))
	},

	markAsChanged: () => {
		set({ hasUnsavedChanges: true })
	},

	markAsSaved: () => {
		set({ hasUnsavedChanges: false })
	},

	loadElements: (elements: Record<string, Element>) => {
		set({ elements, hasUnsavedChanges: false })
	},
}))
