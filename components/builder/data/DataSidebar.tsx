"use client"

import React, { useState, useEffect } from 'react'
import { Plus, RefreshCw, Beaker, Wrench, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useDataSourceStore } from '@/stores/filestore-datasource'
import { useQueryStore } from '@/stores/filestore-query'
import { useSystemSettings } from '@/components/petri/system-settings-context'
import { DataSource } from '@/lib/datastore-client'
import { Section } from './Section'
import { QueriesSection } from './QueriesSection'
import { HistorySection } from './HistorySection'

export const DataSidebar: React.FC = () => {
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
