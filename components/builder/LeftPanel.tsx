"use client"


import React from "react"
import { useState, useEffect, useCallback } from "react"
import type { EditorType } from "./MainPanel"
import { ComponentsTab } from "./tabs/ComponentsTab"
import { PageStructureTab } from "./tabs/PageStructureTab"
import { PagesTab } from "./tabs/PagesTab"
import { SchemaTab } from "../via/schema-tab"
import { usePreSupportedSchemas } from "../petri/pre-supported-schemas"
import ExplorerPanel from "../petri/explorer-panel"
import type { JSONSchema } from "@/jsonjoy-builder/src/types/jsonSchema"
import { Layers, TreePine, Database, BookText, Workflow, X, MessageSquare, FolderTree, LayoutDashboard, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "../ui/button"
import { cn } from '@/lib/utils'
import { DataSidebar } from './data/DataSidebar'
import { useIsHydrated } from '@/hooks/use-hydration'

// Tab structure with hierarchical support
type TabItem = {
	id: string
	label: string
	icon: any
	parent?: string // ID of parent tab
}

const tabs: TabItem[] = [
	{ id: "workspace", label: "Workspace", icon: FolderTree },
	{ id: "page-builder", label: "Page Builder", icon: LayoutDashboard },
	{ id: "components", label: "Components", icon: Layers, parent: "page-builder" },
	{ id: "structure", label: "Structure", icon: TreePine, parent: "page-builder" },
	{ id: "data", label: "Data", icon: Database },
	{ id: "schema", label: "Schema", icon: BookText },
	{ id: "chat", label: "Chat", icon: MessageSquare },
	{ id: "workflow", label: "Workflow", icon: Workflow },
]

import { fetchWorkflow, deleteWorkflowApi, withApiErrorToast, fetchColorsList, saveWorkflow } from "../petri/petri-client"
import ChatPanel from "@/components/chat/Chat"
import { serverToGraph } from "@/lib/workflow-conversion"
import { useFlowServiceUrl } from '@/hooks/use-flow-service-url'
import { toast } from '@/hooks/use-toast'

const FLOW_SERVICE_MISSING_MESSAGE = 'Flow service not configured'
type LeftPanelProps = {
	isOpen: boolean
	onClose: () => void
	onOpen: () => void
	activeTab: string
	setActiveTab: (tab: string) => void
	onSchemaSelect?: (schemaName: string, schema: JSONSchema) => void
  isMaximized: boolean
  onToggleMaximize: () => void
  activeEditorType: EditorType | null
}
	export const LeftPanel: React.FC<LeftPanelProps> = ({ isOpen, onClose, onOpen, activeTab, setActiveTab, onSchemaSelect, isMaximized, onToggleMaximize, activeEditorType }) => {
	const isHydrated = useIsHydrated()
	const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([])
	const [error, setError] = useState<string | null>(null)
	const flowServiceUrl = useFlowServiceUrl({ includeDefault: false })
		const { load: loadPreSupported } = usePreSupportedSchemas()
		
		// Track which parent tabs are expanded to show their children
		const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set(["page-builder"]))

		// Load pre-supported schemas when component mounts
		useEffect(() => {
			loadPreSupported()
		}, [loadPreSupported])

		// State for workflow-defined schemas and color sets
		const [workflowDefinedColors, setWorkflowDefinedColors] = useState<string[]>([])
		const [workflowJsonSchemas, setWorkflowJsonSchemas] = useState<{ name: string; schema: any }[]>([])

	const isPageEditorActive = activeEditorType === 'page'
	const isWorkflowEditorActive = activeEditorType === 'workflow'
	const pageSpecificTabs = new Set(["page-builder", "components", "structure"])		// Local cache of the currently loaded workflow nodes/edges so ExplorerPanel
		// can render the places/transitions/arcs without relying on the canvas.
		const [wfNodes, setWfNodes] = useState<any[]>([])
		const [wfEdges, setWfEdges] = useState<any[]>([])
		const [workflowGraphCache, setWorkflowGraphCache] = useState<Record<string, { nodes: any[]; edges: any[] }>>({})
		const [loadingWorkflow, setLoadingWorkflow] = useState(false)
		const [workflowError, setWorkflowError] = useState<string | null>(null)
		const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)

		// Load defined schemas from server API
		useEffect(() => {
			if (!flowServiceUrl) {
				setWorkflowDefinedColors([])
				setWorkflowJsonSchemas([])
				return
			}

			const url = flowServiceUrl
			let cancelled = false
			async function loadDefinedSchemas() {
				try {
					const response = await fetchColorsList(url)
					if (!cancelled) {
						const data = response?.data || response
						const colors = Array.isArray(data.colors) ? data.colors : []
						const schemas = Array.isArray(data.schemas) ? data.schemas : []
						setWorkflowDefinedColors(colors)
						setWorkflowJsonSchemas(schemas)
					}
				} catch (error) {
					console.error('Failed to load defined schemas from API:', error)
					if (!cancelled) {
						setWorkflowDefinedColors([])
						setWorkflowJsonSchemas([])
					}
				}
			}

			loadDefinedSchemas()
			return () => { cancelled = true }
		}, [flowServiceUrl])

		const handleWorkflowSelect = async (id: string) => {
			if (!flowServiceUrl) {
				setWorkflowError(FLOW_SERVICE_MISSING_MESSAGE)
				setSelectedWorkflowId(null)
				return
			}
			setLoadingWorkflow(true)
			setWorkflowError(null)
			try {
				const res = await fetchWorkflow(flowServiceUrl, id)
				const swf = res?.data ?? res
				try {
					const graph = serverToGraph(swf)
					setWfNodes(graph.graph.nodes || [])
					setWfEdges(graph.graph.edges || [])
					setWorkflowGraphCache(prev => ({ ...prev, [id]: { nodes: graph.graph.nodes || [], edges: graph.graph.edges || [] } }))
				} catch (conversionError) {
					// fallback: try raw arrays if conversion not possible
					const nodes = res?.data?.nodes || res?.nodes || []
					const edges = res?.data?.edges || res?.edges || []
					setWfNodes(nodes)
					setWfEdges(edges)
					if (process.env.NODE_ENV !== 'production') {
						console.warn('[LeftPanel] Failed to convert workflow to graph, falling back to raw arrays', conversionError)
					}
				}
				setSelectedWorkflowId(id)
				try {
					window.dispatchEvent(new CustomEvent('goflow-explorer-select', { detail: { id } }))
				} catch {}
			} catch (e: any) {
				setWorkflowError(e?.message || 'Failed to load workflow')
			} finally {
				setLoadingWorkflow(false)
			}
		}

	// Listen for workflow opened in editor (populated by FlowWorkspace/FlowWorkspaceLoader)
	useEffect(() => {
		const openHandler = (e: any) => {
			const detail = e?.detail || {}
			// Prefer explicit id from data, fallback to path filename
			let id: string | undefined = undefined
			if (detail.data && typeof detail.data.id === 'string') id = detail.data.id
			if (!id && typeof detail.path === 'string') {
				const name = detail.path.split('/').pop() || detail.path
				id = name.replace(/\.(cpn\.json|cpn|json)$/i, '')
			}
			if (!id) return
			
			// Set this workflow as the selected one
			setSelectedWorkflowId(id)
			
			// Also add it to the workflows list if not already there
			const workflowName = detail.data?.name || id
			setWorkflows(prev => {
				const exists = prev.some(w => w.id === id)
				if (exists) return prev
				return [...prev, { id, name: workflowName }]
			})
			
			// attempt to set nodes/edges if provided
			if (detail.data) {
				try {
					const graph = serverToGraph(detail.data).graph
					setWfNodes(graph.nodes || [])
					setWfEdges(graph.edges || [])
					setWorkflowGraphCache(prev => ({ ...prev, [id!]: { nodes: graph.nodes || [], edges: graph.edges || [] } }))
				} catch (err) {
					// fallback to raw arrays if conversion fails
					const nodes = detail.data.nodes || detail.data.places || []
					const edges = detail.data.edges || detail.data.arcs || []
					setWfNodes(nodes)
					setWfEdges(edges)
					setWorkflowGraphCache(prev => ({ ...prev, [id!]: { nodes, edges } }))
				}
			}
		}
		window.addEventListener('goflow-open-workflow', openHandler as EventListener)
		return () => window.removeEventListener('goflow-open-workflow', openHandler as EventListener)
	}, [])

	const handleDeleteWorkflow = async (id: string) => {
			if (!flowServiceUrl) {
				setError(FLOW_SERVICE_MISSING_MESSAGE)
				return
			}
			if (!confirm('Delete workflow ' + id + '?')) return
			setLoadingWorkflow(true)
			try {
				await deleteWorkflowApi(flowServiceUrl, id)
				setWorkflows((list) => list.filter(w => w.id !== id))
				// inform FlowWorkspace about deletion
				try { window.dispatchEvent(new CustomEvent('goflow-workflow-deleted', { detail: { id } })) } catch {}
			} catch (e: any) {
				setError(e?.message || 'Failed to delete workflow')
			} finally {
				setLoadingWorkflow(false)
			}
		}

		const handleCreateWorkflow = async () => {
			if (!flowServiceUrl) {
				setError(FLOW_SERVICE_MISSING_MESSAGE)
				return
			}
			setLoadingWorkflow(true)
			try {
				const newId = `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`
				const name = `Workflow ${newId.slice(-4)}`
				const empty = { id: newId, name, description: '', colorSets: [], places: [], transitions: [], arcs: [], initialMarking: {}, declarations: {} }
				await withApiErrorToast(saveWorkflow(flowServiceUrl, empty), toast, 'Create workflow')
				setWorkflows((list) => ([...(Array.isArray(list) ? list : []), { id: newId, name }]))
				setWorkflowGraphCache(prev => ({ ...prev, [newId]: { nodes: [], edges: [] } }))
				setSelectedWorkflowId(newId)
				// notify canvas and fetch details for the new workflow
				try { window.dispatchEvent(new CustomEvent('goflow-explorer-select', { detail: { id: newId } })) } catch {}
				await handleWorkflowSelect(newId)
			} catch (e:any) {
				setError(e?.message || 'Failed to create workflow')
			} finally {
				setLoadingWorkflow(false)
		}
	}


	const handleRefresh = () => {
		// No longer fetching server list - workflow data comes from goflow-open-workflow event
		// Just clear any error state
		setError(null)
		setWorkflowError(null)
	}

	useEffect(() => {
		setError(null)
		setWorkflowError(null)
		setWorkflows([])
		setWorkflowGraphCache({})
		setSelectedWorkflowId(null)
		setWfNodes([])
		setWfEdges([])
	}, [flowServiceUrl])

	useEffect(() => {
		// No longer fetching workflow list from server when tab opens
		// Workflow data comes from goflow-open-workflow event
		
		const onGraphUpdate = (e: any) => {
			const wfId = e?.detail?.workflowId
			const graph = e?.detail?.graph
			if (wfId && graph) setWorkflowGraphCache(prev => ({ ...prev, [wfId]: graph }))
		}

		window.addEventListener('goflow-explorer-graph-updated', onGraphUpdate as EventListener)
		return () => {
			window.removeEventListener('goflow-explorer-graph-updated', onGraphUpdate as EventListener)
		}
	}, [activeTab, flowServiceUrl, isOpen])

const renderTabContent = () => {
		switch (activeTab) {
			case "workspace":
				// Placeholder: use existing Pages tab for file explorer
				return <PagesTab />
			case "page-builder":
				// Parent tab - show a message to select a child
				return (
					<div className="p-4 text-center text-muted-foreground">
						<LayoutDashboard className="w-12 h-12 mx-auto mb-2 opacity-50" />
						<p>Select a page builder tool from the sidebar</p>
					</div>
				)
			case "components":
				return <ComponentsTab />
			case "structure":
				return <PageStructureTab />
			case "data":
				// Datasource sidebar (Phase 1) using goflow design language
				return <DataSidebar />
				case "schema":
					return (
						<div className="flex-1 overflow-auto">
							<SchemaTab
								definedColors={workflowDefinedColors} // Use workflow-defined color sets
								jsonSchemas={workflowJsonSchemas} // Use workflow-defined JSON schemas
								onSchemaUpdate={(name, updatedSchema) => {
									// TODO: Implement schema update logic for workflow context
									console.log('Schema updated:', name, updatedSchema)
								}}
								onSchemaSelect={onSchemaSelect} // Pass through the callback
							/>
						</div>
					)
				case "workflow":
					if (error) return <div className="p-4 text-center text-destructive">{error}</div>
					return <ExplorerPanel
							workflows={
								// If the workspace editor is active and a workflow is open, show only that workflow
								(isWorkflowEditorActive && selectedWorkflowId)
									? workflows.filter(w => w.id === selectedWorkflowId)
									: workflows
							}
							nodes={
								// if we have a cached graph for the selected workflow, prefer that
								(isWorkflowEditorActive && selectedWorkflowId && workflowGraphCache[selectedWorkflowId])
									? workflowGraphCache[selectedWorkflowId].nodes
									: wfNodes
							}
							edges={
								(isWorkflowEditorActive && selectedWorkflowId && workflowGraphCache[selectedWorkflowId])
									? workflowGraphCache[selectedWorkflowId].edges
									: wfEdges
							}
						workflowGraphs={workflowGraphCache}
						activeWorkflowId={selectedWorkflowId}
						onWorkflowSelect={handleWorkflowSelect}
						onCreateWorkflow={handleCreateWorkflow}
						onDeleteWorkflow={handleDeleteWorkflow}
						onRefreshWorkflows={handleRefresh}
						onSelectEntity={(kind,id) => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-entity-select', { detail: { kind, id } })); } catch {} }}
						onAddPlace={() => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-add-place', { detail: { workflowId: selectedWorkflowId } })); } catch {} }}
						onAddTransition={() => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-add-transition', { detail: { workflowId: selectedWorkflowId } })); } catch {} }}
						onDeletePlace={(id: string) => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-delete-place', { detail: { id, workflowId: selectedWorkflowId } })); } catch {} }}
						onDeleteTransition={(id: string) => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-delete-transition', { detail: { id, workflowId: selectedWorkflowId } })); } catch {} }}
						onDeleteArc={(id: string) => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-delete-arc', { detail: { id, workflowId: selectedWorkflowId } })); } catch {} }}
					/>
				case "chat":
					return <div className="flex-1 overflow-hidden"><ChatPanel /></div>
				default:
					return <ComponentsTab />
			}
		}

	return (
		<div className="bg-card border-r border-border h-full flex">
			{/* Vertical tab bar always visible */}
			<div className="w-12 bg-muted/50 border-r border-border flex flex-col">
				{tabs.map((tab) => {
					const IconComponent = tab.icon
					const isParent = tabs.some(t => t.parent === tab.id)
					const isChild = !!tab.parent
					const isExpanded = expandedParents.has(tab.id)
					const shouldShow = !isChild || expandedParents.has(tab.parent!)
					const isDisabled = (!isPageEditorActive && pageSpecificTabs.has(tab.id)) || (!isWorkflowEditorActive && tab.id === "workflow")
					
					if (!shouldShow) return null
					
					const handleClick = () => {
						if (isDisabled) return
						if (isParent) {
							// Toggle expansion for parent tabs
							setExpandedParents(prev => {
								const next = new Set(prev)
								if (next.has(tab.id)) {
									next.delete(tab.id)
								} else {
									next.add(tab.id)
								}
								return next
							})
							// If parent has children, don't set it as active tab
							if (isExpanded) {
								setActiveTab(tab.id)
							} else {
								// Expand and open first child
								const firstChild = tabs.find(t => t.parent === tab.id)
								if (firstChild) {
									setActiveTab(firstChild.id)
								}
							}
						} else {
							setActiveTab(tab.id)
						}
						if (!isOpen) onOpen()
					}
					
					return (
						<button
							key={tab.id}
							onClick={handleClick}
							disabled={isDisabled}
							className={cn(
								"w-12 h-12 flex items-center justify-center border-b border-border hover:bg-accent transition-colors group relative",
								isHydrated && activeTab === tab.id && isOpen ? "bg-accent text-accent-foreground" : "text-muted-foreground",
								isChild && "bg-muted/70 border-l-2 border-l-primary/30",
								isDisabled && "opacity-40 hover:bg-muted/50 cursor-not-allowed"
							)}
							title={tab.label}
						>
							<IconComponent className={cn("w-5 h-5", isChild && "w-4 h-4")} />
							{/* Expansion indicator for parent tabs */}
							{isParent && (
								<div className="absolute right-1 bottom-1 w-1.5 h-1.5 rounded-full bg-primary/50" />
							)}
							{/* Tooltip */}
							<div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
								{tab.label}
							</div>
						</button>
					)
				})}
			</div>				{/* Panel content, only if open */}
				{isOpen && (
					<div className={cn("flex-1 flex flex-col overflow-hidden", isMaximized ? "max-w-none w-full" : "min-w-[200px] max-w-[600px]")}>
						{/* visual resizer handled by parent ResizeHandle; no decorative knob here to avoid duplication */}
						{/* Reusable header bar */}
						<div className="flex items-center justify-between border-b px-3 py-2">
							<div className="text-sm font-semibold">{isHydrated ? tabs.find(t => t.id === activeTab)?.label : ''}</div>
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
					<div className="flex-1 flex flex-col overflow-hidden">{renderTabContent()}</div>
				</div>
			)}
		</div>
	)
}