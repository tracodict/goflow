"use client"


import type React from "react"
import { useState, useEffect } from "react"
import { ComponentsTab } from "./tabs/ComponentsTab"
import { PageStructureTab } from "./tabs/PageStructureTab"
import ExplorerPanel from "../petri/explorer-panel"
import { Layers, FileText, TreePine, Database, BookText, Workflow, X, Wrench, MoreVertical, RefreshCw, Plus, Play, Beaker, Trash2 } from "lucide-react"
import { Button } from "../ui/button"
import { useDatasourceStore } from '@/stores/datasource'
import { useSavedQueriesStore, SavedQuery } from '@/stores/saved-queries'
import { useQueryStore, QueryHistoryItem } from '@/stores/query'
import { createDatasource, testDatasource } from '@/lib/datasource-client'
import { cn } from '@/lib/utils'


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
					// Datasource sidebar (Phase 1) using goflow design language
					return <DataSidebar />
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
	const { datasources, loading, error, fetchDatasources, connectDatasource } = useDatasourceStore()
	const { fetchDetail, patchDatasource } = useDatasourceStore()
	const currentDs = datasources.find(d => d.id === (typeof window !== 'undefined' ? (document as any).activeDatasourceId : undefined))
	const [adding, setAdding] = useState(false)
	const [creating, setCreating] = useState(false)
	const [newName, setNewName] = useState('')
	const [newType, setNewType] = useState<'mongo'|'postgres'|'mysql'|'s3'>('mongo')
	const [expanded, setExpanded] = useState<{ [k:string]: boolean }>({ ds: true, queries: true, history: true })
	const [testingId, setTestingId] = useState<string | null>(null)
	// legacy local latency removed; rely on store persistence
		const [configOpen, setConfigOpen] = useState(false)
		const [configDsId, setConfigDsId] = useState<string | null>(null)
		interface ConfigForm { 
			uri?: string; host?: string; port?: string; database?: string; user?: string; password?: string; 
			__name?: string; __err?: string; __hosts?: string[];
			// S3 specific fields
			provider?: string; accessKey?: string; secretKey?: string; region?: string; bucket?: string; 
			endpoint?: string; serviceAccountKey?: string; projectId?: string; pathPrefix?: string;
		}
		const [configForm, setConfigForm] = useState<ConfigForm>({})
		const [savingConfig, setSavingConfig] = useState(false)

		const saveConfig = async () => {
			if (!configDsId) return
			setSavingConfig(true)
			try {
				const current = datasources.find(d=> d.id===configDsId)
				const engine = current?.type || 'mongo'
				
				if (engine === 's3') {
					// S3 configuration
					const config = {
						provider: configForm.provider || 'amazon',
						bucket: configForm.bucket,
						pathPrefix: configForm.pathPrefix
					}
					const secret = {
						provider: configForm.provider || 'amazon', // Include provider in secret for backend validation
						...(configForm.provider === 'amazon' ? {
							accessKey: configForm.accessKey,
							secretKey: configForm.secretKey,
							region: configForm.region,
							endpoint: configForm.endpoint
						} : {}),
						...(configForm.provider === 'google' ? {
							serviceAccountKey: configForm.serviceAccountKey,
							projectId: configForm.projectId
						} : {})
					}
					await patchDatasource(configDsId, { name: configForm.__name, config, secret })
				} else {
					// SQL database configuration
					await patchDatasource(configDsId, { 
						name: configForm.__name, 
						config: { database: configForm.database }, 
						secret: { 
							uri: configForm.uri, 
							host: configForm.host, 
							port: configForm.port? Number(configForm.port): undefined, 
							user: configForm.user, 
							password: configForm.password, 
							database: configForm.database 
						} 
					})
				}
				
				fetchDatasources()
				toast({ title: 'Saved' })
			} catch(e:any) {
				toast({ title: 'Save failed', description: e?.message || 'Unable to save', variant:'destructive' })
			} finally {
				setSavingConfig(false)
			}
		}

	useEffect(() => { fetchDatasources().catch(()=>{}) }, [fetchDatasources])

	const handleCreate = async () => {
		if (!newName.trim()) return
		setCreating(true)
		try {
			await createDatasource({ name: newName.trim(), type: newType, config: { database: 'app' } })
			setNewName('')
			setAdding(false)
			fetchDatasources()
		} catch (e:any) {
			toast({ title: 'Create failed', description: e?.message || 'Unable to create datasource', variant: 'destructive' })
		} finally { setCreating(false) }
	}

	  const handleTest = async (id: string) => {
	    setTestingId(id)
	    try {
	      const res = await testDatasource(id).catch(()=>({ ok:true as boolean }))
	      toast({ title: 'Test complete', description: (res as any)?.ok ? 'Datasource reachable' : 'Test finished' })
	    } catch(e:any) {
	      toast({ title: 'Test failed', description: e?.message || 'Connection error', variant: 'destructive' })
	    } finally { setTestingId(null) }
	  }

	const handleConnect = async (id: string) => {
	  setTestingId(id)
	  try {
	    await connectDatasource(id)
	    toast({ title: 'Connected', description: 'Status updated' })
	  } catch(e:any) {
	    toast({ title: 'Connect failed', description: e?.message || 'Error', variant: 'destructive' })
	  } finally { setTestingId(null) }
	}

	return (
		<>
		<div className="flex-1 flex flex-col overflow-auto p-3 gap-3 text-xs">
			<Section id="ds" title={`Datasources (${datasources.length})`} expanded={expanded} setExpanded={setExpanded} actions={
				<div className="flex items-center gap-1 pr-1">
					<Button size="icon" variant="ghost" className="h-6 w-6" onClick={()=> fetchDatasources()} disabled={loading} title="Refresh datasources"><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /></Button>
					<Button size="icon" variant="ghost" className="h-6 w-6" onClick={()=> setAdding(true)} title="Add datasource"><Plus className="h-3.5 w-3.5" /></Button>
				</div>
			}>
				{loading && <div className="text-muted-foreground">Loading…</div>}
				{error && <div className="text-destructive">{error}</div>}
				{!loading && datasources.length === 0 && <div className="text-muted-foreground">No datasources yet</div>}
				<div className="space-y-1">
					{datasources.map(ds => {
						const statusColor = ds.status === 'healthy' ? 'bg-green-500' : ds.status === 'error' ? 'bg-red-500' : 'bg-neutral-400'
						const pv: any = (ds as any).connectionPreview
						return (
							<div key={ds.id} className="group border rounded px-2 py-1 flex flex-col gap-1 hover:bg-accent/40">
								<div className="flex items-center gap-2">
									<div className={cn('h-2 w-2 rounded-full flex-shrink-0', statusColor)} />
									<div className="flex-1 leading-tight overflow-hidden">
										<div className="truncate font-medium text-[11px]">{ds.name}</div>
										<div className="truncate text-[10px] text-muted-foreground">{ds.type}{typeof (ds as any).lastLatencyMs === 'number' && ` • ${(ds as any).lastLatencyMs}ms`}</div>
									</div>
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button size="icon" variant="ghost" className="h-5 w-5" title="Test" onClick={()=> handleTest(ds.id)} disabled={testingId===ds.id}><Beaker className={cn('h-3 w-3', testingId===ds.id && 'animate-pulse')} /></Button>
										<Button size="icon" variant="ghost" className="h-5 w-5" title="Connect" onClick={()=> handleConnect(ds.id)} disabled={testingId===ds.id}><Play className={cn('h-3 w-3', testingId===ds.id && 'animate-pulse')} /></Button>
										<Button size="icon" variant="ghost" className="h-5 w-5" title="Configure" onClick={async ()=> { setConfigDsId(ds.id); setConfigOpen(true); const det = await fetchDetail(ds.id); setConfigForm(f=> ({ ...f, database: det?.configPublic?.database || f.database })) }}><Wrench className="h-3 w-3" /></Button>
									</div>
								</div>
								{pv && (
									<div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-muted-foreground mt-1">
										{pv.uri && <><span className="uppercase tracking-wide">URI</span><span className="truncate">{pv.uri}</span></>}
										{pv.host && <><span>Host</span><span className="truncate">{pv.host}</span></>}
										{pv.port && <><span>Port</span><span>{pv.port}</span></>}
										{pv.database && <><span>DB</span><span className="truncate">{pv.database}</span></>}
										{pv.user && <><span>User</span><span className="truncate">{pv.user}</span></>}
										{pv.password && <><span>Pass</span><span>***</span></>}
									</div>
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
							<select className="px-2 py-1 rounded border text-xs relative z-50" value={newType} onChange={e=> setNewType(e.target.value as any)}>
								<option value="mongo">Mongo</option>
								<option value="postgres">Postgres</option>
								<option value="mysql">MySQL</option>
								<option value="s3">S3</option>
							</select>
							<Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>{creating ? 'Saving…' : 'Save'}</Button>
						</div>
					</div>
				)}
			</Section>

			<QueriesSection expanded={expanded} setExpanded={setExpanded} />
			<HistorySection expanded={expanded} setExpanded={setExpanded} />
		</div>
		<Dialog open={configOpen} onOpenChange={setConfigOpen}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Configure Datasource</DialogTitle>
					<DialogDescription>Edit connection parameters (stored securely server-side).</DialogDescription>
				</DialogHeader>
				{(() => {
					const current = datasources.find(d=> d.id===configDsId)
					const engine = current?.type || 'mongo'
					
					if (engine === 's3') {
						// S3 Configuration UI
						return (
							<div className="space-y-4 text-xs">
								<div className="space-y-2">
									<label className="text-[11px] font-semibold">Datasource Name</label>
									<input className="px-2 py-1 rounded border" value={configForm['__name'] ?? current?.name ?? ''} onChange={e=> setConfigForm(f=> ({ ...f, ['__name']: e.target.value }))} placeholder="Name" />
								</div>
								<div className="space-y-2">
									<label className="text-[11px] font-semibold">Provider</label>
									<select className="px-2 py-1 rounded border w-full" value={configForm.provider || 'amazon'} onChange={e=> setConfigForm(f=> ({ ...f, provider: e.target.value }))}>
										<option value="amazon">Amazon S3</option>
										<option value="google">Google Cloud Storage</option>
									</select>
								</div>
								
								{configForm.provider === 'amazon' && (
									<>
										<div className="space-y-2">
											<label className="text-[11px] font-semibold">Access Key ID</label>
											<input className="px-2 py-1 rounded border" value={configForm.accessKey||''} onChange={e=> setConfigForm(f=>({...f, accessKey: e.target.value }))} placeholder="AKIAIOSFODNN7EXAMPLE" />
										</div>
										<div className="space-y-2">
											<label className="text-[11px] font-semibold">Secret Access Key</label>
											<input type="password" className="px-2 py-1 rounded border" value={configForm.secretKey||''} onChange={e=> setConfigForm(f=>({...f, secretKey: e.target.value }))} placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" />
										</div>
										<div className="grid grid-cols-2 gap-2">
											<div className="space-y-1">
												<label className="text-[11px] font-semibold">Region</label>
												<input className="px-2 py-1 rounded border" value={configForm.region||''} onChange={e=> setConfigForm(f=>({...f, region: e.target.value }))} placeholder="us-east-1" />
											</div>
											<div className="space-y-1">
												<label className="text-[11px] font-semibold">Bucket</label>
												<input className="px-2 py-1 rounded border" value={configForm.bucket||''} onChange={e=> setConfigForm(f=>({...f, bucket: e.target.value }))} placeholder="my-bucket" />
											</div>
										</div>
										<div className="space-y-2">
											<label className="text-[11px] font-semibold">Endpoint (optional)</label>
											<input className="px-2 py-1 rounded border" value={configForm.endpoint||''} onChange={e=> setConfigForm(f=>({...f, endpoint: e.target.value }))} placeholder="https://s3.amazonaws.com" />
											<p className="text-[10px] text-muted-foreground">Leave empty for standard AWS S3. Use for S3-compatible services.</p>
										</div>
									</>
								)}
								
								{configForm.provider === 'google' && (
									<>
										<div className="space-y-2">
											<label className="text-[11px] font-semibold">Service Account Key (JSON)</label>
											<textarea className="px-2 py-1 rounded border resize-none" rows={4} value={configForm.serviceAccountKey||''} onChange={e=> setConfigForm(f=>({...f, serviceAccountKey: e.target.value }))} placeholder='{"type": "service_account", "project_id": "..."}' />
										</div>
										<div className="grid grid-cols-2 gap-2">
											<div className="space-y-1">
												<label className="text-[11px] font-semibold">Project ID</label>
												<input className="px-2 py-1 rounded border" value={configForm.projectId||''} onChange={e=> setConfigForm(f=>({...f, projectId: e.target.value }))} placeholder="my-project-123" />
											</div>
											<div className="space-y-1">
												<label className="text-[11px] font-semibold">Bucket</label>
												<input className="px-2 py-1 rounded border" value={configForm.bucket||''} onChange={e=> setConfigForm(f=>({...f, bucket: e.target.value }))} placeholder="my-bucket" />
											</div>
										</div>
									</>
								)}
								
								<div className="space-y-2">
									<label className="text-[11px] font-semibold">Path Prefix (optional)</label>
									<input className="px-2 py-1 rounded border" value={configForm.pathPrefix||''} onChange={e=> setConfigForm(f=>({...f, pathPrefix: e.target.value }))} placeholder="data/" />
									<p className="text-[10px] text-muted-foreground">Filter files to a specific folder path within the bucket.</p>
								</div>
								
								<p className="text-[10px] text-muted-foreground">Press Save to persist (in-memory for now). Connection credentials never echoed back.</p>
							</div>
						)
					}
					
					// SQL Database Configuration UI (existing logic)
					const disableIndividual = !!configForm.uri
					const [uriError, setUriError] = [configForm['__err'] as any, (msg: string | null)=> setConfigForm(f=> ({ ...f, ['__err']: msg || undefined }))]
					const [hostsParsed, setHostsParsed] = [configForm['__hosts'] as any[] | undefined, (hosts: string[] | undefined)=> setConfigForm(f=> ({ ...f, ['__hosts']: hosts }))]
					const parseAndSet = (val:string) => {
						if (!val) { setConfigForm(f=> ({ ...f, uri: '', host: '', port: '', user: '', password: '', database: f.database, __err: undefined, __hosts: undefined })) ; return }
						try {
							let original = val.trim()
							let protoAdjusted = original
							const isMongo = /^mongodb(\+srv)?:\/\//i.test(original)
							if (isMongo && protoAdjusted.startsWith('mongodb+srv://')) protoAdjusted = protoAdjusted.replace('mongodb+srv://', 'mongodb://')
							// Custom multi-host extraction for mongo before URL (URL only keeps first host)
							let multiHosts: string[] | undefined
							if (isMongo) {
								const noProto = original.replace(/^mongodb(?:\+srv)?:\/\//,'')
								const credsAndRest = noProto.split('@')
								const afterCreds = credsAndRest.length>1 ? credsAndRest.slice(1).join('@') : credsAndRest[0]
								const pathIdx = afterCreds.indexOf('/')
								const hostSegment = pathIdx === -1 ? afterCreds : afterCreds.slice(0, pathIdx)
								multiHosts = hostSegment.split(',').map(h=> h.trim()).filter(Boolean)
							}
							const u = new URL(protoAdjusted)
							const db = u.pathname && u.pathname !== '/' ? decodeURIComponent(u.pathname.slice(1)) : ''
							setHostsParsed(multiHosts)
							setConfigForm({ uri: original, host: u.hostname, port: u.port, user: u.username, password: u.password, database: db, __name: configForm.__name })
							setUriError(null)
						} catch (err:any) { setUriError('Invalid connection string'); setConfigForm(f=> ({ ...f, uri: val })) }
					}
					
					return (
						<div className="space-y-4 text-xs">
							<div className="space-y-2">
								<label className="text-[11px] font-semibold">Datasource Name</label>
								<input className="px-2 py-1 rounded border" value={configForm['__name'] ?? current?.name ?? ''} onChange={e=> setConfigForm(f=> ({ ...f, ['__name']: e.target.value }))} placeholder="Name" />
							</div>
							<div className="space-y-2">
								<label className="text-[11px] font-semibold flex items-center gap-2">Connection String ({engine}) {uriError && <span className="text-red-500 text-[10px] font-normal">{uriError}</span>}</label>
								<input className={cn('px-2 py-1 rounded border', uriError && 'border-red-500 focus:ring-red-500')} placeholder={engine==='mongo' ? 'mongodb://user:pass@host1,host2:27017/db' : engine==='postgres' ? 'postgres://user:pass@host:5432/db' : 'mysql://user:pass@host:3306/db'} value={configForm.uri||''} onChange={e=> parseAndSet(e.target.value)} />
								<p className="text-[10px] text-muted-foreground">If provided, individual host/port/user/password fields are ignored.</p>
								{hostsParsed && hostsParsed.length>1 && (
									<div className="text-[10px] bg-muted/40 rounded p-2 flex flex-wrap gap-1">
										{hostsParsed.map(h=> <span key={h} className="px-1.5 py-0.5 bg-background rounded border text-[10px]">{h}</span>)}
									</div>
								)}
							</div>
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<label className="text-[11px] font-semibold">Host</label>
									<input disabled={disableIndividual} className="px-2 py-1 rounded border disabled:opacity-50" value={configForm.host||''} onChange={e=> setConfigForm(f=>({...f, host: e.target.value }))} />
								</div>
								<div className="space-y-1">
									<label className="text-[11px] font-semibold">Port</label>
									<input disabled={disableIndividual} className="px-2 py-1 rounded border disabled:opacity-50" value={configForm.port||''} onChange={e=> setConfigForm(f=>({...f, port: e.target.value }))} placeholder={engine==='postgres' ? '5432' : engine==='mysql' ? '3306' : '27017'} />
								</div>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<label className="text-[11px] font-semibold">Database</label>
									<input disabled={false} className="px-2 py-1 rounded border" value={configForm.database||''} onChange={e=> setConfigForm(f=>({...f, database: e.target.value }))} />
								</div>
								<div className="space-y-1">
									<label className="text-[11px] font-semibold">User</label>
									<input disabled={disableIndividual} className="px-2 py-1 rounded border disabled:opacity-50" value={configForm.user||''} onChange={e=> setConfigForm(f=>({...f, user: e.target.value }))} />
								</div>
							</div>
							<div className="space-y-1">
								<label className="text-[11px] font-semibold">Password</label>
								<input disabled={disableIndividual} type="password" className="px-2 py-1 rounded border disabled:opacity-50" value={configForm.password||''} onChange={e=> setConfigForm(f=>({...f, password: e.target.value }))} />
							</div>
							<div className="grid grid-cols-3 gap-3 pt-1">
								{engine==='mongo' && (
									<label className="flex items-center gap-2 text-[11px] font-medium"><input type="checkbox" disabled={disableIndividual} onChange={e=> setConfigForm(f=> ({ ...f, ['__tls']: e.target.checked }))} checked={!!(configForm as any).__tls} /> TLS</label>
								)}
								{engine==='postgres' && (
									<div className="space-y-1">
										<label className="text-[11px] font-semibold">SSL Mode</label>
										<select className="px-2 py-1 rounded border text-[11px]" value={(configForm as any).__sslmode || 'prefer'} onChange={e=> setConfigForm(f=> ({ ...f, ['__sslmode']: e.target.value }))}>
											<option value="disable">disable</option>
											<option value="allow">allow</option>
											<option value="prefer">prefer</option>
											<option value="require">require</option>
											<option value="verify-ca">verify-ca</option>
											<option value="verify-full">verify-full</option>
										</select>
									</div>
								)}
								{engine==='mysql' && (
									<label className="flex items-center gap-2 text-[11px] font-medium"><input type="checkbox" disabled={disableIndividual} onChange={e=> setConfigForm(f=> ({ ...f, ['__ssl']: e.target.checked }))} checked={!!(configForm as any).__ssl} /> SSL</label>
								)}
							</div>
							{engine==='mongo' && (
								<p className="text-[10px] text-muted-foreground">Supports standard & +srv URIs. Multi-host and replica set options parsed.</p>
							)}
							<p className="text-[10px] text-muted-foreground">Press Save to persist (in-memory for now). Connection secrets never echoed back.</p>
						</div>
					)
				})()}
				<DialogFooter className="flex items-center justify-between gap-2">
					{(() => { const current = datasources.find(d=> d.id===configDsId); return (
						<div className="flex flex-col mr-auto text-[11px] gap-1 max-w-[240px]">
							<div className="flex items-center gap-2">
								{current?.status && <span className={cn('px-2 py-0.5 rounded border', current.status==='healthy' ? 'bg-green-50 border-green-300 text-green-700' : current.status==='error' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-neutral-50 border-neutral-300 text-neutral-600')}>{current.status}</span>}
								{(current as any)?.lastLatencyMs && <span className="text-muted-foreground">{(current as any).lastLatencyMs}ms</span>}
							</div>
							{current && (current as any).lastError && (
								<div className="text-[10px] leading-snug text-red-600 line-clamp-3 break-words">
									{(current as any).lastError}
								</div>
							)}
						</div>
					)})()}
					<Button variant="ghost" size="sm" onClick={()=> setConfigOpen(false)}>Close</Button>
					{configDsId && <Button size="sm" variant="outline" onClick={()=> handleTest(configDsId)} disabled={savingConfig || testingId===configDsId}>{testingId===configDsId ? 'Testing…':'Test'}</Button>}
					{configDsId && <Button size="sm" variant="outline" onClick={()=> handleConnect(configDsId)} disabled={savingConfig || testingId===configDsId}>{testingId===configDsId ? 'Connecting…':'Connect'}</Button>}
					<Button size="sm" variant="secondary" onClick={saveConfig} disabled={savingConfig}>{savingConfig? 'Saving…':'Save'}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
		</>
	)
}

// Queries Section Component
const QueriesSection: React.FC<{ expanded: { [k:string]: boolean }; setExpanded: (fn: (s: { [k:string]: boolean }) => { [k:string]: boolean }) => void }> = ({ expanded, setExpanded }) => {
	const { queries, deleteQuery, openQuery, hydrated, hydrate } = useSavedQueriesStore()
	const { setMongoInput, setSqlInput, runMongo, runSql, setDatasource } = useQueryStore()
	const [searchTerm, setSearchTerm] = useState('')
	
	// Hydrate saved queries on component mount
	useEffect(() => {
		if (!hydrated) {
			hydrate()
		}
	}, [hydrated, hydrate])
	
	const filteredQueries = queries.filter(q => 
		q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
		q.content.toLowerCase().includes(searchTerm.toLowerCase())
	)

	const handleLoadQuery = (query: SavedQuery) => {
		openQuery(query) // This handles all the state setting including collection/table
		
		// Navigate to data workspace
		try { 
			window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries' } })) 
		} catch {}
	}

	const handleRunQuery = (query: SavedQuery) => {
		openQuery(query) // This handles all the state setting including collection/table
		
		// Run the query after loading it
		if (query.datasourceId) {
			if (query.type === 'mongo') {
				runMongo()
			} else {
				runSql()
			}
		}
		
		// Navigate to data workspace
		try { 
			window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries' } })) 
		} catch {}
	}

	return (
		<Section id="queries" title={`Saved Queries (${queries.length})`} expanded={expanded} setExpanded={setExpanded} actions={
			<Button size="icon" variant="ghost" className="h-6 w-6" onClick={()=> { try { window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries' } })) } catch {} }} title="Open Query Builder">
				<Plus className="h-3.5 w-3.5" />
			</Button>
		}>
			{queries.length === 0 ? (
				<>
					<div className="text-muted-foreground">None yet – build queries in the Data workspace.</div>
					<Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={()=> { try { window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries' } })) } catch {} }}>Open Query Builder</Button>
				</>
			) : (
				<>
					{queries.length > 3 && (
						<input
							className="px-2 py-1 rounded border text-xs mb-2"
							placeholder="Search queries..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					)}
					<div className="space-y-1">
						{filteredQueries.slice(0, 10).map((query) => (
							<div key={query.name} className="group border rounded px-2 py-1 hover:bg-accent/40">
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadQuery(query)}>
										<div className="truncate font-medium text-[11px]">{query.name}</div>
										<div className="text-[10px] text-muted-foreground truncate">
											{query.content.split('\n')[0].substring(0, 40)}...
										</div>
										<div className="text-[9px] text-muted-foreground">
											{new Date(query.updatedAt).toLocaleDateString()}
										</div>
									</div>
									<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<Button size="icon" variant="ghost" className="h-4 w-4" title="Run" onClick={(e) => { e.stopPropagation(); handleRunQuery(query) }}>
											<Play className="h-2.5 w-2.5" />
										</Button>
										<Button size="icon" variant="ghost" className="h-4 w-4 text-red-600" title="Delete" onClick={(e) => { e.stopPropagation(); deleteQuery(query.name) }}>
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

// History Section Component
const HistorySection: React.FC<{ expanded: { [k:string]: boolean }; setExpanded: (fn: (s: { [k:string]: boolean }) => { [k:string]: boolean }) => void }> = ({ expanded, setExpanded }) => {
	const { history, setMongoInput, setSqlInput, runMongo, runSql, setDatasource } = useQueryStore()
	const [searchTerm, setSearchTerm] = useState('')
	
	const filteredHistory = history.filter(item => 
		searchTerm === '' || 
		String(item.input || '').toLowerCase().includes(searchTerm.toLowerCase())
	)

	const handleLoadFromHistory = (item: QueryHistoryItem) => {
		if (item.engine === 'mongo') {
			setMongoInput(String(item.input || '[]'))
		} else {
			setSqlInput(String(item.input || 'SELECT 1'))
		}
		// Navigate to data workspace
		try { 
			window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries' } })) 
		} catch {}
	}

	const handleRunFromHistory = (item: QueryHistoryItem) => {
		if (item.engine === 'mongo') {
			setMongoInput(String(item.input || '[]'))
		} else {
			setSqlInput(String(item.input || 'SELECT 1'))
		}
		if (item.datasourceId) {
			setDatasource(item.datasourceId)
			if (item.engine === 'mongo') {
				runMongo()
			} else {
				runSql()
			}
		}
		// Navigate to data workspace
		try { 
			window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries' } })) 
		} catch {}
	}

	return (
		<Section id="history" title={`History (${history.length})`} expanded={expanded} setExpanded={setExpanded} actions={<></>}>
			{history.length === 0 ? (
				<div className="text-muted-foreground">No history yet (will list recent executions).</div>
			) : (
				<>
					{history.length > 3 && (
						<input
							className="px-2 py-1 rounded border text-xs mb-2"
							placeholder="Search history..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					)}
					<div className="space-y-1">
						{filteredHistory.slice(0, 10).map((item, index) => (
							<div key={index} className="group border rounded px-2 py-1 hover:bg-accent/40">
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadFromHistory(item)}>
										<div className="text-[10px] text-muted-foreground truncate">
											{String(item.input || '').split('\n')[0].substring(0, 40)}...
										</div>
										<div className="text-[9px] text-muted-foreground flex items-center gap-2">
											<span>{new Date(item.started).toLocaleTimeString()}</span>
											{item.durationMs && <span>{item.durationMs}ms</span>}
										</div>
									</div>
									<Button 
										size="icon" 
										variant="ghost" 
										className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" 
										title="Run" 
										onClick={(e) => { e.stopPropagation(); handleRunFromHistory(item) }}
									>
										<Play className="h-2.5 w-2.5" />
									</Button>
								</div>
							</div>
						))}
					</div>
				</>
			)}
		</Section>
	)
}

