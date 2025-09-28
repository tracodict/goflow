import type { BaseEventPayload } from "@/lib/component-interface"

// S3Explorer-specific event payload interfaces  
export interface S3ExplorerEventPayload extends BaseEventPayload {
  // Datasource information
  datasourceId?: string
  
  // File/folder information
  fileName?: string
  filePath?: string
  fileSize?: number
  fileType?: string
  isFolder?: boolean
  
  // Action information (for file operations)
  action?: 'select' | 'download' | 'expand' | 'collapse'
  
  // Error information (for error events)
  error?: string
}