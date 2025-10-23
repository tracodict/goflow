import React from "react"
import { useQueryStore } from '@/stores/filestore-query'
import { Section } from "./Section"

type HistorySectionProps = {
	expanded: { [k: string]: boolean }
	setExpanded: (fn: (s: { [k: string]: boolean }) => { [k: string]: boolean }) => void
}

export const HistorySection: React.FC<HistorySectionProps> = ({ expanded, setExpanded }) => {
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
