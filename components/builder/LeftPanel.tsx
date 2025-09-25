"use client"


import type React from "react"
import { useState, useEffect } from "react"
import { ComponentsTab } from "./tabs/ComponentsTab"
import { PageStructureTab } from "./tabs/PageStructureTab"
import ExplorerPanel from "../petri/explorer-panel"
import { Layers, FileText, TreePine, Database, BookText, Workflow, X, Wrench, MoreVertical } from "lucide-react"
import { Button } from "../ui/button"


const tabs = [
	{ id: "components", label: "Components", icon: Layers },
	{ id: "pages", label: "Pages", icon: FileText },
	{ id: "structure", label: "Structure", icon: TreePine },
	{ id: "data", label: "Data", icon: Database },
	{ id: "schema", label: "Schema", icon: BookText },
	{ id: "workflow", label: "Workflow", icon: Workflow },
	{ id: "mcp-tools", label: "MCP Tools", icon: Wrench },
]

import { fetchWorkflowList, fetchWorkflow, deleteWorkflowApi, listMcpTools, registerMcpServer, withApiErrorToast, listRegisteredMcpServers, deregisterMcpServer } from "../petri/petri-client"
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
}
	export const LeftPanel: React.FC<LeftPanelProps> = ({ isOpen, onClose, onOpen, activeTab, setActiveTab }) => {
		const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([])
		const [loading, setLoading] = useState(false)
		const [error, setError] = useState<string | null>(null)
		const { settings } = useSystemSettings()

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
					return (
						<div className="flex-1 p-4">
							<div className="text-center text-muted-foreground">
								<h3 className="font-medium mb-2">Pages</h3>
								<p className="text-sm">Page management coming soon...</p>
							</div>
						</div>
					)
				case "data":
					return (
						<div className="flex-1 p-4">
							<div className="text-center text-muted-foreground">
								<h3 className="font-medium mb-2">Data Source</h3>
								<p className="text-sm">Data source management coming soon...</p>
							</div>
						</div>
					)
				case "schema":
					return (
						<div className="flex-1 p-4">
							<div className="text-center text-muted-foreground">
								<h3 className="font-medium mb-2">Schema</h3>
								<p className="text-sm">Schema management coming soon...</p>
							</div>
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
						onDeleteWorkflow={handleDeleteWorkflow}
						onRefreshWorkflows={handleRefresh}
						onSelectEntity={(kind,id) => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-entity-select', { detail: { kind, id } })); } catch {} }}
						onAddPlace={() => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-add-place', { detail: { workflowId: selectedWorkflowId } })); } catch {} }}
						onAddTransition={() => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-add-transition', { detail: { workflowId: selectedWorkflowId } })); } catch {} }}
						onDeletePlace={(id: string) => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-delete-place', { detail: { id, workflowId: selectedWorkflowId } })); } catch {} }}
						onDeleteTransition={(id: string) => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-delete-transition', { detail: { id, workflowId: selectedWorkflowId } })); } catch {} }}
						onDeleteArc={(id: string) => { try { window.dispatchEvent(new CustomEvent('goflow-explorer-delete-arc', { detail: { id, workflowId: selectedWorkflowId } })); } catch {} }}
					/>
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
