"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { type Element } from "../../../stores/pagebuilder/editor"
import { useFocusedTabStore, useFocusedTabId, useFocusedTabState } from "../../../stores/pagebuilder/editor-context"
import { Button } from "../../ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip"
import { useIsHydrated } from "@/hooks/use-hydration"
import {
	Square,
	Link,
	Type,
	Heading1,
	Heading2,
	Heading3,
	Heading4,
	AlignLeft,
	Quote,
	List,
	Code,
	Minus,
	ImageIcon,
	Youtube,
	Grid,
	MousePointer,
	AlignJustify,
	ChevronDown,
	Circle,
	CheckSquare,
	Calendar,
	Clock,
	ChevronRight,
	Menu,
	Tags as Tabs,
	ChevronsUpDown,
	Folder,
} from "lucide-react"

// Import vComponents registry
import { componentRegistry } from "../../../vComponents/registry"

const generateUniqueId = () => Math.random().toString(36).substr(2, 9)

// Function to merge vComponents registry with existing hardcoded components
function getMergedComponentCategories() {
	// Convert vComponents registry to ComponentsTab format
	const vComponentCategories = Object.entries(componentRegistry).map(([categoryKey, components]) => ({
		key: categoryKey,
		label: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
		components: components.map(component => ({
			icon: component.icon,
			name: component.name,
			description: component.description,
			template: {
				...component.template,
				// Ensure all required template properties are present
				attributes: component.template.attributes as any,
				styles: component.template.styles as any
			},
			isVComponent: true, // Flag to identify vComponents
			interface: component.interface
		} as any))
	}))

	// Get existing categories (make a deep copy to avoid mutations)
	const existingCategories = componentCategories.map(cat => ({
		...cat,
		components: [...cat.components]
	}))
	
	// Merge or add vComponent categories
	vComponentCategories.forEach(vCategory => {
		const existingCategory = existingCategories.find(cat => cat.key === vCategory.key)
		if (existingCategory) {
			// Only add vComponents that don't already exist in the category
			vCategory.components.forEach(vComponent => {
				const exists = existingCategory.components.some((comp: any) => 
					comp.name === vComponent.name && comp.isVComponent === true
				)
				if (!exists) {
					existingCategory.components.push(vComponent)
				}
			})
		} else {
			// Add new category
			existingCategories.push(vCategory as any)
		}
	})
	
	return existingCategories
}

const componentCategories = [
	{
		key: "general",
		label: "General",
		components: [
			{
				icon: Square,
				name: "Div Container",
				description: "Layout container",
				template: {
					tagName: "div",
					attributes: {},
					styles: {
						width: "200px",
						height: "120px",
						backgroundColor: "transparent",
						border: "2px dashed #d1d5db",
						borderRadius: "0px",
						margin: "16px 0",
						display: "block",
						padding: "16px",
						fontSize: "14px",
						color: "#6b7280",
					},
					content: "Layout Container",
				},
			},
			{
				icon: Link,
				name: "URL Link",
				description: "Hyperlink element",
				template: {
					tagName: "a",
					attributes: { href: "#" },
					styles: {
						color: "#3b82f6",
						textDecoration: "underline",
						cursor: "pointer",
						fontSize: "16px",
						margin: "8px 0",
					},
					content: "Link text",
				},
			},
		],
	},
	{
		key: "typography",
		label: "Typography",
		components: [
			{
				icon: Heading1,
				name: "H1",
				description: "Main heading",
				template: {
					tagName: "h1",
					attributes: {},
					styles: {
						fontSize: "36px",
						fontWeight: "bold",
						color: "#1f2937",
						margin: "24px 0 12px 0",
					},
					content: "Main Heading",
				},
			},
			{
				icon: Heading2,
				name: "H2",
				description: "Sub heading",
				template: {
					tagName: "h2",
					attributes: {},
					styles: {
						fontSize: "28px",
						fontWeight: "bold",
						color: "#374151",
						margin: "20px 0 10px 0",
					},
					content: "Sub Heading",
				},
			},
			{
				icon: Heading3,
				name: "H3",
				description: "Section heading",
				template: {
					tagName: "h3",
					attributes: {},
					styles: {
						fontSize: "24px",
						fontWeight: "bold",
						color: "#374151",
						margin: "18px 0 8px 0",
					},
					content: "Section Heading",
				},
			},
			{
				icon: Heading4,
				name: "H4",
				description: "Subsection heading",
				template: {
					tagName: "h4",
					attributes: {},
					styles: {
						fontSize: "20px",
						fontWeight: "bold",
						color: "#374151",
						margin: "16px 0 6px 0",
					},
					content: "Subsection Heading",
				},
			},
			{
				icon: AlignLeft,
				name: "Paragraph",
				description: "Text paragraph",
				template: {
					tagName: "p",
					attributes: {},
					styles: {
						fontSize: "16px",
						color: "#374151",
						margin: "16px 0",
						lineHeight: "1.6",
					},
					content: "Paragraph text",
				},
			},
			{
				icon: Quote,
				name: "BlockQuote",
				description: "Quote block",
				template: {
					tagName: "blockquote",
					attributes: {},
					styles: {
						fontSize: "18px",
						color: "#6b7280",
						fontStyle: "italic",
						borderLeft: "4px solid #d1d5db",
						paddingLeft: "16px",
						margin: "20px 0",
					},
					content: "This is a quote",
				},
			},
			{
				icon: List,
				name: "List",
				description: "Unordered list",
				template: {
					tagName: "ul",
					attributes: {},
					styles: {
						fontSize: "16px",
						color: "#374151",
						margin: "16px 0",
						paddingLeft: "20px",
					},
					content: "List item 1\nList item 2\nList item 3",
				},
			},
			{
				icon: Code,
				name: "Code Block",
				description: "Code display",
				template: {
					tagName: "pre",
					attributes: {},
					styles: {
						backgroundColor: "#f3f4f6",
						border: "1px solid #d1d5db",
						borderRadius: "6px",
						padding: "12px",
						fontSize: "14px",
						fontFamily: "monospace",
						color: "#374151",
						margin: "16px 0",
						overflow: "auto",
					},
					content: "console.log('Hello World');",
				},
			},
			{
				icon: Minus,
				name: "Thematic Break",
				description: "Horizontal rule",
				template: {
					tagName: "hr",
					attributes: {},
					styles: {
						border: "none",
						borderTop: "1px solid #d1d5db",
						margin: "24px 0",
						width: "100%",
					},
				},
			},
		],
	},
	{
		key: "media",
		label: "Media",
		components: [
			{
				icon: ImageIcon,
				name: "Image",
				description: "Image element",
				template: {
					tagName: "img",
					attributes: {
						src: "https://raw.githubusercontent.com/tracodict/goflow/refs/heads/main/public/placeholder-user.jpg",
						alt: "Placeholder image",
					},
					styles: {
						width: "200px",
						height: "150px",
						borderRadius: "8px",
						objectFit: "cover" as const,
						margin: "12px 0",
					},
				},
			},
			{
				icon: Youtube,
				name: "YouTube Video",
				description: "Embedded video",
				template: {
					tagName: "iframe",
					attributes: {
						src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
						width: "560",
						height: "315",
						frameBorder: "0",
						allowFullScreen: "true",
					},
					styles: {
						width: "100%",
						maxWidth: "560px",
						height: "315px",
						border: "none",
						borderRadius: "8px",
						margin: "16px 0",
					},
				},
			},
		],
	},
	{
		key: "data",
		label: "Data",
		components: [],
	},
	{
		key: "form",
		label: "Form",
		components: [
			{
				icon: Type,
				name: "Label",
				description: "Form label",
				template: {
					tagName: "label",
					attributes: {},
					styles: {
						fontSize: "14px",
						fontWeight: "500",
						color: "#374151",
						margin: "8px 0 4px 0",
						display: "block",
					},
					content: "Label text",
				},
			},
			{
				icon: ImageIcon,
				name: "Text Input",
				description: "Text input field",
				template: {
					tagName: "input",
					attributes: {
						placeholder: "Type here...",
						type: "text",
					},
					styles: {
						padding: "12px",
						border: "2px solid #d1d5db",
						borderRadius: "6px",
						fontSize: "14px",
						margin: "8px 0",
						width: "200px",
						backgroundColor: "white",
					},
				},
			},
			{
				icon: AlignJustify,
				name: "Text Area",
				description: "Multi-line text input",
				template: {
					tagName: "textarea",
					attributes: {
						placeholder: "Enter text...",
						rows: "4",
					},
					styles: {
						padding: "12px",
						border: "2px solid #d1d5db",
						borderRadius: "6px",
						fontSize: "14px",
						margin: "8px 0",
						width: "200px",
						backgroundColor: "white",
						resize: "vertical",
					},
				},
			},
			{
				icon: ChevronDown,
				name: "Select",
				description: "Dropdown select",
				template: {
					tagName: "select",
					attributes: {},
					styles: {
						padding: "12px",
						border: "2px solid #d1d5db",
						borderRadius: "6px",
						fontSize: "14px",
						margin: "8px 0",
						width: "200px",
						backgroundColor: "white",
					},
					content: "Option 1\nOption 2\nOption 3",
				},
			},
			{
				icon: Circle,
				name: "Radio",
				description: "Radio button",
				template: {
					tagName: "input",
					attributes: {
						type: "radio",
						name: "radio-group",
					},
					styles: {
						margin: "8px",
						cursor: "pointer",
					},
				},
			},
			{
				icon: CheckSquare,
				name: "Checkbox",
				description: "Checkbox input",
				template: {
					tagName: "input",
					attributes: {
						type: "checkbox",
					},
					styles: {
						margin: "8px",
						cursor: "pointer",
					},
				},
			},
		],
	},
	{
		key: "datetime",
		label: "DateTime",
		components: [
			{
				icon: Calendar,
				name: "Date Picker",
				description: "Date selection",
				template: {
					tagName: "input",
					attributes: {
						type: "date",
					},
					styles: {
						padding: "12px",
						border: "2px solid #d1d5db",
						borderRadius: "6px",
						fontSize: "14px",
						margin: "8px 0",
						width: "200px",
						backgroundColor: "white",
					},
				},
			},
			{
				icon: Clock,
				name: "Time Picker",
				description: "Time selection",
				template: {
					tagName: "input",
					attributes: {
						type: "time",
					},
					styles: {
						padding: "12px",
						border: "2px solid #d1d5db",
						borderRadius: "6px",
						fontSize: "14px",
						margin: "8px 0",
						width: "200px",
						backgroundColor: "white",
					},
				},
			},
		],
	},
	{
		key: "radix",
		label: "Radix",
		components: [
			{
				icon: ChevronsUpDown,
				name: "Accordion",
				description: "Collapsible content",
				template: {
					tagName: "div",
					attributes: { "data-type": "accordion" },
					styles: {
						border: "1px solid #e5e7eb",
						borderRadius: "8px",
						margin: "16px 0",
						overflow: "hidden",
					},
					content: "Accordion Content",
				},
			},

			{
				icon: Tabs,
				name: "Tabs",
				description: "Tabbed interface",
				template: {
					tagName: "div",
					attributes: { "data-type": "tabs" },
					styles: {
						border: "1px solid #e5e7eb",
						borderRadius: "8px",
						margin: "16px 0",
						overflow: "hidden",
					},
					content: "Tab Content",
				},
			},
			{
				icon: ChevronRight,
				name: "Collapsible",
				description: "Collapsible section",
				template: {
					tagName: "details",
					attributes: {},
					styles: {
						border: "1px solid #e5e7eb",
						borderRadius: "8px",
						padding: "12px",
						margin: "16px 0",
					},
					content: "Collapsible Content",
				},
			},
		],
	},
]

export const ComponentsTab: React.FC = () => {
	const focusedTabId = useFocusedTabId() // Track focused tab changes
	const store = useFocusedTabStore()
	const isHydrated = useIsHydrated()

	const [expandedSections, setExpandedSections] = useState<string[]>([])
	const [loadedFromStorage, setLoadedFromStorage] = useState(false)
	
	// Memoize merged categories to prevent duplicates
	const mergedCategories = useMemo(() => {
		return getMergedComponentCategories()
	}, [])

	// Use the safe hook that handles null store internally - always calls the same hooks
	const elements = useFocusedTabState((state) => state.elements, {})
	const selectedElementId = useFocusedTabState((state) => state.selectedElementId, null)
	
	// Get addElement function safely
	const addElement = store.getState().addElement

	// Load expanded sections from localStorage on mount
	useEffect(() => {
		if (!isHydrated) return
		
		const saved = localStorage.getItem("componentAccordionExpanded")
		if (saved) {
			try {
				const parsed = JSON.parse(saved)
				setExpandedSections(Array.isArray(parsed) ? parsed : ["general"])
			} catch {
				setExpandedSections(["general"])
			}
		} else {
			setExpandedSections(["general"]) // Default to first section expanded
		}
		setLoadedFromStorage(true)
	}, [isHydrated])

	// Save expanded sections to localStorage when changed
	const handleValueChange = (value: string[]) => {
		setExpandedSections(value)
		if (isHydrated) {
			localStorage.setItem("componentAccordionExpanded", JSON.stringify(value))
		}
	}

	const selectedElementObj = selectedElementId ? elements[selectedElementId] : undefined
	const isContainer =
		selectedElementObj && ["div", "section", "main", "article", "aside", "nav"].includes(selectedElementObj.tagName)
	const parentId: string = isContainer && selectedElementId ? selectedElementId : "page-root"

	const handleAddElement = (template: any) => {
		const newElement: Element = {
			...template,
			id: generateUniqueId(),
			childIds: [],
			parentId,
		}
		addElement(newElement, parentId)
	}

	if (!isHydrated) {
		return <div className="h-full overflow-y-auto" />
	}

	return (
		<div className="h-full overflow-y-auto">
			{/* No header bar here, handled by panel shell */}
			<TooltipProvider delayDuration={300}>
				<Accordion type="multiple" className="px-4" value={expandedSections} onValueChange={handleValueChange}>
					{mergedCategories.map((category) => (
						<AccordionItem key={category.key} value={category.key}>
							<AccordionTrigger className="text-left font-semibold text-foreground">{category.label}</AccordionTrigger>
							<AccordionContent className="pt-2">
								<div className="grid grid-cols-2 gap-2">
									{category.components.map((component: any, index: number) => {
										const IconComponent = component.icon
										const isVComponent = component.isVComponent
										return (
											<Tooltip key={index}>
												<TooltipTrigger asChild>
													<Button
														onClick={() => handleAddElement(component.template)}
														variant="outline"
														className={`h-auto p-3 flex flex-col items-center gap-2 text-center ${isVComponent ? 'border-blue-300 bg-blue-50/50' : ''}`}
													>
														<div className={`w-8 h-8 ${isVComponent ? 'bg-blue-500/20' : 'bg-primary/10'} rounded flex items-center justify-center`}>
															<IconComponent className={`w-4 h-4 ${isVComponent ? 'text-blue-600' : 'text-primary'}`} />
														</div>
														<div className="font-medium text-xs">
															{component.name}
														</div>
													</Button>
												</TooltipTrigger>
												<TooltipContent side="right" className="max-w-xs">
													<div>
														<p className="text-sm">{component.description}</p>
														{isVComponent && (
															<p className="text-xs text-blue-600 mt-1 font-medium">✨ Enhanced with scripting support</p>
														)}
													</div>
												</TooltipContent>
											</Tooltip>
										)
									})}
								</div>
							</AccordionContent>
						</AccordionItem>
						))}
					</Accordion>
				</TooltipProvider>
		</div>
	)
}
