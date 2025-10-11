/**
 * GCS Query Input Component
 * 
 * Provides a user-friendly interface for building GCS folder queries
 * instead of showing a SQL editor for GCS datasources.
 */

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Play, Folder, Settings } from 'lucide-react'

export interface GCSQueryParams {
  folderPath: string
  recursive: boolean
  includeMetadata: boolean
  maxFileSize?: number
  allowedExtensions: string[]
  showHidden: boolean
}

interface GCSQueryInputProps {
  onExecute: (params: GCSQueryParams) => void
  disabled?: boolean
  loading?: boolean
  initialValues?: Partial<GCSQueryParams>
}

export function GCSQueryInput({ onExecute, disabled = false, loading = false, initialValues }: GCSQueryInputProps) {
  const [folderPath, setFolderPath] = useState(initialValues?.folderPath || '/')
  const [recursive, setRecursive] = useState(initialValues?.recursive ?? true)
  const [includeMetadata, setIncludeMetadata] = useState(initialValues?.includeMetadata ?? true)
  const [showHidden, setShowHidden] = useState(initialValues?.showHidden ?? false)
  const [maxFileSize, setMaxFileSize] = useState<string>(initialValues?.maxFileSize?.toString() || '')
  const [allowedExtensions, setAllowedExtensions] = useState(initialValues?.allowedExtensions?.join(',') || '.pdf,.txt,.json,.md,.csv,.xml,.dat')
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Update state when initialValues change
  React.useEffect(() => {
    if (initialValues) {
      setFolderPath(initialValues.folderPath || '/')
      setRecursive(initialValues.recursive ?? true)
      setIncludeMetadata(initialValues.includeMetadata ?? true)
      setShowHidden(initialValues.showHidden ?? false)
      setMaxFileSize(initialValues.maxFileSize?.toString() || '')
      setAllowedExtensions(initialValues.allowedExtensions?.join(',') || '.pdf,.txt,.json,.md,.csv,.xml,.dat')
    }
  }, [initialValues])

  const handleExecute = useCallback(() => {
    const params: GCSQueryParams = {
      folderPath: folderPath.trim() || '/',
      recursive,
      includeMetadata,
      showHidden,
      allowedExtensions: allowedExtensions
        .split(',')
        .map(ext => ext.trim())
        .filter(ext => ext.length > 0),
      ...(maxFileSize ? { maxFileSize: parseInt(maxFileSize) } : {})
    }
    
    onExecute(params)
  }, [folderPath, recursive, includeMetadata, showHidden, maxFileSize, allowedExtensions, onExecute])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleExecute()
    }
  }, [handleExecute])

  return (
    <div className="space-y-4 p-4 bg-white border rounded-md h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Folder className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-medium">GCS Folder Query</h3>
        </div>
        <Button 
          size="sm" 
          onClick={handleExecute} 
          disabled={disabled || loading}
        >
          {loading ? (
            <>
              <div className="animate-spin w-3 h-3 mr-1 border border-white border-t-transparent rounded-full" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-1" />
              List Objects
            </>
          )}
        </Button>
      </div>

      <div className="space-y-3">
        {/* Folder Path Input */}
        <div>
          <Label htmlFor="folder-path" className="text-xs font-medium">
            Folder Path
          </Label>
          <Input
            id="folder-path"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="/documents/reports/"
            className="text-sm"
            disabled={disabled}
          />
          <p className="text-xs text-gray-500 mt-1">
            Path to list objects from (e.g., /, /documents/, /uploads/2024/)
          </p>
        </div>

        {/* Basic Options */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="recursive"
              checked={recursive}
              onCheckedChange={(checked) => setRecursive(checked as boolean)}
              disabled={disabled}
            />
            <Label htmlFor="recursive" className="text-xs">
              Include subfolders
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="metadata"
              checked={includeMetadata}
              onCheckedChange={(checked) => setIncludeMetadata(checked as boolean)}
              disabled={disabled}
            />
            <Label htmlFor="metadata" className="text-xs">
              Include metadata
            </Label>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs h-auto p-1"
          >
            <Settings className="w-3 h-3 mr-1" />
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </Button>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-3 p-3 bg-gray-50 rounded-md border">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-hidden"
                checked={showHidden}
                onCheckedChange={(checked) => setShowHidden(checked as boolean)}
                disabled={disabled}
              />
              <Label htmlFor="show-hidden" className="text-xs">
                Show hidden files/folders
              </Label>
            </div>

            <div>
              <Label htmlFor="max-size" className="text-xs font-medium">
                Max File Size (bytes)
              </Label>
              <Input
                id="max-size"
                type="number"
                value={maxFileSize}
                onChange={(e) => setMaxFileSize(e.target.value)}
                placeholder="10485760 (10MB)"
                className="text-sm"
                disabled={disabled}
              />
            </div>

            <div>
              <Label htmlFor="extensions" className="text-xs font-medium">
                Allowed Extensions
              </Label>
              <Input
                id="extensions"
                value={allowedExtensions}
                onChange={(e) => setAllowedExtensions(e.target.value)}
                placeholder=".pdf,.txt,.json,.md"
                className="text-sm"
                disabled={disabled}
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated list of file extensions to include
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 p-2 bg-blue-50 rounded border">
        <strong>Tip:</strong> Use Ctrl+Enter (Cmd+Enter on Mac) to execute the query quickly.
        Leave folder path as "/" to list objects from the bucket root.
      </div>
    </div>
  )
}