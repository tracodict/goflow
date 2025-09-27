"use client"

import React from 'react'
import { QueryEditor, QueryResultViewer } from './QueryEditor'
import { S3Explorer } from './S3Explorer'
import { ResizablePanels } from '@/components/ui/resizable-panels'
import { useDatasourceStore } from '@/stores/datasource'
import { useQueryStore } from '@/stores/query'

export default function DataWorkspace() {
  const { datasources } = useDatasourceStore()
  const { activeDatasourceId } = useQueryStore()
  const currentDatasource = datasources.find(d => d.id === activeDatasourceId)
  
  const isS3Datasource = currentDatasource?.type === 's3'

  if (isS3Datasource) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-white">
          <div>
            <h3 className="text-lg font-medium mb-1">File Explorer</h3>
            <p className="text-xs text-muted-foreground">Browse and preview files from your S3/GCS bucket. Click on files to preview their content.</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {activeDatasourceId && <S3Explorer datasourceId={activeDatasourceId} />}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b bg-white">
        <div>
          <h3 className="text-lg font-medium mb-1">Query Builder</h3>
          <p className="text-xs text-muted-foreground">Select a datasource, write a Mongo aggregate pipeline (JSON) or SQL statement, then Run.</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <ResizablePanels
          direction="vertical"
          initialSplit={60}
          minSize={30}
          maxSize={85}
        >
          <QueryEditor />
          <QueryResultViewer />
        </ResizablePanels>
      </div>
    </div>
  )
}

