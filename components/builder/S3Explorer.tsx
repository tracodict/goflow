"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { useQueryStore } from '@/stores/query'
import { useSavedQueriesStore } from '@/stores/saved-queries'
import { ResizablePanels } from '@/components/ui/resizable-panels'
import { Button } from '@/components/ui/button'
import { Folder, File, Image, FileText, Download, RefreshCw, Search, ChevronRight, ChevronDown } from 'lucide-react'
import type { S3File } from '@/lib/datasource-types'

interface S3ExplorerProps {
  queryName?: string
  style?: React.CSSProperties
  className?: string
  onClick?: () => void
  onMouseEnter?: () => void
}

interface FileTreeItemProps {
  item: S3TreeItem
  level: number
  onSelect?: (file: S3File) => void
  isSelected?: boolean
  expandedFolders: Set<string>
  onToggleFolder: (key: string) => void
  selectedFile: S3File | null
}

interface S3TreeItem {
  key: string
  name: string
  isFolder: boolean
  file?: S3File  // Original file data for actual files
  children: S3TreeItem[]
  size?: number
  lastModified?: Date
  contentType?: string
}

// Convert flat S3File array to hierarchical tree structure
const buildS3Tree = (files: S3File[]): S3TreeItem[] => {
  const tree: S3TreeItem[] = []
  const folderMap = new Map<string, S3TreeItem>()

  // First pass: create all folders
  files.forEach(file => {
    const pathParts = file.key.split('/')
    let currentPath = ''

    pathParts.forEach((part, index) => {
      const isLast = index === pathParts.length - 1
      const previousPath = currentPath
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (!folderMap.has(currentPath)) {
        const treeItem: S3TreeItem = {
          key: currentPath,
          name: part,
          isFolder: !isLast || file.isFolder,
          file: !isLast || file.isFolder ? undefined : file,
          children: [],
          size: !isLast || file.isFolder ? undefined : file.size,
          lastModified: !isLast || file.isFolder ? undefined : file.lastModified,
          contentType: !isLast || file.isFolder ? undefined : file.contentType
        }

        folderMap.set(currentPath, treeItem)

        // Add to parent or root
        if (previousPath && folderMap.has(previousPath)) {
          folderMap.get(previousPath)!.children.push(treeItem)
        } else if (!previousPath) {
          tree.push(treeItem)
        }
      } else if (isLast && !file.isFolder) {
        // Update existing item with file data
        const existing = folderMap.get(currentPath)!
        existing.file = file
        existing.size = file.size
        existing.lastModified = file.lastModified
        existing.contentType = file.contentType
      }
    })
  })

  // Sort function: folders first, then files, both alphabetically
  const sortItems = (items: S3TreeItem[]): S3TreeItem[] => {
    return items.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1
      return a.name.localeCompare(b.name)
    })
  }

  // Recursively sort all levels
  const sortTree = (items: S3TreeItem[]): S3TreeItem[] => {
    const sorted = sortItems(items)
    sorted.forEach(item => {
      if (item.children.length > 0) {
        item.children = sortTree(item.children)
      }
    })
    return sorted
  }

  return sortTree(tree)
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ 
  item, 
  level, 
  onSelect, 
  isSelected,
  expandedFolders,
  onToggleFolder,
  selectedFile
}) => {
  const isExpanded = expandedFolders.has(item.key)
  
  const getFileIcon = (item: S3TreeItem) => {
    if (item.isFolder) return <Folder className="h-4 w-4 text-blue-600" />
    if (item.contentType?.startsWith('image/')) return <Image className="h-4 w-4 text-green-600" />
    if (item.contentType?.startsWith('text/')) return <FileText className="h-4 w-4 text-gray-600" />
    return <File className="h-4 w-4 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return ''
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  return (
    <>
      <div 
        className={`flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer ${isSelected ? 'bg-blue-100' : ''}`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => item.file && onSelect?.(item.file)}
      >
        {item.isFolder && (
          <button 
            className="p-1 hover:bg-gray-200 rounded mr-1"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFolder(item.key)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
        {!item.isFolder && <div className="w-5" />}
        {getFileIcon(item)}
        <span className="ml-2 flex-1 truncate text-sm">{item.name}</span>
        {!item.isFolder && item.size && (
          <span className="text-xs text-gray-500 ml-2">{formatFileSize(item.size)}</span>
        )}
      </div>
      
      {/* Render children if folder is expanded */}
      {item.isFolder && isExpanded && item.children.length > 0 && (
        <>
          {item.children.map((child) => (
            <FileTreeItem
              key={child.key}
              item={child}
              level={level + 1}
              onSelect={onSelect}
              isSelected={child.file && selectedFile ? selectedFile.key === child.file.key : false}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              selectedFile={selectedFile}
            />
          ))}
        </>
      )}
    </>
  )
}

const FilePreview: React.FC<{ file: S3File | null }> = ({ file }) => {
  if (!file || file.isFolder) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Select a file to preview</p>
        </div>
      </div>
    )
  }

  const renderPreviewContent = () => {
    if (file.contentType?.startsWith('image/')) {
      return (
        <div className="p-4">
          <img 
            src={`/api/s3/preview/${file.key}`} 
            alt={file.key}
            className="max-w-full max-h-96 mx-auto rounded shadow"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+'
            }}
          />
        </div>
      )
    }
    
    if (file.contentType?.startsWith('text/')) {
      return (
        <div className="p-4 h-full overflow-auto">
          <pre className="text-sm bg-gray-50 p-4 rounded overflow-auto">
            {/* In a real implementation, this would fetch the file content */}
            Loading file content...
          </pre>
        </div>
      )
    }
    
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="mb-2">Preview not available</p>
          <p className="text-sm text-gray-400">File type: {file.contentType || 'Unknown'}</p>
          <Button size="sm" className="mt-4" onClick={() => {
            // In real implementation, this would download the file
            console.log('Download file:', file.key)
          }}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">{file.key.split('/').pop()}</h3>
          <p className="text-xs text-gray-500">
            Size: {file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown'} • 
            Modified: {file.lastModified.toLocaleDateString()}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => {
          console.log('Download file:', file.key)
        }}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        {renderPreviewContent()}
      </div>
    </div>
  )
}

export const S3Explorer: React.FC<S3ExplorerProps> = ({
  queryName,
  style,
  className,
  onClick,
  onMouseEnter
}) => {
  const { queries, hydrated, hydrate } = useSavedQueriesStore()
  const { runS3, s3Result, running, error, setDatasource, setS3Input, setS3Prefix } = useQueryStore()
  
  const [selectedFile, setSelectedFile] = useState<S3File | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')

  // Hydrate queries if not already done
  useEffect(() => {
    if (!hydrated) {
      hydrate()
    }
  }, [hydrated, hydrate])

  const selectedQuery = queryName ? queries.find(q => q.name === queryName) : null

  const executeQuery = async () => {
    if (!selectedQuery) return
    
    setDatasource(selectedQuery.datasourceId)
    setS3Input(selectedQuery.content)
    await runS3()
  }

  // Auto-execute query when queryName changes
  useEffect(() => {
    if (selectedQuery && hydrated) {
      executeQuery()
    }
  }, [selectedQuery?.name, hydrated])

  const toggleFolder = (folderKey: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderKey)) {
      newExpanded.delete(folderKey)
    } else {
      newExpanded.add(folderKey)
    }
    setExpandedFolders(newExpanded)
  }

  // Build tree structure from S3 files and apply search filter
  const treeData = useMemo(() => {
    if (!s3Result?.files) return []
    
    // First filter files by search term
    const filteredFiles = s3Result.files.filter(file => 
      searchTerm === '' || file.key.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    // Then build tree from filtered files
    return buildS3Tree(filteredFiles)
  }, [s3Result?.files, searchTerm])

  const containerStyle: React.CSSProperties = {
    ...style,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden'
  }

  return (
    <div 
      style={containerStyle}
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* Header */}
      <div className="p-3 bg-muted/30 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">
            {selectedQuery ? `S3: ${selectedQuery.name}` : 'S3 Explorer'}
          </h3>
          {s3Result && (
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
              {s3Result.totalFiles} files
            </span>
          )}
        </div>
        {selectedQuery && (
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              executeQuery()
            }}
            disabled={running}
          >
            <RefreshCw className={`h-3 w-3 ${running ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!selectedQuery ? (
          <div className="p-4 text-center text-muted-foreground">
            <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No S3 query selected</p>
            <p className="text-xs">Select an S3 query in the Properties panel</p>
          </div>
        ) : running ? (
          <div className="p-4 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Loading files...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-600">
            <div className="text-sm font-medium">Error loading files</div>
            <p className="text-xs mt-1">{error}</p>
          </div>
        ) : (
          <ResizablePanels
            direction="horizontal"
            initialSplit={40}
            minSize={25}
            maxSize={75}
          >
            {/* File Tree */}
            <div className="h-full flex flex-col">
              {/* Search */}
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    className="w-full pl-8 pr-2 py-2 text-xs border rounded"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              {/* File List */}
              <div className="flex-1 overflow-auto">
                {treeData.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {searchTerm ? 'No files match search' : 'No files found'}
                  </div>
                ) : (
                  <div>
                    {treeData.map((item) => (
                      <FileTreeItem
                        key={item.key}
                        item={item}
                        level={0}
                        onSelect={setSelectedFile}
                        isSelected={!!(selectedFile && item.file && selectedFile.key === item.file.key)}
                        expandedFolders={expandedFolders}
                        onToggleFolder={toggleFolder}
                        selectedFile={selectedFile}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* File Preview */}
            <FilePreview file={selectedFile} />
          </ResizablePanels>
        )}
      </div>
    </div>
  )
}