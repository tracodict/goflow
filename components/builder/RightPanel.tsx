"use client"


import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { StylesTab } from "./tabs/StylesTab"
import { PropertiesTab } from "./tabs/PropertiesTab"
import { SidePanel } from "../petri/side-panel"
import { useBuilderStore } from "../../stores/pagebuilder/editor"
import { X, GripVertical } from "lucide-react"
import { Button } from "../ui/button"

type RightPanelProps = {
	isOpen: boolean
	onClose: () => void
	onOpen: () => void
	activeTab?: string
}


export const RightPanel: React.FC<RightPanelProps> = ({ isOpen, onClose, onOpen, activeTab }) => {
	const { selectedElementId } = useBuilderStore()
	const [sidePanelProps, setSidePanelProps] = React.useState<any | null>(null)

	React.useEffect(() => {
		function handler(e: Event) {
			const ev = e as CustomEvent
			// schedule update asynchronously to avoid setState during another
			// component's render (dispatch may happen synchronously from CanvasInner)
			if (typeof queueMicrotask === 'function') {
				queueMicrotask(() => setSidePanelProps(ev.detail))
			} else {
				setTimeout(() => setSidePanelProps(ev.detail), 0)
			}
		}
		window.addEventListener('goflow-sidepanel-props', handler as EventListener)
		return () => window.removeEventListener('goflow-sidepanel-props', handler as EventListener)
	}, [])

	if (!isOpen) return null

	// If the flow workspace is active and we've received side panel props, render the migrated SidePanel.
	if (activeTab === 'workflow' && sidePanelProps) {
		return (
			<div className="h-full relative">
				<SidePanel {...sidePanelProps} />
			</div>
		)
	}

	return (
		<div className="bg-background border-l border-border h-full flex flex-col min-w-[200px] max-w-[600px] relative">
			{/* visual resizer knob to match flow-workspace style (non-interactive) */}
			<div role="presentation" className="pointer-events-none absolute left-[-6px] top-1/2 -translate-y-1/2 rounded-full bg-neutral-200 p-0.5">
				<GripVertical className="h-3 w-3 text-neutral-500" />
			</div>
			{/* Reusable header bar (match side-panel style) */}
			<div className="flex items-center justify-between border-b px-3 py-2">
				<div className="text-sm font-semibold">{selectedElementId ? "Element" : "No Selection"}</div>
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="icon" onClick={onClose} title="Close panel">
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>
			{selectedElementId ? (
				<Tabs defaultValue="styles" className="flex flex-col h-full">
					<TabsList className="grid w-full grid-cols-2 m-2">
						<TabsTrigger value="styles">Styles</TabsTrigger>
						<TabsTrigger value="properties">Properties</TabsTrigger>
					</TabsList>
					<TabsContent value="styles" className="flex-1 overflow-hidden">
						<StylesTab />
					</TabsContent>
					<TabsContent value="properties" className="flex-1 overflow-hidden">
						<PropertiesTab />
					</TabsContent>
				</Tabs>
			) : (
				<div className="flex-1 flex items-center justify-center">
					<div className="p-4 text-center text-muted-foreground">Select an element to edit its properties</div>
				</div>
			)}
		</div>
	)
}
