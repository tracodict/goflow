"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useBuilderStore, type Element } from "../../../stores/pagebuilder/editor"
import { Button } from "../../ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip"
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
	FileText,
	Grid,
	Search,
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
} from "lucide-react"

const generateUniqueId = () => Math.random().toString(36).substr(2, 9)

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
						src: "https://via.placeholder.com/200x150/e5e7eb/9ca3af?text=Image",
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
						frameborder: "0",
						allowfullscreen: "true",
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
		components: [
			{
				icon: FileText,
				name: "Markdown",
				description: "Markdown content",
				template: {
					tagName: "div",
					attributes: { "data-type": "markdown" },
					styles: {
						fontSize: "16px",
						color: "#374151",
						lineHeight: "1.6",
						margin: "16px 0",
						padding: "16px",
						border: "1px solid #e5e7eb",
						borderRadius: "8px",
					},
					content: "# Markdown Content\n\nThis is **bold** and *italic* text.",
				},
			},
			{
				icon: Grid,
				name: "Data Grid",
				description: "Server-side data grid",
				template: {
					tagName: "div",
					attributes: { 
						"data-type": "data-grid",
						"data-query-name": "",
						"data-auto-refresh": "false"
					},
					styles: {
						width: "100%",
						minHeight: "200px",
						border: "1px solid #e5e7eb",
						borderRadius: "8px",
						overflow: "hidden",
						margin: "16px 0",
						backgroundColor: "white",
						position: "relative",
					},
					content: "Data Grid Component - Select a query to display data",
				},
			},
			{
				icon: Search,
				name: "Combobox",
				description: "Server search combobox",
				template: {
					tagName: "div",
					attributes: { "data-type": "combobox" },
					styles: {
						width: "200px",
						border: "1px solid #d1d5db",
						borderRadius: "6px",
						padding: "8px 12px",
						backgroundColor: "white",
						margin: "8px 0",
					},
					content: "Search...",
				},
			},
		],
	},
	{
		key: "form",
		label: "Form",
		components: [
			{
				icon: MousePointer,
				name: "Button",
				description: "Interactive button",
				template: {
					tagName: "button",
					attributes: {},
					styles: {
						padding: "12px 24px",
						backgroundColor: "#3b82f6",
						color: "white",
						border: "none",
						borderRadius: "6px",
						cursor: "pointer",
						fontSize: "14px",
						fontWeight: "500",
						margin: "8px 0",
					},
					content: "Click me",
				},
			},
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
				icon: Menu,
				name: "Navigation Menu",
				description: "Navigation component",
				template: {
					tagName: "nav",
					attributes: {},
					styles: {
						display: "flex",
						gap: "16px",
						padding: "12px 0",
						borderBottom: "1px solid #e5e7eb",
						margin: "16px 0",
					},
					content: "Nav Item 1 | Nav Item 2 | Nav Item 3",
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
	const { elements, addElement, selectedElementId } = useBuilderStore()

	const [expandedSections, setExpandedSections] = useState<string[]>([])

	// Load expanded sections from localStorage on mount
	useEffect(() => {
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
	}, [])

	// Save expanded sections to localStorage when changed
	const handleValueChange = (value: string[]) => {
		setExpandedSections(value)
		localStorage.setItem("componentAccordionExpanded", JSON.stringify(value))
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

	return (
		<div className="h-full overflow-y-auto">
			{/* No header bar here, handled by panel shell */}
			<TooltipProvider delayDuration={300}>
				<Accordion type="multiple" className="px-4" value={expandedSections} onValueChange={handleValueChange}>
					{componentCategories.map((category) => (
						<AccordionItem key={category.key} value={category.key}>
							<AccordionTrigger className="text-left font-semibold text-foreground">{category.label}</AccordionTrigger>
							<AccordionContent className="pt-2">
								<div className="grid grid-cols-2 gap-2">
									{category.components.map((component, index) => {
										const IconComponent = component.icon
										return (
											<Tooltip key={index}>
												<TooltipTrigger asChild>
													<Button
														onClick={() => handleAddElement(component.template)}
														variant="outline"
														className="h-auto p-3 flex flex-col items-center gap-2 text-center"
													>
														<div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
															<IconComponent className="w-4 h-4 text-primary" />
														</div>
														<div className="font-medium text-xs">{component.name}</div>
													</Button>
												</TooltipTrigger>
												<TooltipContent side="right" className="max-w-xs">
													<p className="text-sm">{component.description}</p>
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
