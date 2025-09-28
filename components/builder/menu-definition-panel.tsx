"use client"

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Trash2, 
  Edit, 
  ChevronDown, 
  ChevronRight, 
  GripVertical, 
  Code,
  ExternalLink,
  Workflow
} from 'lucide-react'
import { ScriptEditor } from '../builder/script-editor'
import type { MenuItem, NavigationMenuConfig } from '@/lib/types/navigation-menu-interface'

interface MenuDefinitionPanelProps {
  config: NavigationMenuConfig
  onConfigChange: (config: NavigationMenuConfig) => void
  onOpenScriptEditor?: (menuItem: MenuItem) => void
}

interface MenuItemEditorProps {
  item: MenuItem
  depth: number
  onUpdate: (item: MenuItem) => void
  onDelete: () => void
  onAddChild: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  expanded?: boolean
  onToggleExpand: () => void
}

const MenuItemEditor: React.FC<MenuItemEditorProps> = ({
  item,
  depth,
  onUpdate,
  onDelete,
  onAddChild,
  onMoveUp,
  onMoveDown,
  expanded = false,
  onToggleExpand
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [showScriptEditor, setShowScriptEditor] = useState(false)
  const hasChildren = item.children && item.children.length > 0

  const handleUpdate = (field: keyof MenuItem, value: any) => {
    onUpdate({ ...item, [field]: value })
  }

  const handleScriptTypeChange = (scriptType: MenuItem['scriptType']) => {
    let script = item.script || ''
    
    // Generate template script based on type
    if (scriptType === 'navigation' && !script) {
      script = `// Navigation script for ${item.label}
function navigate(eventPayload, context) {
  // Navigate to the specified URL
  context.navigation.navigateTo('${item.href || '/'}')
  
  // Optional: Show notification
  context.ui.showNotification({
    type: 'info',
    message: 'Navigating to ${item.label}'
  })
}`
    } else if (scriptType === 'workflow' && !script) {
      script = `// Workflow script for ${item.label}
function executeWorkflow(eventPayload, context) {
  // Create a new workflow case
  const workflowId = 'your-workflow-id'
  const caseData = {
    initiatedBy: context.user.id,
    menuItem: eventPayload.menuItem.label,
    timestamp: eventPayload.timestamp
  }
  
  context.workflow.createCase(workflowId, caseData)
    .then(caseId => {
      context.ui.showNotification({
        type: 'success',
        message: \`Workflow case \${caseId} created successfully\`
      })
    })
    .catch(error => {
      context.ui.showNotification({
        type: 'error',
        message: \`Failed to create workflow case: \${error.message}\`
      })
    })
}`
    } else if (scriptType === 'custom' && !script) {
      script = `// Custom script for ${item.label}
function customAction(eventPayload, context) {
  // Your custom logic here
  console.log('Menu item clicked:', eventPayload.menuItem.label)
  
  // Example: Query data
  context.data.query('some-query-id')
    .then(data => {
      console.log('Data retrieved:', data)
    })
  
  // Example: Show notification
  context.ui.showNotification({
    type: 'success',
    message: 'Custom action executed'
  })
}`
    }
    
    onUpdate({ 
      ...item, 
      scriptType, 
      script: script || item.script 
    })
  }

  return (
    <div 
      className="border rounded-lg p-3 mb-2 bg-background"
      style={{ marginLeft: depth * 20 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
        
        {hasChildren && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="p-1"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="text-xs">
                {item.badge}
              </Badge>
            )}
            {item.disabled && (
              <Badge variant="destructive" className="text-xs">
                Disabled
              </Badge>
            )}
            {item.script && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                {item.scriptType === 'navigation' && <ExternalLink className="h-3 w-3" />}
                {item.scriptType === 'workflow' && <Workflow className="h-3 w-3" />}
                {item.scriptType === 'custom' && <Code className="h-3 w-3" />}
                Script
              </Badge>
            )}
          </div>
          {item.href && (
            <div className="text-xs text-muted-foreground mt-1">
              → {item.href}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="p-1"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddChild}
            className="p-1"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="p-1 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isEditing && (
        <div className="grid grid-cols-2 gap-3 mt-3 p-3 border rounded bg-muted/30">
          <div className="space-y-2">
            <Label htmlFor={`label-${item.id}`}>Label</Label>
            <Input
              id={`label-${item.id}`}
              value={item.label}
              onChange={(e) => handleUpdate('label', e.target.value)}
              placeholder="Menu item label"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`href-${item.id}`}>URL (optional)</Label>
            <Input
              id={`href-${item.id}`}
              value={item.href || ''}
              onChange={(e) => handleUpdate('href', e.target.value)}
              placeholder="/path/to/page"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`icon-${item.id}`}>Icon (HTML/SVG)</Label>
            <Input
              id={`icon-${item.id}`}
              value={item.icon || ''}
              onChange={(e) => handleUpdate('icon', e.target.value)}
              placeholder="<svg>...</svg> or emoji"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`badge-${item.id}`}>Badge (optional)</Label>
            <Input
              id={`badge-${item.id}`}
              value={item.badge?.toString() || ''}
              onChange={(e) => handleUpdate('badge', e.target.value)}
              placeholder="New, 5, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`script-type-${item.id}`}>Script Type</Label>
            <Select
              value={item.scriptType || ''}
              onValueChange={(value) => {
                if (value === 'none' || value === '') {
                  handleUpdate('scriptType', undefined)
                  handleUpdate('script', '')
                } else {
                  handleScriptTypeChange(value as MenuItem['scriptType'])
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select script type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Script</SelectItem>
                <SelectItem value="navigation">Navigation</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id={`disabled-${item.id}`}
              checked={item.disabled || false}
              onCheckedChange={(checked) => handleUpdate('disabled', checked)}
            />
            <Label htmlFor={`disabled-${item.id}`}>Disabled</Label>
          </div>

          {item.scriptType && (
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Custom Script</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScriptEditor(true)}
                  className="flex items-center gap-1"
                >
                  <Code className="h-4 w-4" />
                  Edit Script
                </Button>
              </div>
              <Textarea
                value={item.script || ''}
                onChange={(e) => handleUpdate('script', e.target.value)}
                placeholder="Enter JavaScript code here..."
                rows={4}
                className="font-mono text-sm"
              />
            </div>
          )}

          <div className="col-span-2 space-y-2">
            <Label htmlFor={`description-${item.id}`}>Description</Label>
            <Textarea
              id={`description-${item.id}`}
              value={item.metadata?.description || ''}
              onChange={(e) => handleUpdate('metadata', { 
                ...item.metadata, 
                description: e.target.value 
              })}
              placeholder="Menu item description"
              rows={2}
            />
          </div>
        </div>
      )}

      {/* Script Editor Modal */}
      {showScriptEditor && item.scriptType && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <ScriptEditor
              componentInterface={{
                events: {
                  onMenuItemClick: {
                    description: "Menu item click event",
                    payload: {
                      type: "object",
                      properties: {
                        menuItem: { type: "object" },
                        timestamp: { type: "number" },
                        path: { type: "array" }
                      }
                    }
                  }
                },
                actions: {}
              }}
              eventName="onMenuItemClick"
              script={item.script || ''}
              scriptType="event"
              onScriptChange={(script) => handleUpdate('script', script)}
              onSave={() => setShowScriptEditor(false)}
              onClose={() => setShowScriptEditor(false)}
            />
          </div>
        </div>
      )}

      {/* Render children */}
      {expanded && hasChildren && (
        <div className="mt-3 space-y-2">
          {item.children!.map((child, index) => (
            <MenuItemEditor
              key={child.id}
              item={child}
              depth={depth + 1}
              onUpdate={(updatedChild) => {
                const newChildren = [...item.children!]
                newChildren[index] = updatedChild
                handleUpdate('children', newChildren)
              }}
              onDelete={() => {
                const newChildren = item.children!.filter((_, i) => i !== index)
                handleUpdate('children', newChildren)
              }}
              onAddChild={() => {
                const newChild: MenuItem = {
                  id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  label: 'New Item',
                  children: []
                }
                const newChildren = [...(child.children || []), newChild]
                const updatedChild = { ...child, children: newChildren }
                const newSiblings = [...item.children!]
                newSiblings[index] = updatedChild
                handleUpdate('children', newSiblings)
              }}
              onMoveUp={() => {
                if (index > 0) {
                  const newChildren = [...item.children!]
                  ;[newChildren[index - 1], newChildren[index]] = [newChildren[index], newChildren[index - 1]]
                  handleUpdate('children', newChildren)
                }
              }}
              onMoveDown={() => {
                if (index < item.children!.length - 1) {
                  const newChildren = [...item.children!]
                  ;[newChildren[index], newChildren[index + 1]] = [newChildren[index + 1], newChildren[index]]
                  handleUpdate('children', newChildren)
                }
              }}
              expanded={false}
              onToggleExpand={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const MenuDefinitionPanel: React.FC<MenuDefinitionPanelProps> = ({
  config,
  onConfigChange,
  onOpenScriptEditor
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpanded = useCallback((itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  const addMenuItem = useCallback(() => {
    const newItem: MenuItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: 'New Menu Item',
      children: []
    }
    
    onConfigChange({
      ...config,
      items: [...config.items, newItem]
    })
  }, [config, onConfigChange])

  const updateMenuItem = useCallback((index: number, updatedItem: MenuItem) => {
    const newItems = [...config.items]
    newItems[index] = updatedItem
    onConfigChange({
      ...config,
      items: newItems
    })
  }, [config, onConfigChange])

  const deleteMenuItem = useCallback((index: number) => {
    const newItems = config.items.filter((_, i) => i !== index)
    onConfigChange({
      ...config,
      items: newItems
    })
  }, [config, onConfigChange])

  const addChildMenuItem = useCallback((parentIndex: number) => {
    const newChild: MenuItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: 'New Child Item',
      children: []
    }
    
    const newItems = [...config.items]
    const parent = newItems[parentIndex]
    parent.children = [...(parent.children || []), newChild]
    
    onConfigChange({
      ...config,
      items: newItems
    })
  }, [config, onConfigChange])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Navigation Menu Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Orientation</Label>
              <Select
                value={config.orientation || 'horizontal'}
                onValueChange={(value: 'horizontal' | 'vertical') =>
                  onConfigChange({ ...config, orientation: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select
                value={config.trigger || 'click'}
                onValueChange={(value: 'click' | 'hover') =>
                  onConfigChange({ ...config, trigger: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="click">Click</SelectItem>
                  <SelectItem value="hover">Hover</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={config.showIcons || false}
                onCheckedChange={(checked) =>
                  onConfigChange({ ...config, showIcons: checked })
                }
              />
              <Label>Show Icons</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={config.showBadges || false}
                onCheckedChange={(checked) =>
                  onConfigChange({ ...config, showBadges: checked })
                }
              />
              <Label>Show Badges</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Menu Items</CardTitle>
            <Button onClick={addMenuItem} size="sm" className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {config.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No menu items defined.</p>
              <p className="text-sm">Click "Add Item" to create your first menu item.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {config.items.map((item, index) => (
                <MenuItemEditor
                  key={item.id}
                  item={item}
                  depth={0}
                  onUpdate={(updatedItem) => updateMenuItem(index, updatedItem)}
                  onDelete={() => deleteMenuItem(index)}
                  onAddChild={() => addChildMenuItem(index)}
                  onMoveUp={() => {
                    if (index > 0) {
                      const newItems = [...config.items]
                      ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
                      onConfigChange({ ...config, items: newItems })
                    }
                  }}
                  onMoveDown={() => {
                    if (index < config.items.length - 1) {
                      const newItems = [...config.items]
                      ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
                      onConfigChange({ ...config, items: newItems })
                    }
                  }}
                  expanded={expandedItems.has(item.id)}
                  onToggleExpand={() => toggleExpanded(item.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}