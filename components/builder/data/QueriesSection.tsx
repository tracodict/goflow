import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Wrench, Play, Trash2 } from "lucide-react"
import { useQueryStore } from '@/stores/filestore-query'
import { useQueryStore as useQueryExecutionStore } from '@/stores/query'
import { useSystemSettings } from "@/components/petri/system-settings-context"
import { QueryDefinition } from '@/lib/datastore-client'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Section } from "./Section"

type QueriesSectionProps = {
	expanded: { [k: string]: boolean }
	setExpanded: (fn: (s: { [k: string]: boolean }) => { [k: string]: boolean }) => void
	openQueryDialog: () => void
}

export const QueriesSection: React.FC<QueriesSectionProps> = ({ expanded, setExpanded, openQueryDialog }) => {
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
		} catch { }
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
				<Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { try { window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries' } })) } catch { } }} title="Open Query Builder">
					<Wrench className="h-3.5 w-3.5" />
				</Button>
			</div>
		}>
			{allQueries.length === 0 ? (
				<>
					<div className="text-muted-foreground">No query definitions yet. Create queries in the Data workspace.</div>
					<Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => { try { window.dispatchEvent(new CustomEvent('goflow-open-data-workspace', { detail: { view: 'queries' } })) } catch { } }}>Open Query Builder</Button>
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
