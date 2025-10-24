"use client"


import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { StylesTab } from "./tabs/StylesTab"
import { PropertiesTab } from "./tabs/PropertiesTab"
import { SidePanel } from "../petri/side-panel"
import { useFocusedTabStore, useFocusedTabId } from "../../stores/pagebuilder/editor-context"
import { X, GripVertical, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "../ui/button"

type RightPanelProps = {
	isOpen: boolean
	onClose: () => void
	onOpen: () => void
	activeTab?: string
  isMaximized: boolean
  onToggleMaximize: () => void
}


export const RightPanel: React.FC<RightPanelProps> = ({ isOpen, onClose, onOpen, activeTab, isMaximized, onToggleMaximize }) => {
	const [sidePanelProps, setSidePanelProps] = React.useState<any | null>(null)
	const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null)
	const focusedTabId = useFocusedTabId() // Track focused tab changes
	const store = useFocusedTabStore()
	
	// Subscribe to selectedElementId changes from the focused tab's store
	React.useEffect(() => {
		// Get initial value
		const initialValue = store.getState().selectedElementId
		setSelectedElementId(initialValue)
		
		// Subscribe to changes - track previous value to only update when it changes
		let previousValue = initialValue
		const unsubscribe = store.subscribe(() => {
			const currentValue = store.getState().selectedElementId
			if (currentValue !== previousValue) {
				previousValue = currentValue
				setSelectedElementId(currentValue)
			}
		})
		
		return unsubscribe
	}, [store, focusedTabId])

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

  const headerLabel = activeTab === 'workflow' && sidePanelProps ? 'Workflow' : (selectedElementId ? "Element" : "No Selection")
  const containerClasses = [
    "bg-background border-l border-border h-full flex flex-col relative",
    isMaximized ? "w-full max-w-none" : "min-w-[200px] max-w-[600px]"
  ].join(' ')

	return (
		<div className={containerClasses}>
			{/* visual resizer knob to match flow-workspace style (non-interactive) */}
			{!isMaximized ? (
				<div role="presentation" className="pointer-events-none absolute left-[-6px] top-1/2 -translate-y-1/2 rounded-full bg-neutral-200 p-0.5">
					<GripVertical className="h-3 w-3 text-neutral-500" />
				</div>
			) : null}
			{/* Reusable header bar (match side-panel style) */}
			<div className="flex items-center justify-between border-b px-3 py-2">
				<div className="text-sm font-semibold">{headerLabel}</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={onToggleMaximize}
						title={isMaximized ? "Restore panel" : "Maximize panel"}
					>
						{isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
					</Button>
					<Button variant="ghost" size="icon" onClick={onClose} title="Close panel">
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>
			{activeTab === 'workflow' && sidePanelProps ? (
				<div className="flex-1 overflow-hidden">
					<SidePanel {...sidePanelProps} />
				</div>
			) : selectedElementId ? (
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
