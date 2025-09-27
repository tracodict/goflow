"use client"

import React from 'react'
import { QueryEditor, QueryResultViewer } from './QueryEditor'
import { ResizablePanels } from '@/components/ui/resizable-panels'

export default function DataWorkspace() {
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

