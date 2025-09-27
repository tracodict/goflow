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
				minHeight: "100vh",
				padding: "20px",
				backgroundColor: "#ffffff",
				fontFamily: "system-ui, sans-serif",
			},
			childIds: ["sample-box", "sample-text"],
		},
		"sample-box": {
			id: "sample-box",
			tagName: "div",
			attributes: {},
			styles: {
				width: "200px",
				height: "120px",
				backgroundColor: "transparent",
				border: "2px dashed #d1d5db",
				borderRadius: "0px",
				margin: "16px 0",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "16px",
				fontSize: "14px",
				color: "#6b7280",
			},
			content: "Layout Container",
			childIds: [],
			parentId: "page-root",
		},
		"sample-text": {
			id: "sample-text",
			tagName: "p",
			attributes: {},
			styles: {
				fontSize: "18px",
				color: "#374151",
				margin: "16px 0",
				lineHeight: "1.6",
			},
			content: "Welcome to the Visual Page Builder!",
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
