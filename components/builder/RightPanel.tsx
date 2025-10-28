"use client"


import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { StylesTab } from "./tabs/StylesTab"
import { PropertiesTab } from "./tabs/PropertiesTab"
import { SidePanel } from "../petri/side-panel"
import { useFocusedTabStore, useFocusedTabId } from "../../stores/pagebuilder/editor-context"
import { getFlowWorkspaceStore, type FlowWorkspaceEntity } from "../../stores/petri/flow-editor-context"
import { X, GripVertical, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "../ui/button"
import type { EditorType } from "./MainPanel"

type RightPanelProps = {
	isOpen: boolean
	onClose: () => void
	onOpen: () => void
	activeTab?: string
	activeEditorType?: EditorType | null
  isMaximized: boolean
  onToggleMaximize: () => void
}


export const RightPanel: React.FC<RightPanelProps> = ({ isOpen, onClose, onOpen, activeTab, activeEditorType, isMaximized, onToggleMaximize }) => {
		const [workflowSidePanelProps, setWorkflowSidePanelProps] = React.useState<any | null>(null)
		const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null)
		const [workflowSelection, setWorkflowSelection] = React.useState<FlowWorkspaceEntity>(null)
		const focusedTabId = useFocusedTabId()
		const store = useFocusedTabStore()
		const flowStore = focusedTabId ? getFlowWorkspaceStore(focusedTabId) ?? null : null
		const isWorkflowEditor = activeEditorType === 'workflow'
	
	// Subscribe to selectedElementId changes from the focused tab's store
	React.useEffect(() => {
			if (isWorkflowEditor) {
				setSelectedElementId(null)
				return
			}

			const initialValue = store.getState().selectedElementId
			setSelectedElementId(initialValue)

			let previousValue = initialValue
			const unsubscribe = store.subscribe(() => {
				const currentValue = store.getState().selectedElementId
				if (currentValue !== previousValue) {
					previousValue = currentValue
					setSelectedElementId(currentValue)
				}
			})

			return unsubscribe
		}, [store, focusedTabId, isWorkflowEditor])

		React.useEffect(() => {
			if (!flowStore) {
				setWorkflowSelection(null)
				setWorkflowSidePanelProps(null)
				return
			}

			setWorkflowSelection(flowStore.getState().selectedEntity)
			setWorkflowSidePanelProps(flowStore.getState().sidePanelDetail)

				const unsubscribe = flowStore.subscribe((state) => {
					setWorkflowSelection(state.selectedEntity)
					setWorkflowSidePanelProps(state.sidePanelDetail)
				})

				return unsubscribe
		}, [flowStore])

		React.useEffect(() => {
			if (flowStore) return

			function handler(e: Event) {
				const ev = e as CustomEvent
				const detail = ev.detail ?? null
				if (typeof queueMicrotask === 'function') {
					queueMicrotask(() => {
						setWorkflowSidePanelProps(detail)
						setWorkflowSelection(detail?.selectedEntity ?? null)
					})
				} else {
					setTimeout(() => {
						setWorkflowSidePanelProps(detail)
						setWorkflowSelection(detail?.selectedEntity ?? null)
					}, 0)
				}
			}

			window.addEventListener('goflow-sidepanel-props', handler as EventListener)
			return () => window.removeEventListener('goflow-sidepanel-props', handler as EventListener)
		}, [flowStore])
	if (!isOpen) return null

	const headerLabel = isWorkflowEditor
			? (workflowSidePanelProps || workflowSelection ? 'Workflow' : 'No Selection')
		: (selectedElementId ? "Element" : "No Selection")
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
			{isWorkflowEditor && workflowSidePanelProps ? (
				<div className="flex-1 overflow-hidden">
					<SidePanel {...workflowSidePanelProps} />
				</div>
			) : isWorkflowEditor ? (
				<div className="flex-1 flex items-center justify-center">
					<div className="p-4 text-center text-muted-foreground">
						{workflowSelection ? 'Loading selection details…' : 'Select a workflow entity to edit its properties'}
					</div>
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
