"use client"


import React from "react"
import { useState, useEffect } from "react"
import { ComponentsTab } from "./tabs/ComponentsTab"
import { PageStructureTab } from "./tabs/PageStructureTab"
import { PagesTab } from "./tabs/PagesTab"
import { SchemaTab } from "../via/schema-tab"
import { usePreSupportedSchemas } from "../petri/pre-supported-schemas"
import ExplorerPanel from "../petri/explorer-panel"
import type { JSONSchema } from "@/jsonjoy-builder/src/types/jsonSchema"
import { Layers, FileText, TreePine, Database, BookText, Workflow, X, Wrench, MoreVertical, RefreshCw, Plus, Play, Beaker, Trash2, MessageSquare } from "lucide-react"
import { Button } from "../ui/button"
import { useDataSourceStore } from '@/stores/filestore-datasource'
import { useQueryStore } from '@/stores/filestore-query'
import { useQueryStore as useQueryExecutionStore } from '@/stores/query'
import { DataSource, QueryDefinition } from '@/lib/datastore-client'
import { cn } from '@/lib/utils'


const tabs = [
	{ id: "components", label: "Components", icon: Layers },
	{ id: "pages", label: "Pages", icon: FileText },
	{ id: "structure", label: "Structure", icon: TreePine },
	{ id: "data", label: "Data", icon: Database },
	{ id: "schema", label: "Schema", icon: BookText },
	{ id: "workflow", label: "Workflow", icon: Workflow },
	{ id: "mcp-tools", label: "MCP Tools", icon: Wrench },
  { id: "chat", label: "Chat", icon: MessageSquare },
]

import { fetchWorkflowList, fetchWorkflow, deleteWorkflowApi, listMcpTools, registerMcpServer, withApiErrorToast, listRegisteredMcpServers, deregisterMcpServer, fetchColorsList, saveWorkflow } from "../petri/petri-client"
import ChatPanel from "@/components/chat/Chat"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../ui/dropdown-menu"
import { serverToGraph } from "@/lib/workflow-conversion"
import { useSystemSettings } from "../petri/system-settings-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
type LeftPanelProps = {
	isOpen: boolean
	onClose: () => void
	onOpen: () => void
	activeTab: string
	setActiveTab: (tab: string) => void
	onSchemaSelect?: (schemaName: string, schema: JSONSchema) => void
}
	export const LeftPanel: React.FC<LeftPanelProps> = ({ isOpen, onClose, onOpen, activeTab, setActiveTab, onSchemaSelect }) => {
		const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([])
		const [loading, setLoading] = useState(false)
		const [error, setError] = useState<string | null>(null)
		const { settings } = useSystemSettings()
		const { names: preSupportedNames, load: loadPreSupported } = usePreSupportedSchemas()

		// Load pre-supported schemas when component mounts
		useEffect(() => {
			loadPreSupported()
		}, [loadPreSupported])

		// Expose flowServiceUrl globally for compatibility with old stores
		useEffect(() => {
			if (settings?.flowServiceUrl) {
				(window as any).__goflow_flowServiceUrl = settings.flowServiceUrl
			}
		}, [settings?.flowServiceUrl])

		// State for workflow-defined schemas and color sets
		const [workflowDefinedColors, setWorkflowDefinedColors] = useState<string[]>([])
		const [workflowJsonSchemas, setWorkflowJsonSchemas] = useState<{ name: string; schema: any }[]>([])

		const fetchList = async () => {
			setLoading(true)
			setError(null)
			try {
				const res = await fetchWorkflowList(settings.flowServiceUrl)
				const arr = res?.cpns || res?.data?.cpns || []
				setWorkflows(arr)
			} catch (e: any) {
				setError(e?.message || "Failed to load workflows")
			} finally {
				setLoading(false)
			}
		}

		// Local cache of the currently loaded workflow nodes/edges so ExplorerPanel
		// can render the places/transitions/arcs without relying on the canvas.
		const [wfNodes, setWfNodes] = useState<any[]>([])
		const [wfEdges, setWfEdges] = useState<any[]>([])
		const [workflowGraphCache, setWorkflowGraphCache] = useState<Record<string, { nodes: any[]; edges: any[] }>>({})
		const [loadingWorkflow, setLoadingWorkflow] = useState(false)
		const [workflowError, setWorkflowError] = useState<string | null>(null)
		const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)

		// Load defined schemas from server API
		useEffect(() => {
			if (!settings.flowServiceUrl) {
				setWorkflowDefinedColors([])
				setWorkflowJsonSchemas([])
				return
			}

			let cancelled = false
			async function loadDefinedSchemas() {
				try {
					// Fetch defined schemas from server API
					const response = await fetchColorsList(settings.flowServiceUrl)
					if (!cancelled) {
						// API returns { success: boolean, data: { colors: string[], schemas?: any[] } }
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
		}, [settings.flowServiceUrl])

		// MCP dialog state (migrated from FlowWorkspace)
		const [mcpAddOpen, setMcpAddOpen] = useState(false)
		const [mcpAddForm, setMcpAddForm] = useState<{ baseUrl: string; name: string; id: string; timeoutMs?: number }>({ baseUrl: '', name: '', id: '' })
		const [mcpDiscovering, setMcpDiscovering] = useState(false)
		const [mcpDiscovered, setMcpDiscovered] = useState<any[] | null>(null)

		// Registered MCP servers (displayed in MCP Tools tab)
		const [mcpServers, setMcpServers] = useState<any[]>([])
		const [mcpLoading, setMcpLoading] = useState(false)
		const [mcpError, setMcpError] = useState<string | null>(null)
		const [deregistering, setDeregistering] = useState<string | null>(null)
		const [mcpDetailsOpen, setMcpDetailsOpen] = useState(false)
		const [mcpDetailsServer, setMcpDetailsServer] = useState<any | null>(null)

		const fetchMcpServers = async () => {
			if (!settings?.flowServiceUrl) {
				setMcpError('Missing flowServiceUrl')
				return
			}
			setMcpLoading(true)
			setMcpError(null)
			try {
				console.debug('[LeftPanel] fetchMcpServers: calling listRegisteredMcpServers', { flowServiceUrl: settings.flowServiceUrl })
				const list = await listRegisteredMcpServers(settings.flowServiceUrl)
				console.debug('[LeftPanel] fetchMcpServers: received', { length: Array.isArray(list) ? list.length : null, sample: (Array.isArray(list) && list.length>0) ? list[0] : list })
				// API responds with { success:true, data: { count, servers: [...] } } in some setups
				if (list && !Array.isArray(list) && (list as any).data && Array.isArray((list as any).data.servers)) {
					setMcpServers((list as any).data.servers)
				} else {
					setMcpServers(Array.isArray(list) ? list : [])
				}
			} catch (e: any) {
				console.error('[LeftPanel] fetchMcpServers: error', e)
				setMcpError(e?.message || 'Failed to load MCP servers')
			} finally {
				setMcpLoading(false)
			}
		}

		const verifyAndDiscoverMcp = async () => {
			const base = mcpAddForm.baseUrl.trim().replace(/\/$/, '')
			if (!base) { toast({ title: 'Enter base URL' }); return }
			if (!settings.flowServiceUrl) { toast({ title: 'Missing flowServiceUrl', variant: 'destructive' }); return }
			setMcpDiscovering(true); setMcpDiscovered(null)
			try {
				const arr = await withApiErrorToast(listMcpTools(settings.flowServiceUrl, { baseUrl: base, timeoutMs: mcpAddForm.timeoutMs }), toast, 'Discover MCP tools')
				setMcpDiscovered(arr)
				if (!arr || arr.length === 0) toast({ title: 'No tools discovered', description: 'Server returned no tools' })
			} catch (e:any) {
				setMcpDiscovered([])
			} finally { setMcpDiscovering(false) }
		}

		const handleRegisterDiscovered = async (selectedNames: string[]) => {
			if (!settings.flowServiceUrl) return
			const base = mcpAddForm.baseUrl.trim().replace(/\/$/, '')
			const picked = (mcpDiscovered||[]).filter((t:any)=> selectedNames.includes(t.name))
			if (picked.length === 0) { toast({ title: 'Nothing selected' }); return }
			try {
				const toolPayload = (mcpDiscovered||[]).map((t:any)=> ({ name: t.name, enabled: selectedNames.includes(t.name) }))
				await withApiErrorToast(registerMcpServer(settings.flowServiceUrl, { baseUrl: base, name: mcpAddForm.name || undefined, id: mcpAddForm.id || undefined, timeoutMs: mcpAddForm.timeoutMs, tools: toolPayload }), toast, 'Register MCP server')
				toast({ title: 'MCP server registered', description: base })
				setMcpAddOpen(false)
				setMcpDiscovered(null)
				setMcpAddForm({ baseUrl: '', name: '', id: '' })
				// refresh the list after registration
				fetchMcpServers()
			} catch (e:any) { /* handled by toast wrapper */ }
		}

		const handleDeregister = async (s: any, index?: number) => {
			if (!settings?.flowServiceUrl) return
			const key = s?.id || s?.endpoint || s?.baseUrl || String(index || '')
			if (!confirm('Deregister MCP server ' + (s?.name || key) + '?')) return
			setDeregistering(key)
			try {
				await withApiErrorToast(deregisterMcpServer(settings.flowServiceUrl, { id: s?.id, baseUrl: s?.baseUrl || s?.endpoint }), toast, 'Deregister MCP server')
				toast({ title: 'Deregistered', description: s?.baseUrl || s?.endpoint || key })
				// refresh list
				fetchMcpServers()
			} catch (e:any) {
				// error already shown by wrapper
			} finally {
				setDeregistering(null)
			}
		}

		const handleWorkflowSelect = async (id: string) => {
			setLoadingWorkflow(true)
			setWorkflowError(null)
			try {
				if (settings.flowServiceUrl) {
					const res = await fetchWorkflow(settings.flowServiceUrl, id)
					const swf = res?.data || res
					try {
						const g = serverToGraph(swf)
						setWfNodes(g.graph.nodes || [])
						setWfEdges(g.graph.edges || [])
						setWorkflowGraphCache(prev => ({ ...prev, [id]: { nodes: g.graph.nodes || [], edges: g.graph.edges || [] } }))
					} catch (e) {
						// fallback: try raw arrays if conversion not possible
						const nodes = res?.data?.nodes || res?.nodes || []
						const edges = res?.data?.edges || res?.edges || []
						setWfNodes(nodes)
						setWfEdges(edges)
					}
				}
				setSelectedWorkflowId(id)
				// notify FlowWorkspace (which listens for this global event)
				try { window.dispatchEvent(new CustomEvent('goflow-explorer-select', { detail: { id } })) } catch {}
			} catch (e: any) {
				setWorkflowError(e?.message || 'Failed to load workflow')
			} finally {
				setLoadingWorkflow(false)
			}
		}

		const handleDeleteWorkflow = async (id: string) => {
			if (!settings.flowServiceUrl) return
			if (!confirm('Delete workflow ' + id + '?')) return
			setLoading(true)
			try {
				await deleteWorkflowApi(settings.flowServiceUrl, id)
				setWorkflows((list) => list.filter(w => w.id !== id))
				// inform FlowWorkspace about deletion
				try { window.dispatchEvent(new CustomEvent('goflow-workflow-deleted', { detail: { id } })) } catch {}
			} catch (e: any) {
				setError(e?.message || 'Failed to delete workflow')
			} finally {
				setLoading(false)
			}
		}

		const handleCreateWorkflow = async () => {
			if (!settings.flowServiceUrl) return
			setLoading(true)
			try {
				const newId = `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`
				const name = `Workflow ${newId.slice(-4)}`
				const empty = { id: newId, name, description: '', colorSets: [], places: [], transitions: [], arcs: [], initialMarking: {}, declarations: {} }
				await withApiErrorToast(saveWorkflow(settings.flowServiceUrl, empty), toast, 'Create workflow')
				setWorkflows((list) => ([...(Array.isArray(list) ? list : []), { id: newId, name }]))
				setWorkflowGraphCache(prev => ({ ...prev, [newId]: { nodes: [], edges: [] } }))
				setSelectedWorkflowId(newId)
				// notify canvas and fetch details for the new workflow
				try { window.dispatchEvent(new CustomEvent('goflow-explorer-select', { detail: { id: newId } })) } catch {}
				await handleWorkflowSelect(newId)
			} catch (e:any) {
				setError(e?.message || 'Failed to create workflow')
			} finally {
				setLoading(false)
			}
		}

		const handleRefresh = () => fetchList()

		useEffect(() => {
			if (activeTab === "workflow" && isOpen) fetchList()
			if (activeTab === "mcp-tools" && isOpen) fetchMcpServers()

			const onGraphUpdate = (e: any) => {
				const wfId = e?.detail?.workflowId
				const graph = e?.detail?.graph
				if (wfId && graph) setWorkflowGraphCache(prev => ({ ...prev, [wfId]: graph }))
			}
			window.addEventListener('goflow-explorer-graph-updated', onGraphUpdate as EventListener)
			return () => window.removeEventListener('goflow-explorer-graph-updated', onGraphUpdate as EventListener)
		}, [activeTab, isOpen, settings.flowServiceUrl])

		const renderTabContent = () => {
			switch (activeTab) {
				case "components":
					return <ComponentsTab />
				case "structure":
					return <PageStructureTab />
				case "pages":
					return <PagesTab />
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
					if (loading) return <div className="p-4 text-center text-muted-foreground">Loading workflows...</div>
					if (error) return <div className="p-4 text-center text-destructive">{error}</div>
					return <ExplorerPanel
						workflows={workflows}
						nodes={wfNodes}
						edges={wfEdges}
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
				case "mcp-tools":
					return (
						<>
							<div className="flex-1 p-4">
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2">
										<Button size="sm" variant="outline" onClick={() => fetchMcpServers()} disabled={mcpLoading}>Refresh</Button>
										<Button onClick={() => { setMcpAddOpen(true) }}>Add Server</Button>
									</div>
								</div>

								{mcpLoading ? (
									<div className="text-sm text-center py-6">Loading...</div>
								) : mcpError ? (
									<div className="text-sm text-destructive">{mcpError}</div>
								) : mcpServers.length === 0 ? (
									<div className="text-sm text-neutral-500">No registered MCP servers.</div>
								) : (
									<div className="grid gap-3">
										{mcpServers.map((s: any, i: number) => {
											const key = s.id || s.endpoint || s.baseUrl || String(i)
											const toolsCount = (typeof s.toolCount === 'number') ? s.toolCount : (s.tools && Array.isArray(s.tools) ? s.tools.length : 0)
											return (
												<div key={key} className="p-3 rounded border bg-card flex items-start justify-between">
													<div className="flex-1">
														<div className="text-sm font-semibold">{s.name || '-'}</div>
														<div className="text-xs text-muted-foreground break-words">{s.endpoint || s.baseUrl || '-'}</div>
													</div>
													<div className="ml-3 flex items-start gap-2">
														<div className="text-sm text-blue-600 font-medium">{toolsCount}</div>
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<button className="size-6 p-1 rounded hover:bg-accent"> <MoreVertical className="w-4 h-4" /> </button>
															</DropdownMenuTrigger>
															<DropdownMenuContent sideOffset={6} align="end">
																<DropdownMenuItem onClick={() => { setMcpDetailsServer(s); setMcpDetailsOpen(true) }}>Details</DropdownMenuItem>
																<DropdownMenuItem onClick={() => handleDeregister(s, i)}>Delete</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</div>
												</div>
											)
										})}
									</div>
								)}
							</div>

							{/* Local MCP Add Dialog rendered in LeftPanel */}
							<Dialog open={mcpAddOpen} onOpenChange={setMcpAddOpen}>
								<DialogContent className="max-w-xl">
									<DialogHeader>
										<DialogTitle>Add MCP server</DialogTitle>
										<DialogDescription>Enter the MCP httpstream base URL and discover tools to register.</DialogDescription>
									</DialogHeader>
									<div className="space-y-2 text-xs">
										<div className="flex items-center gap-2">
											<label className="w-24 text-right">Base URL</label>
											<input className="flex-1 rounded border px-2 py-1" placeholder="https://data.lizhao.net/api/mcp" value={mcpAddForm.baseUrl} onChange={e=>setMcpAddForm(f=>({...f, baseUrl: e.target.value }))} />
										</div>
										<div className="flex items-center gap-2">
											<label className="w-24 text-right">Name</label>
											<input className="flex-1 rounded border px-2 py-1" placeholder="Optional label" value={mcpAddForm.name} onChange={e=>setMcpAddForm(f=>({...f, name: e.target.value }))} />
										</div>
										<div className="flex items-center gap-2">
											<label className="w-24 text-right">Server ID</label>
											<input className="flex-1 rounded border px-2 py-1" placeholder="Optional identifier" value={mcpAddForm.id} onChange={e=>setMcpAddForm(f=>({...f, id: e.target.value }))} />
										</div>
										<div className="flex items-center gap-2">
											<label className="w-24 text-right">Timeout (ms)</label>
											<input className="w-40 rounded border px-2 py-1" type="number" placeholder="8000" value={mcpAddForm.timeoutMs||''} onChange={e=>setMcpAddForm(f=>({...f, timeoutMs: e.target.value? Number(e.target.value): undefined }))} />
										</div>
										<div className="flex items-center gap-2 justify-end">
											<Button size="sm" variant="secondary" onClick={verifyAndDiscoverMcp} disabled={mcpDiscovering}>{mcpDiscovering? 'Discovering…' : 'Discover Tools'}</Button>
										</div>
										{Array.isArray(mcpDiscovered) && (
											<div className="max-h-60 overflow-auto rounded border">
												<table className="w-full text-xs">
													<thead className="bg-neutral-50 text-neutral-600">
														<tr>
															<th className="px-2 py-1 text-left">Enabled</th>
															<th className="px-2 py-1 text-left">Name</th>
															<th className="px-2 py-1 text-left">Description</th>
														</tr>
													</thead>
													<tbody>
														{mcpDiscovered.map((t:any, i:number) => (
															<tr key={i} className="odd:bg-white even:bg-neutral-50">
																<td className="border-t px-2 py-1"><input type="checkbox" onChange={(e)=>{ const name=t.name; setMcpDiscovered(arr=>{ const next=(arr||[]).map((x:any)=> ({...x})); const idx=next.findIndex((x:any)=>x.name===name); if (idx>=0) next[idx]._selected = e.target.checked; return next }) }} /></td>
																<td className="border-t px-2 py-1">{t.name}</td>
																<td className="border-t px-2 py-1">{t.description || ''}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										)}
									</div>
									<DialogFooter>
										<Button variant="secondary" onClick={()=> setMcpAddOpen(false)}>Cancel</Button>
										<Button onClick={()=> handleRegisterDiscovered((mcpDiscovered||[]).filter((t:any)=>t._selected).map((t:any)=>t.name))} disabled={!Array.isArray(mcpDiscovered) || (mcpDiscovered||[]).every((t:any)=>!t._selected)}>Register Selected</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>

							{/* MCP Details Dialog (read-only) */}
							<Dialog open={mcpDetailsOpen} onOpenChange={setMcpDetailsOpen}>
								<DialogContent className="max-w-lg">
									<DialogHeader>
										<DialogTitle>MCP Server Details</DialogTitle>
										<DialogDescription>Registered MCP server information (read only)</DialogDescription>
									</DialogHeader>
									<div className="space-y-2 text-sm">
										<div className="flex items-center gap-2">
											<div className="w-28 text-right text-xs text-muted-foreground">Name</div>
											<div className="flex-1 font-semibold">{mcpDetailsServer?.name || '-'}</div>
										</div>
										<div className="flex items-center gap-2">
											<div className="w-28 text-right text-xs text-muted-foreground">Endpoint</div>
											<div className="flex-1 text-xs text-muted-foreground break-words">{mcpDetailsServer?.endpoint || mcpDetailsServer?.baseUrl || '-'}</div>
										</div>
										<div className="flex items-center gap-2">
											<div className="w-28 text-right text-xs text-muted-foreground">Server ID</div>
											<div className="flex-1 text-xs">{mcpDetailsServer?.id || '-'}</div>
										</div>
										<div className="flex items-center gap-2">
											<div className="w-28 text-right text-xs text-muted-foreground">Tools</div>
											<div className="flex-1 text-xs text-blue-600">{(mcpDetailsServer?.tools && Array.isArray(mcpDetailsServer.tools)) ? mcpDetailsServer.tools.length : (typeof mcpDetailsServer?.toolCount === 'number' ? mcpDetailsServer.toolCount : 0)}</div>
										</div>
										{mcpDetailsServer?.tools && Array.isArray(mcpDetailsServer.tools) && (
											<div className="max-h-48 overflow-auto rounded border p-2 text-xs">
												{mcpDetailsServer.tools.map((t:any, idx:number) => {
													const name = typeof t === 'string' ? t : (t?.name || String(t))
													const enabled = typeof t === 'object' ? (t?.enabled ?? t?.Enabled ?? true) : true
													return (
														<div key={idx} className="py-1 border-b last:border-b-0 flex items-center justify-between">
															<div className="truncate">{name}</div>
															<div className={enabled ? 'text-xs px-2 py-0.5 rounded bg-green-50 text-green-700' : 'text-xs px-2 py-0.5 rounded bg-muted/10 text-muted-foreground'}>
																{enabled ? 'Enabled' : 'Disabled'}
															</div>
														</div>
													)
												})}
											</div>
										)}
									</div>
									<DialogFooter>
										<Button variant="secondary" onClick={() => setMcpDetailsOpen(false)}>Close</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</>
					)
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
						return (
							<button
								key={tab.id}
								onClick={() => {
									setActiveTab(tab.id)
									if (!isOpen) onOpen()
								}}
								className={`w-12 h-12 flex items-center justify-center border-b border-border hover:bg-accent transition-colors group relative ${
									activeTab === tab.id && isOpen ? "bg-accent text-accent-foreground" : "text-muted-foreground"
								}`}
								title={tab.label}
							>
								<IconComponent className="w-5 h-5" />
								{/* Tooltip */}
								<div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
									{tab.label}
								</div>
							</button>
						)
					})}
				</div>

				{/* Panel content, only if open */}
				{isOpen && (
					<div className="flex-1 flex flex-col overflow-hidden min-w-[200px] max-w-[600px]">
						{/* visual resizer handled by parent ResizeHandle; no decorative knob here to avoid duplication */}
						{/* Reusable header bar */}
						<div className="flex items-center justify-between border-b px-3 py-2">
							<div className="text-sm font-semibold">{tabs.find(t => t.id === activeTab)?.label}</div>
							<div className="flex items-center gap-1">
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

// --- Data Sidebar Implementation (Phase 1) ---

// Shared Section Component
const Section: React.FC<{ id:string; title:string; children:React.ReactNode; actions?:React.ReactNode; expanded: { [k:string]: boolean }; setExpanded: (fn: (s: { [k:string]: boolean }) => { [k:string]: boolean }) => void }> = ({ id, title, children, actions, expanded, setExpanded }) => {
	const open = expanded[id]
	return (
		<div className="rounded border bg-background/50">
			<div className="flex items-center justify-between px-2 py-1.5 border-b">
				<button onClick={()=> setExpanded(s=>({ ...s, [id]: !open }))} className="flex-1 flex items-center gap-2 text-left">
					<span className="text-xs font-semibold tracking-wide">{title}</span>
					<span className="ml-auto text-[10px] text-muted-foreground">{open ? '−' : '+'}</span>
				</button>
				{actions}
			</div>
			{open && <div className="p-2 space-y-2 text-xs">{children}</div>}
		</div>
	)
}

const DataSidebar: React.FC = () => {
	// System settings for API configuration
	const { settings } = useSystemSettings()
	
	// FileStore-based data sources and queries
	const { dataSources, loading: dsLoading, error: dsError, fetchDataSources, createDataSource, updateDataSource, deleteDataSource, testDataSource, testingIds } = useDataSourceStore()
	const { queries, loading: queryLoading, fetchQueries, createQuery, updateQuery, deleteQuery, executeQuery, executingIds } = useQueryStore()
	
	const [adding, setAdding] = useState(false)
	const [creating, setCreating] = useState(false)
	const [newName, setNewName] = useState('')
	const [newType, setNewType] = useState<DataSource['type']>('mongodb')
	const [expanded, setExpanded] = useState<{ [k:string]: boolean }>({ ds: true, queries: true, history: false })
	
	// Configuration dialog state
	const [configOpen, setConfigOpen] = useState(false)
	const [configDsId, setConfigDsId] = useState<string | null>(null)
	const [savingConfig, setSavingConfig] = useState(false)
	
	// Query creation dialog state
	const [showQueryDialog, setShowQueryDialog] = useState(false)
	const [queryForm, setQueryForm] = useState<{
		name: string;
		description?: string;
		data_source_id: string;
		query_type: 'folder' | 'sql' | 'select';
		query?: string;
		parameters?: Record<string, any>;
		filters?: { maxFileSize?: number; allowedExtensions?: string[] };
	}>({
		name: '',
		data_source_id: '',
		query_type: 'folder'
	})
	const [queryParams, setQueryParams] = useState<Array<{ key: string; value: string }>>([])
	const [creatingQuery, setCreatingQuery] = useState(false)
	const [configForm, setConfigForm] = useState<{
		__name?: string;
		// GCS fields
		bucketName?: string; serviceAccountKey?: string; projectId?: string; region?: string;
		// S3 fields
		accessKey?: string; secretKey?: string; endpoint?: string;
		// Database fields
		host?: string; port?: string; database?: string; username?: string; password?: string; uri?: string;
		// Internal UI state
		[k: string]: any;
	}>({})

	const resetQueryForm = React.useCallback(() => {
		setQueryForm({ name: '', data_source_id: '', query_type: 'folder' })
		setQueryParams([])
	}, [])

	const handleQueryDialogOpenChange = React.useCallback((open: boolean) => {
		setShowQueryDialog(open)
		if (!open) {
			resetQueryForm()
		}
	}, [resetQueryForm])

	const handleOpenQueryDialog = React.useCallback(() => {
		resetQueryForm()
		setShowQueryDialog(true)
	}, [resetQueryForm])

	const syncParamDefaults = React.useCallback((entries: Array<{ key: string; value: string }>) => {
		setQueryParams(entries)
		setQueryForm((prev) => {
			const existingParams = { ...(prev.parameters || {}) }
			if ('paramDefaults' in existingParams) {
				delete (existingParams as any).paramDefaults
			}
			const defaults: Record<string, string> = {}
			for (const entry of entries) {
				const trimmedKey = entry.key.trim()
				if (!trimmedKey) continue
				defaults[trimmedKey] = entry.value
			}
			const nextParameters = { ...existingParams }
			if (Object.keys(defaults).length > 0) {
				;(nextParameters as any).paramDefaults = defaults
			}
			const hasParams = Object.keys(nextParameters).length > 0
			return {
				...prev,
				parameters: hasParams ? nextParameters : undefined,
			}
		})
	}, [])

	const handleAddParam = React.useCallback(() => {
		syncParamDefaults([...queryParams, { key: '', value: '' }])
	}, [queryParams, syncParamDefaults])

	const handleParamChange = React.useCallback(
		(index: number, field: 'key' | 'value', value: string) => {
			const next = queryParams.map((entry, idx) => (idx === index ? { ...entry, [field]: value } : entry))
			syncParamDefaults(next)
		},
		[queryParams, syncParamDefaults],
	)

	const handleRemoveParam = React.useCallback(
		(index: number) => {
			const next = queryParams.filter((_, idx) => idx !== index)
			syncParamDefaults(next)
		},
		[queryParams, syncParamDefaults],
	)

	useEffect(() => {
		if (!showQueryDialog) return
		const defaults = (() => {
			const raw = queryForm.parameters as any
			const paramDefaults = raw?.paramDefaults
			if (paramDefaults && typeof paramDefaults === 'object' && !Array.isArray(paramDefaults)) {
				return Object.entries(paramDefaults).map(([key, value]) => ({ key, value: value == null ? '' : String(value) }))
			}
			return []
		})()
		syncParamDefaults(defaults)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [showQueryDialog])

	const saveConfig = async () => {
		setSavingConfig(true)
		try {
			if (!configDsId) return
			const current = (dataSources || []).find(d => d.id === configDsId)
			if (!current) return
			
			const payload: Partial<DataSource> = {
				name: configForm.__name || current.name
			}
			
			if (current.type === 'gcs') {
				// GCS configuration
				payload.config = {
					bucketName: configForm.bucketName,
					projectId: configForm.projectId,
					region: configForm.region
				}
				payload.credentials = {
					apiKey: configForm.serviceAccountKey
				}
			} else if (current.type === 's3') {
				// S3 configuration
				payload.config = {
					bucketName: configForm.bucketName,
					region: configForm.region,
					endpoint: configForm.endpoint
				}
				payload.credentials = {
					accessKey: configForm.accessKey,
					secretKey: configForm.secretKey
				}
			} else {
				// Database configuration
				payload.config = {
					host: configForm.host,
					port: configForm.port ? Number(configForm.port) : undefined,
					database: configForm.database,
					uri: configForm.uri
				}
				payload.credentials = {
					username: configForm.username,
					password: configForm.password
				}
			}
			
			await updateDataSource(settings?.flowServiceUrl || '', configDsId, payload)
			toast({ title: 'Saved' })
		} catch(e:any) {
			toast({ title: 'Save failed', description: e?.message || 'Unable to save', variant:'destructive' })
		} finally {
			setSavingConfig(false)
		}
	}

	useEffect(() => { 
		if (settings?.flowServiceUrl) {
			fetchDataSources(settings.flowServiceUrl).catch(()=>{})
			fetchQueries(settings.flowServiceUrl).catch(()=>{})
		}
	}, [fetchDataSources, fetchQueries, settings?.flowServiceUrl])

	const handleCreate = async () => {
		if (!newName.trim()) return
		setCreating(true)
		try {
			const config = newType === 'mongodb' ? { database: 'app' } : 
								newType === 'gcs' ? { bucketName: '', projectId: '', region: 'us-central1' } :
								newType === 's3' ? { bucketName: '', region: 'us-east-1' } :
								{ host: 'localhost', port: newType === 'postgres' ? 5432 : 3306, database: 'app' }
			
			await createDataSource(settings?.flowServiceUrl || '', { 
				name: newName.trim(), 
				type: newType, 
				config,
				enabled: true
			})
			setNewName('')
			setAdding(false)
		} catch (e:any) {
			toast({ title: 'Create failed', description: e?.message || 'Unable to create datasource', variant: 'destructive' })
		} finally { setCreating(false) }
	}

	const handleTest = async (id: string) => {
		try {
			await testDataSource(settings?.flowServiceUrl || '', id)
			toast({ title: 'Test complete', description: 'Data source connection successful' })
		} catch(e:any) {
			toast({ title: 'Test failed', description: e?.message || 'Connection error', variant: 'destructive' })
		}
	}

	const handleDelete = async (id: string) => {
		try {
			await deleteDataSource(settings?.flowServiceUrl || '', id)
			toast({ title: 'Deleted', description: 'Data source removed successfully' })
		} catch(e:any) {
			toast({ title: 'Delete failed', description: e?.message || 'Unable to delete', variant: 'destructive' })
		}
	}

	const handleCreateQuery = async () => {
		if (!queryForm.name.trim() || !queryForm.data_source_id || !queryForm.query_type) {
			toast({ title: 'Validation Error', description: 'Name, data source, and query type are required', variant: 'destructive' })
			return
		}
		
		setCreatingQuery(true)
		try {
			await createQuery(settings?.flowServiceUrl || '', {
				...queryForm,
				name: queryForm.name.trim(),
				enabled: true
			})
			handleQueryDialogOpenChange(false)
			toast({ title: 'Query Created', description: 'Query definition saved successfully' })
		} catch (e: any) {
			toast({ title: 'Create failed', description: e?.message || 'Unable to create query', variant: 'destructive' })
		} finally {
			setCreatingQuery(false)
		}
	}

	return (
		<>
		<div className="flex-1 flex flex-col overflow-auto p-3 gap-3 text-xs">
			<Section id="ds" title={`Data Sources (${(dataSources || []).length})`} expanded={expanded} setExpanded={setExpanded} actions={
				<div className="flex items-center gap-1 pr-1">
					<Button size="icon" variant="ghost" className="h-6 w-6" onClick={()=> fetchDataSources(settings?.flowServiceUrl || '')} disabled={dsLoading} title="Refresh data sources"><RefreshCw className={cn('h-3.5 w-3.5', dsLoading && 'animate-spin')} /></Button>
					<Button size="icon" variant="ghost" className="h-6 w-6" onClick={()=> setAdding(true)} title="Add data source"><Plus className="h-3.5 w-3.5" /></Button>
				</div>
			}>
				{dsLoading && <div className="text-muted-foreground">Loading…</div>}
				{dsError && <div className="text-destructive">{dsError}</div>}
				{!dsLoading && (dataSources || []).length === 0 && <div className="text-muted-foreground">No data sources yet</div>}
				<div className="space-y-1">
					{(dataSources || []).map((ds: DataSource) => {
						const statusColor = ds.test_status === 'healthy' ? 'bg-green-500' : ds.test_status === 'error' ? 'bg-red-500' : 'bg-neutral-400'
						return (
							<div key={ds.id} className="group border rounded px-2 py-1 flex flex-col gap-1 hover:bg-accent/40">
								<div className="flex items-center gap-2">
									<div className={cn('h-2 w-2 rounded-full flex-shrink-0', statusColor)} />
									<div className="flex-1 leading-tight overflow-hidden">
										<div className="truncate font-medium text-[11px]">{ds.name}</div>
										<div className="truncate text-[10px] text-muted-foreground">{ds.type}{ds.test_latency_ms && ` • ${ds.test_latency_ms}ms`}</div>
										{ds.description && <div className="truncate text-[9px] text-muted-foreground">{ds.description}</div>}
									</div>
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button size="icon" variant="ghost" className="h-5 w-5" title="Test" onClick={()=> handleTest(ds.id)} disabled={testingIds.has(ds.id)}><Beaker className={cn('h-3 w-3', testingIds.has(ds.id) && 'animate-pulse')} /></Button>
										<Button size="icon" variant="ghost" className="h-5 w-5" title="Configure" onClick={()=> { setConfigDsId(ds.id); setConfigOpen(true); setConfigForm({ __name: ds.name, ...ds.config, ...ds.credentials }) }}><Wrench className="h-3 w-3" /></Button>
										<Button size="icon" variant="ghost" className="h-5 w-5 text-red-600" title="Delete" onClick={()=> handleDelete(ds.id)}><Trash2 className="h-3 w-3" /></Button>
									</div>
								</div>
								{ds.config && (
									<div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-muted-foreground mt-1">
										{ds.config.host && <><span>Host</span><span className="truncate">{ds.config.host}</span></>}
										{ds.config.port && <><span>Port</span><span>{ds.config.port}</span></>}
										{ds.config.database && <><span>DB</span><span className="truncate">{ds.config.database}</span></>}
										{ds.config.bucketName && <><span>Bucket</span><span className="truncate">{ds.config.bucketName}</span></>}
										{ds.config.region && <><span>Region</span><span className="truncate">{ds.config.region}</span></>}
									</div>
								)}
								{ds.test_error && (
									<div className="text-[9px] text-red-600 mt-1 truncate">{ds.test_error}</div>
								)}
							</div>
						)
					})}
				</div>
				{adding && (
					<div className="mt-2 p-2 border rounded space-y-2 bg-background/80">
						<div>
							<input autoFocus onKeyDown={e=> { e.stopPropagation() }} className="w-full px-2 py-1 rounded border text-xs" placeholder="Datasource name" value={newName} onChange={e=> setNewName(e.target.value)} />
						</div>
						<div className="flex items-center gap-2 justify-between">
							<select className="px-2 py-1 rounded border text-xs relative z-50" value={newType} onChange={e=> setNewType(e.target.value as DataSource['type'])}>
								<option value="mongodb">MongoDB</option>
								<option value="postgres">PostgreSQL</option>
								<option value="mysql">MySQL</option>
								<option value="s3">Amazon S3</option>
								<option value="gcs">Google Cloud Storage</option>
							</select>
							<Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>{creating ? 'Saving…' : 'Save'}</Button>
						</div>
					</div>
				)}
			</Section>

			<QueriesSection expanded={expanded} setExpanded={setExpanded} openQueryDialog={handleOpenQueryDialog} />
			<HistorySection expanded={expanded} setExpanded={setExpanded} />
		</div>
		<Dialog open={configOpen} onOpenChange={setConfigOpen}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Configure Datasource</DialogTitle>
					<DialogDescription>Edit connection parameters (stored securely server-side).</DialogDescription>
				</DialogHeader>
				{(() => {
					const current = (dataSources || []).find((d: DataSource) => d.id === configDsId)
					if (!current) return <div>Data source not found</div>
					
					return (
						<div className="space-y-4 text-xs">
							<div className="space-y-2">
								<label className="text-[11px] font-semibold">Data Source Name</label>
								<input className="w-full px-2 py-1 rounded border" value={configForm.__name ?? current.name ?? ''} onChange={e=> setConfigForm(f=> ({ ...f, __name: e.target.value }))} placeholder="Name" />
							</div>
							
							<div className="space-y-2">
								<label className="text-[11px] font-semibold">Description (optional)</label>
								<textarea className="w-full px-2 py-1 rounded border resize-none" rows={2} value={configForm.description ?? current.description ?? ''} onChange={e=> setConfigForm(f=> ({ ...f, description: e.target.value }))} placeholder="Brief description of this data source" />
							</div>

							{current.type === 'gcs' && (
								<>
									<div className="space-y-2">
										<label className="text-[11px] font-semibold">Bucket Name</label>
										<input className="w-full px-2 py-1 rounded border" value={configForm.bucketName||''} onChange={e=> setConfigForm(f=>({...f, bucketName: e.target.value }))} placeholder="my-gcs-bucket" />
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div className="space-y-1">
											<label className="text-[11px] font-semibold">Project ID</label>
											<input className="px-2 py-1 rounded border" value={configForm.projectId||''} onChange={e=> setConfigForm(f=>({...f, projectId: e.target.value }))} placeholder="my-project-123" />
										</div>
										<div className="space-y-1">
											<label className="text-[11px] font-semibold">Region</label>
											<input className="px-2 py-1 rounded border" value={configForm.region||''} onChange={e=> setConfigForm(f=>({...f, region: e.target.value }))} placeholder="us-central1" />
										</div>
									</div>
									<div className="space-y-2">
										<label className="text-[11px] font-semibold">Service Account Key (JSON)</label>
										<textarea className="w-full px-2 py-1 rounded border resize-none" rows={4} value={configForm.serviceAccountKey||''} onChange={e=> setConfigForm(f=>({...f, serviceAccountKey: e.target.value }))} placeholder='{"type": "service_account", "project_id": "..."}' />
									</div>
								</>
							)}

							{current.type === 's3' && (
								<>
									<div className="space-y-2">
										<label className="text-[11px] font-semibold">Bucket Name</label>
										<input className="w-full px-2 py-1 rounded border" value={configForm.bucketName||''} onChange={e=> setConfigForm(f=>({...f, bucketName: e.target.value }))} placeholder="my-s3-bucket" />
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div className="space-y-1">
											<label className="text-[11px] font-semibold">Access Key ID</label>
											<input className="px-2 py-1 rounded border" value={configForm.accessKey||''} onChange={e=> setConfigForm(f=>({...f, accessKey: e.target.value }))} placeholder="AKIAIOSFODNN7EXAMPLE" />
										</div>
										<div className="space-y-1">
											<label className="text-[11px] font-semibold">Secret Access Key</label>
											<input type="password" className="px-2 py-1 rounded border" value={configForm.secretKey||''} onChange={e=> setConfigForm(f=>({...f, secretKey: e.target.value }))} placeholder="***" />
										</div>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div className="space-y-1">
											<label className="text-[11px] font-semibold">Region</label>
											<input className="px-2 py-1 rounded border" value={configForm.region||''} onChange={e=> setConfigForm(f=>({...f, region: e.target.value }))} placeholder="us-east-1" />
										</div>
										<div className="space-y-1">
											<label className="text-[11px] font-semibold">Endpoint (optional)</label>
											<input className="px-2 py-1 rounded border" value={configForm.endpoint||''} onChange={e=> setConfigForm(f=>({...f, endpoint: e.target.value }))} placeholder="https://s3.amazonaws.com" />
										</div>
									</div>
								</>
							)}

							{(current.type === 'mongodb' || current.type === 'postgres' || current.type === 'mysql') && (
								<>
									<div className="space-y-2">
										<label className="text-[11px] font-semibold">Connection URI (optional)</label>
										<input className="w-full px-2 py-1 rounded border" value={configForm.uri||''} onChange={e=> setConfigForm(f=>({...f, uri: e.target.value }))} placeholder={current.type === 'mongodb' ? 'mongodb://user:pass@host:27017/db' : current.type === 'postgres' ? 'postgres://user:pass@host:5432/db' : 'mysql://user:pass@host:3306/db'} />
										<p className="text-[10px] text-muted-foreground">If provided, individual fields below are ignored.</p>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div className="space-y-1">
											<label className="text-[11px] font-semibold">Host</label>
											<input className="px-2 py-1 rounded border" value={configForm.host||''} onChange={e=> setConfigForm(f=>({...f, host: e.target.value }))} placeholder="localhost" />
										</div>
										<div className="space-y-1">
											<label className="text-[11px] font-semibold">Port</label>
											<input className="px-2 py-1 rounded border" value={configForm.port||''} onChange={e=> setConfigForm(f=>({...f, port: e.target.value }))} placeholder={current.type === 'mongodb' ? '27017' : current.type === 'postgres' ? '5432' : '3306'} />
										</div>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div className="space-y-1">
											<label className="text-[11px] font-semibold">Database</label>
											<input className="px-2 py-1 rounded border" value={configForm.database||''} onChange={e=> setConfigForm(f=>({...f, database: e.target.value }))} placeholder="mydb" />
										</div>
										<div className="space-y-1">
											<label className="text-[11px] font-semibold">Username</label>
											<input className="px-2 py-1 rounded border" value={configForm.username||''} onChange={e=> setConfigForm(f=>({...f, username: e.target.value }))} placeholder="user" />
										</div>
									</div>
									<div className="space-y-2">
										<label className="text-[11px] font-semibold">Password</label>
										<input type="password" className="w-full px-2 py-1 rounded border" value={configForm.password||''} onChange={e=> setConfigForm(f=>({...f, password: e.target.value }))} placeholder="***" />
									</div>
								</>
							)}
							
							<p className="text-[10px] text-muted-foreground">Credentials are stored securely and never returned to the client.</p>
						</div>
					)
				})()}
				<DialogFooter className="flex items-center justify-between gap-2">
					{(() => { const current = (dataSources || []).find((d: DataSource) => d.id === configDsId); return (
						<div className="flex flex-col mr-auto text-[11px] gap-1 max-w-[240px]">
							<div className="flex items-center gap-2">
								{current?.test_status && <span className={cn('px-2 py-0.5 rounded border', current.test_status==='healthy' ? 'bg-green-50 border-green-300 text-green-700' : current.test_status==='error' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-neutral-50 border-neutral-300 text-neutral-600')}>{current.test_status}</span>}
								{current?.test_latency_ms && <span className="text-muted-foreground">{current.test_latency_ms}ms</span>}
							</div>
							{current?.test_error && (
								<div className="text-[10px] leading-snug text-red-600 line-clamp-3 break-words">
									{current.test_error}
								</div>
							)}
						</div>
					)})()}
					<Button variant="ghost" size="sm" onClick={()=> setConfigOpen(false)}>Close</Button>
					{configDsId && <Button size="sm" variant="outline" onClick={()=> handleTest(configDsId)} disabled={savingConfig || testingIds.has(configDsId)}>{testingIds.has(configDsId) ? 'Testing…':'Test'}</Button>}
					<Button size="sm" variant="secondary" onClick={saveConfig} disabled={savingConfig}>{savingConfig? 'Saving…':'Save'}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
		
		{/* Query Creation Dialog */}
		<Dialog open={showQueryDialog} onOpenChange={handleQueryDialogOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Create Query Definition</DialogTitle>
					<DialogDescription>Create a new query definition based on filestore.sh patterns.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 text-xs">
					<div className="space-y-2">
						<label className="text-[11px] font-semibold">Query Name</label>
						<input 
							className="w-full px-2 py-1 rounded border" 
							value={queryForm.name} 
							onChange={e => setQueryForm(f => ({ ...f, name: e.target.value }))} 
							placeholder="e.g., GCS Unit Test Query" 
						/>
					</div>
					
					<div className="space-y-2">
						<label className="text-[11px] font-semibold">Description (optional)</label>
						<textarea 
							className="w-full px-2 py-1 rounded border resize-none" 
							rows={2}
							value={queryForm.description || ''} 
							onChange={e => setQueryForm(f => ({ ...f, description: e.target.value }))} 
							placeholder="Brief description of this query" 
						/>
					</div>

					<div className="space-y-2">
						<label className="text-[11px] font-semibold">Data Source</label>
						<select 
							className="w-full px-2 py-1 rounded border" 
							value={queryForm.data_source_id} 
							onChange={e => setQueryForm(f => ({ ...f, data_source_id: e.target.value }))}
						>
							<option value="">Select data source...</option>
							{(dataSources || []).map(ds => (
								<option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>
							))}
						</select>
					</div>

					<div className="space-y-2">
						<label className="text-[11px] font-semibold">Query Type</label>
						<select 
							className="w-full px-2 py-1 rounded border" 
							value={queryForm.query_type} 
							onChange={e => setQueryForm(f => ({ ...f, query_type: e.target.value as 'folder' | 'sql' | 'select' }))}
						>
							<option value="folder">Folder (for GCS/S3)</option>
							<option value="sql">SQL Query</option>
							<option value="select">Select Query</option>
						</select>
					</div>

					{queryForm.query_type === 'folder' && (
						<>
							<div className="space-y-2">
								<label className="text-[11px] font-semibold">Folder Path</label>
								<input 
									className="w-full px-2 py-1 rounded border" 
									value={queryForm.parameters?.folderPath || ''} 
									onChange={e => setQueryForm(f => ({ 
										...f, 
										parameters: { 
											...f.parameters, 
											folderPath: e.target.value,
											recursive: true,
											includeMetadata: true
										}
									}))} 
									placeholder="e.g., gcs_unit_test" 
								/>
							</div>
							<div className="space-y-2">
								<label className="text-[11px] font-semibold">Max File Size (bytes)</label>
								<input 
									type="number"
									className="w-full px-2 py-1 rounded border" 
									value={queryForm.filters?.maxFileSize || 10485760} 
									onChange={e => setQueryForm(f => ({ 
										...f, 
										filters: { 
											...f.filters, 
											maxFileSize: parseInt(e.target.value) || 10485760
										}
									}))} 
								/>
							</div>
							<div className="space-y-2">
								<label className="text-[11px] font-semibold">Allowed Extensions (comma-separated)</label>
								<input 
									className="w-full px-2 py-1 rounded border" 
									value={queryForm.filters?.allowedExtensions?.join(', ') || ''} 
									onChange={e => setQueryForm(f => ({ 
										...f, 
										filters: { 
											...f.filters, 
											allowedExtensions: e.target.value.split(',').map(ext => ext.trim()).filter(Boolean)
										}
									}))} 
									placeholder=".md, .txt, .json, .yaml, .pdf"
								/>
							</div>
						</>
					)}

					{(queryForm.query_type === 'sql' || queryForm.query_type === 'select') && (
						<div className="space-y-2">
							<label className="text-[11px] font-semibold">Query</label>
							<textarea 
								className="w-full px-2 py-1 rounded border resize-none font-mono" 
								rows={4}
								value={queryForm.query || ''} 
								onChange={e => setQueryForm(f => ({ ...f, query: e.target.value }))} 
								placeholder="SELECT * FROM users WHERE email = ?" 
							/>
						</div>
					)}

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label className="text-[11px] font-semibold">Query Parameters</label>
							<Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={handleAddParam}>Add</Button>
						</div>
						{queryParams.length === 0 ? (
							<div className="rounded border border-dashed px-2 py-2 text-[11px] text-muted-foreground">
								Optional key/value parameters used for templating (e.g., {'${search}'}).
							</div>
						) : (
							<div className="space-y-2">
								{queryParams.map((param, index) => (
									<div key={index} className="grid grid-cols-7 gap-2">
										<input
											className="col-span-3 rounded border px-2 py-1 text-xs"
											placeholder="paramKey"
											value={param.key}
											onChange={(e) => handleParamChange(index, 'key', e.target.value)}
										/>
										<input
											className="col-span-3 rounded border px-2 py-1 text-xs"
											placeholder="Default value"
											value={param.value}
											onChange={(e) => handleParamChange(index, 'value', e.target.value)}
										/>
										<Button
											type="button"
											size="icon"
											variant="ghost"
											className="h-7 w-7 text-red-500"
											onClick={() => handleRemoveParam(index)}
										>
											×
										</Button>
									</div>
								))}
							</div>
						)}
						<div className="text-[10px] text-muted-foreground">
							Reference parameters within your query using {'${paramKey}'} placeholders.
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button variant="ghost" size="sm" onClick={() => handleQueryDialogOpenChange(false)}>Cancel</Button>
					<Button size="sm" variant="secondary" onClick={handleCreateQuery} disabled={creatingQuery}>
						{creatingQuery ? 'Creating...' : 'Create Query'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
		</>
	)
}

// Queries Section Component
	const QueriesSection: React.FC<{ 
		expanded: { [k:string]: boolean }; 
		setExpanded: (fn: (s: { [k:string]: boolean }) => { [k:string]: boolean }) => void;
		openQueryDialog: () => void;
	}> = ({ expanded, setExpanded, openQueryDialog }) => {
	const { settings } = useSystemSettings()
	const { queries, deleteQuery, executeQuery, executingIds } = useQueryStore()
	const { setResult, setS3Result, setDatasource, setS3Input, setGcsQueryParams, setMongoInput, setSqlInput } = useQueryExecutionStore()
	const [searchTerm, setSearchTerm] = useState('')
		const allQueries = queries || []
	
		const filteredQueries = allQueries.filter((q: QueryDefinition) =>
		q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
		(q.description && q.description.toLowerCase().includes(searchTerm.toLowerCase()))
	)

	const handleLoadQuery = (query: QueryDefinition) => {
		// Navigate to data workspace with query loaded
		try { 
			window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries', queryId: query.id } })) 
		} catch {}
	}

	const handleRunQuery = async (query: QueryDefinition) => {
		try {
			const result = await executeQuery(settings?.flowServiceUrl || '', query.id)
			
			// Set the active datasource in QueryEditor so currentDatasource is not null
			setDatasource(query.data_source_id)
			
			// Populate QueryEditor's input fields with query parameters
			if (query.query_type === 'folder') {
				// For GCS/S3 folder queries
				const folderPath = query.parameters?.folder_path || '/'
				setS3Input(folderPath.startsWith('/') ? folderPath.slice(1) : folderPath)
				
				// Set GCS query parameters for the form
				setGcsQueryParams({
					folderPath: folderPath,
					recursive: query.parameters?.recursive ?? true,
					includeMetadata: query.parameters?.include_metadata ?? true,
					showHidden: query.parameters?.show_hidden ?? false,
					maxFileSize: query.parameters?.max_file_size,
					allowedExtensions: query.parameters?.allowed_extensions || ['.pdf', '.txt', '.json', '.md', '.csv', '.xml', '.dat']
				})
			} else if (query.query_type === 'sql') {
				// For SQL queries
				setSqlInput(query.query || 'SELECT 1')
			} else if (query.query_type === 'select') {
				// For MongoDB queries (assuming 'select' maps to mongo aggregation)
				setMongoInput(query.parameters?.pipeline ? JSON.stringify(query.parameters.pipeline, null, 2) : '[\n  { "$limit": 50 }\n]')
			}
			
			// Update QueryEditor's result state for preview
			if (query.query_type === 'folder') {
				// Transform to S3QueryResult format for GCS/S3 queries
				const s3Result = {
					files: result.rows.map((row: any) => ({
						key: row.name || row.key || row.filename || 'Unknown',
						size: Number(row.size) || 0,
						lastModified: new Date(row.modified || row.lastModified || row.last_modified || Date.now()),
						etag: row.etag || row.hash || 'unknown',
						isFolder: row.type === 'folder' || row.isFolder || false,
						contentType: row.content_type || row.contentType
					})),
					prefix: query.parameters?.folder_path || '/',
					totalFiles: result.rows.length,
					meta: {
						executionMs: result.meta.executionMs,
						datasourceId: result.meta.datasourceId || query.data_source_id
					}
				}
				setS3Result(s3Result)
			} else {
				// Regular SQL/Mongo query result
				setResult(result)
			}
			
			// Check if this might be mock data
			const isMockData = result.meta.executionMs === 0 || 
				result.rows.some(row => row.type === 'mock' || row.name?.includes('Sample'))
			
			if (isMockData) {
				toast({ 
					title: 'Query executed (Mock Data)', 
					description: 'Server returned placeholder data - query execution may not be fully implemented',
					variant: 'default'
				})
			} else {
				toast({ title: 'Query executed', description: 'Results are available in the data workspace' })
			}
			
			// Navigate to data workspace
			window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries', queryId: query.id } }))
		} catch (e: any) {
			toast({ title: 'Query failed', description: e?.message || 'Execution error', variant: 'destructive' })
		}
	}

	const handleDeleteQuery = async (query: QueryDefinition) => {
		try {
			await deleteQuery(settings?.flowServiceUrl || '', query.id)
			toast({ title: 'Deleted', description: 'Query definition removed' })
		} catch (e: any) {
			toast({ title: 'Delete failed', description: e?.message || 'Unable to delete', variant: 'destructive' })
		}
	}

	return (
		<Section id="queries" title={`Query Definitions (${allQueries.length})`} expanded={expanded} setExpanded={setExpanded} actions={
			<div className="flex gap-1">
				<Button size="icon" variant="ghost" className="h-6 w-6" onClick={openQueryDialog} title="Create New Query">
					<Plus className="h-3.5 w-3.5" />
				</Button>
				<Button size="icon" variant="ghost" className="h-6 w-6" onClick={()=> { try { window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries' } })) } catch {} }} title="Open Query Builder">
					<Wrench className="h-3.5 w-3.5" />
				</Button>
			</div>
		}>
			{allQueries.length === 0 ? (
				<>
					<div className="text-muted-foreground">No query definitions yet. Create queries in the Data workspace.</div>
					<Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={()=> { try { window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries' } })) } catch {} }}>Open Query Builder</Button>
				</>
			) : (
				<>
					{allQueries.length > 3 && (
						<input
							className="px-2 py-1 rounded border text-xs mb-2"
							placeholder="Search queries..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					)}
					<div className="space-y-1">
						{filteredQueries.slice(0, 10).map((query: QueryDefinition) => (
							<div key={query.id} className="group border rounded px-2 py-1 hover:bg-accent/40">
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadQuery(query)}>
										<div className="truncate font-medium text-[11px]">{query.name}</div>
										<div className="text-[10px] text-muted-foreground truncate">
											{query.description || `${query.query_type} query`}
										</div>
										<div className="text-[9px] text-muted-foreground">
											{new Date(query.updatedAt || query.createdAt || '').toLocaleDateString()}
										</div>
									</div>
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button size="icon" variant="ghost" className="h-4 w-4" title="Run" onClick={(e) => { e.stopPropagation(); handleRunQuery(query) }} disabled={executingIds.has(query.id)}>
											<Play className={cn('h-2.5 w-2.5', executingIds.has(query.id) && 'animate-pulse')} />
										</Button>
										<Button size="icon" variant="ghost" className="h-4 w-4 text-red-600" title="Delete" onClick={(e) => { e.stopPropagation(); handleDeleteQuery(query) }}>
											<Trash2 className="h-2.5 w-2.5" />
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				</>
			)}
		</Section>
	)
}

// Execution History Section Component (simplified for FileStore)
const HistorySection: React.FC<{ expanded: { [k:string]: boolean }; setExpanded: (fn: (s: { [k:string]: boolean }) => { [k:string]: boolean }) => void }> = ({ expanded, setExpanded }) => {
	const { executionResults } = useQueryStore()
	const recentExecutions = Object.entries(executionResults).slice(-10)

	return (
		<Section id="history" title={`Recent Executions (${recentExecutions.length})`} expanded={expanded} setExpanded={setExpanded} actions={<></>}>
			{recentExecutions.length === 0 ? (
				<div className="text-muted-foreground">No recent executions. Run queries to see history.</div>
			) : (
				<div className="space-y-1">
					{recentExecutions.map(([queryId, execution]) => (
						<div key={queryId} className="border rounded px-2 py-1 hover:bg-accent/40">
							<div className="text-[10px] text-muted-foreground truncate">
								Query: {queryId}
							</div>
							<div className="text-[9px] text-muted-foreground flex items-center gap-2">
								<span>{execution.result.rows.length} results</span>
								<span>{execution.result.meta.executionMs}ms</span>
								{execution.result.meta.executionMs === 0 && (
									<span className="text-orange-500 text-[8px]">mock</span>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</Section>
	)
}

