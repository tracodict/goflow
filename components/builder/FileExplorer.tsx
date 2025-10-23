"use client"
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Trash2,
  Edit,
  Layout,
  Database,
  Palette,
  Workflow,
  Search,
  Puzzle
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Helper function to get file type icon based on file path
function getFileIcon(fileName: string) {
  if (fileName.endsWith('.page')) return Layout
  if (fileName.endsWith('.ds')) return Database
  if (fileName.endsWith('.color')) return Palette
  if (fileName.endsWith('.cpn')) return Workflow
  if (fileName.endsWith('.qry')) return Search
  if (fileName.endsWith('.mcp')) return Puzzle
  return File
}

export interface FileExplorerItem {
  id: string
  name: string
  type: 'folder' | 'file'
  parentId?: string
  children?: FileExplorerItem[]
  isExpanded?: boolean
}

interface FileExplorerProps {
  items: FileExplorerItem[]
  selectedItemId?: string
  activeItemId?: string // New prop for highlighting active item differently
  onItemSelect?: (item: FileExplorerItem) => void
  onItemDelete?: (item: FileExplorerItem) => void
  onItemRename?: (item: FileExplorerItem, newName: string) => void
  onItemMove?: (itemId: string, newParentId: string | undefined) => void
  onFolderToggle?: (item: FileExplorerItem) => void
  showActions?: boolean
  className?: string
}

interface FileExplorerItemProps {
  item: FileExplorerItem
  level: number
  selectedItemId?: string
  activeItemId?: string
  onSelect?: (item: FileExplorerItem) => void
  onDelete?: (item: FileExplorerItem) => void
  onRename?: (item: FileExplorerItem, newName: string) => void
  onMove?: (itemId: string, newParentId: string | undefined) => void
  onToggle?: (item: FileExplorerItem) => void
  showActions?: boolean
}

const FileExplorerItemComponent: React.FC<FileExplorerItemProps> = ({
  item,
  level,
  selectedItemId,
  activeItemId,
  onSelect,
  onDelete,
  onRename,
  onMove,
  onToggle,
  showActions = true
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(item.name)
  const [isDragOver, setIsDragOver] = useState(false)
  const isSelected = selectedItemId === item.id
  const isActive = activeItemId === item.id
  const isExpanded = item.isExpanded

    const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (item.type === 'folder') {
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    if (item.type !== 'folder') return
    
    const draggedItemId = e.dataTransfer.getData('text/plain')
    if (draggedItemId && draggedItemId !== item.id) {
      onMove?.(draggedItemId, item.id)
    }
  }

  const handleBackgroundDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const draggedItemId = e.dataTransfer.getData('text/plain')
    if (draggedItemId) {
      onMove?.(draggedItemId, undefined) // Move to root
    }
  }

  const handleDoubleClick = () => {
    if (onRename && showActions) {
      setIsEditing(true)
      setEditName(item.name)
    }
  }

  const handleEditSubmit = () => {
    const trimmedName = editName.trim()
    if (trimmedName && trimmedName !== item.name) {
      onRename?.(item, trimmedName)
    }
    setIsEditing(false)
  }

  const handleEditCancel = () => {
    setIsEditing(false)
    setEditName(item.name)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSubmit()
    } else if (e.key === 'Escape') {
      handleEditCancel()
    }
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 group",
          isSelected && "bg-blue-100",
          isActive && "bg-green-100 font-semibold",
          isDragOver && "bg-blue-200 border-2 border-blue-400",
          "relative"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isEditing && onSelect?.(item)}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Toggle button for folders */}
        {item.type === 'folder' ? (
          <button
            className="p-1 hover:bg-gray-200 rounded mr-2 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onToggle?.(item)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <div className="mr-2 flex-shrink-0">
            <div className="w-5 h-5 flex items-center justify-center">
              {(() => {
                const FileIcon = getFileIcon(item.id)
                return <FileIcon className="h-4 w-4 text-gray-500" />
              })()}
            </div>
          </div>
        )}

        {/* Name */}
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleEditSubmit}
            className="flex-1 text-sm h-6 px-2 py-0"
            autoFocus
            onFocus={(e) => e.target.select()}
          />
        ) : (
          <span className="flex-1 text-sm truncate">{item.name}</span>
        )}

        {/* Action buttons - always present to prevent layout shift, but invisible when not hovered */}
        {showActions && !isEditing && (
          <div className={cn(
            "flex items-center space-x-1",
            !isHovered && "opacity-0"
          )}>
            {onRename && (
              <Button
                size="sm"
                variant="ghost"
                className="w-6 h-6 p-0 opacity-70 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsEditing(true)
                  setEditName(item.name)
                }}
              >
                <Edit className="w-3 h-3 text-blue-500" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="w-6 h-6 p-0 opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.(item)
              }}
            >
              <Trash2 className="w-3 h-3 text-red-500" />
            </Button>
          </div>
        )}
      </div>

      {/* Children */}
      {item.type === 'folder' && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileExplorerItemComponent
              key={child.id}
              item={child}
              level={level + 1}
              selectedItemId={selectedItemId}
              activeItemId={activeItemId}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onMove={onMove}
              onToggle={onToggle}
              showActions={showActions}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  items,
  selectedItemId,
  activeItemId,
  onItemSelect,
  onItemDelete,
  onItemRename,
  onItemMove,
  onFolderToggle,
  showActions = true,
  className
}) => {
  const handleBackgroundClick = () => {
    onItemSelect?.(undefined as any) // Deselect all
  }

  const handleBackgroundDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const draggedItemId = e.dataTransfer.getData('text/plain')
    if (draggedItemId) {
      onItemMove?.(draggedItemId, undefined) // Move to root
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* File tree */}
      <div 
        className="flex-1 overflow-auto"
        onClick={handleBackgroundClick}
        onDrop={handleBackgroundDrop}
        onDragOver={handleDragOver}
      >
        {items.length > 0 ? (
          <div className="p-2">
            {items.map((item) => (
              <FileExplorerItemComponent
                key={item.id}
                item={item}
                level={0}
                selectedItemId={selectedItemId}
                activeItemId={activeItemId}
                onSelect={onItemSelect}
                onDelete={onItemDelete}
                onRename={onItemRename}
                onMove={onItemMove}
                onToggle={onFolderToggle}
                showActions={showActions}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">
            <File className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No items found</p>
            <p className="text-xs mt-1">Use File menu to create new items</p>
          </div>
        )}
      </div>
    </div>
  )
}