"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { useDatasourceStore } from '@/stores/datasource'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { 
  Folder, 
  File, 
  FileText, 
  Image, 
  FileJson,
  Database,
  Eye,
  Download,
  ChevronRight,
  ChevronDown,
  RefreshCw
} from 'lucide-react'

interface S3File {
  name: string
  isFolder: boolean
  size?: number
  lastModified?: string
  children?: S3File[]
}

interface S3Schema {
  files: string[]
  bucket: string
  pathPrefix: string
  totalObjects: number
  provider: string
}

export function S3Explorer({ datasourceId }: { datasourceId: string }) {
  const { datasources } = useDatasourceStore()
  const [schema, setSchema] = useState<S3Schema | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const datasource = datasources.find(d => d.id === datasourceId)

  const fetchSchema = useCallback(async () => {
    if (!datasource) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/ds/datasources/${datasourceId}/schema`)
      if (!response.ok) {
        throw new Error('Failed to fetch files')
      }
      
      const data = await response.json()
      setSchema(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [datasourceId, datasource])

  const previewFile = useCallback(async (filePath: string) => {
    if (!datasource) return
    
    setPreviewLoading(true)
    setSelectedFile(filePath)
    setPreviewContent(null)

    try {
      const response = await fetch(`/api/ds/datasources/${datasourceId}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: filePath,
          format: getFileFormat(filePath)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to preview file')
      }

      const data = await response.json()
      setPreviewContent(data)
    } catch (err: any) {
      setPreviewContent({ error: err.message })
    } finally {
      setPreviewLoading(false)
    }
  }, [datasourceId, datasource])

  useEffect(() => {
    fetchSchema()
  }, [fetchSchema])

  const getFileFormat = (filePath: string) => {
    const ext = filePath.toLowerCase().split('.').pop()
    if (ext === 'json') return 'json'
    if (ext === 'csv') return 'csv'
    return 'text'
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop()
    switch (ext) {
      case 'json': return <FileJson className="w-4 h-4 text-orange-500" />
      case 'csv': return <Database className="w-4 h-4 text-green-500" />
      case 'txt': return <FileText className="w-4 h-4 text-gray-500" />
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif': return <Image className="w-4 h-4 text-blue-500" />
      default: return <File className="w-4 h-4 text-gray-400" />
    }
  }

  const buildFileTree = (files: string[]) => {
    const tree: { [key: string]: S3File & { children?: S3File[] } } = {}
    
    files.forEach(filePath => {
      const parts = filePath.split('/')
      let current = tree
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (!part) continue
        
        const fullPath = parts.slice(0, i + 1).join('/')
        const isLastPart = i === parts.length - 1
        const isFolder = !isLastPart || filePath.endsWith('/')
        
        if (!current[part]) {
          current[part] = {
            name: part,
            isFolder,
            children: isFolder ? [] : undefined
          }
        }
        
        if (isFolder && current[part].children) {
          current = current[part].children!.reduce((acc, child) => {
            acc[child.name] = child
            return acc
          }, {} as any)
          
          if (!current[part]) current[part] = { name: part, isFolder: true, children: [] }
        }
      }
    })
    
    return Object.values(tree)
  }

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath)
    } else {
      newExpanded.add(folderPath)
    }
    setExpandedFolders(newExpanded)
  }

  const renderFileTree = (items: S3File[], parentPath = '') => {
    return items.map(item => {
      const fullPath = parentPath ? `${parentPath}/${item.name}` : item.name
      const isExpanded = expandedFolders.has(fullPath)
      
      if (item.isFolder) {
        return (
          <div key={fullPath}>
            <div 
              className="flex items-center gap-1 py-1 px-2 hover:bg-gray-100 cursor-pointer text-sm"
              onClick={() => toggleFolder(fullPath)}
            >
              {isExpanded ? 
                <ChevronDown className="w-3 h-3" /> : 
                <ChevronRight className="w-3 h-3" />
              }
              <Folder className="w-4 h-4 text-yellow-500" />
              <span>{item.name}</span>
            </div>
            {isExpanded && item.children && (
              <div className="ml-4">
                {renderFileTree(item.children, fullPath)}
              </div>
            )}
          </div>
        )
      } else {
        return (
          <div
            key={fullPath}
            className={cn(
              "flex items-center gap-1 py-1 px-2 hover:bg-gray-100 cursor-pointer text-sm ml-4",
              selectedFile === fullPath && "bg-blue-100"
            )}
            onClick={() => previewFile(fullPath)}
          >
            {getFileIcon(item.name)}
            <span className="flex-1">{item.name}</span>
            <Button
              size="sm"
              variant="ghost"
              className="w-6 h-6 p-0"
              onClick={(e) => {
                e.stopPropagation()
                previewFile(fullPath)
              }}
            >
              <Eye className="w-3 h-3" />
            </Button>
          </div>
        )
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-600">Loading files...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600 text-sm mb-2">{error}</p>
        <Button size="sm" onClick={fetchSchema}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Retry
        </Button>
      </div>
    )
  }

  if (!schema) return null

  const fileTree = buildFileTree(schema.files)

  return (
    <div className="flex h-full">
      {/* File Explorer */}
      <div className="w-1/2 border-r border-gray-200 overflow-auto">
        <div className="p-2 border-b bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Files ({schema.totalObjects})</h3>
            <Button size="sm" variant="ghost" onClick={fetchSchema}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-xs text-gray-600">
            Bucket: <code className="bg-gray-200 px-1 rounded">{schema.bucket}</code>
            {schema.pathPrefix && (
              <> • Prefix: <code className="bg-gray-200 px-1 rounded">{schema.pathPrefix}</code></>
            )}
          </p>
        </div>
        <div className="p-2">
          {fileTree.length > 0 ? renderFileTree(fileTree) : (
            <p className="text-sm text-gray-500 text-center py-4">No files found</p>
          )}
        </div>
      </div>

      {/* File Preview */}
      <div className="w-1/2 overflow-auto">
        {selectedFile ? (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              {getFileIcon(selectedFile)}
              <h4 className="font-semibold text-sm">{selectedFile}</h4>
            </div>
            
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-600">Loading preview...</span>
              </div>
            ) : previewContent ? (
              previewContent.error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-600 text-sm">{previewContent.error}</p>
                </div>
              ) : previewContent.rows ? (
                <div>
                  <p className="text-xs text-gray-600 mb-2">
                    {previewContent.rows.length} rows • {previewContent.meta?.executionMs}ms
                  </p>
                  <div className="overflow-auto max-h-96 border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {previewContent.columns?.map((col: any) => (
                            <th key={col.name} className="text-left p-2 border-b font-semibold">
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewContent.rows.map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {previewContent.columns?.map((col: any) => (
                              <td key={col.name} className="p-2 border-b text-xs">
                                {typeof row[col.name] === 'object' 
                                  ? JSON.stringify(row[col.name]) 
                                  : String(row[col.name] ?? '')
                                }
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-500">
            Select a file to preview
          </div>
        )}
      </div>
    </div>
  )
}