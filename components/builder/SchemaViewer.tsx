"use client"
import React, { useState, useEffect } from 'react'
import SchemaVisualEditor from '@/jsonjoy-builder/src/components/SchemaEditor/SchemaVisualEditor'
import type { JSONSchema } from '@/jsonjoy-builder/src/types/jsonSchema'
import { Button } from '@/components/ui/button'
import { X, Save } from 'lucide-react'

export interface SchemaViewerProps {
  /** Name of the selected schema */
  schemaName: string
  /** Schema data to edit */
  schema: JSONSchema
  /** Called when schema is updated */
  onSchemaChange?: (schema: JSONSchema) => void
  /** Called when user wants to close the viewer */
  onClose?: () => void
}

export const SchemaViewer: React.FC<SchemaViewerProps> = ({
  schemaName,
  schema,
  onSchemaChange,
  onClose
}) => {
  const [currentSchema, setCurrentSchema] = useState<JSONSchema>(schema)
  const [hasChanges, setHasChanges] = useState(false)

  // Update local state when external schema changes
  useEffect(() => {
    setCurrentSchema(schema)
    setHasChanges(false)
  }, [schema])

  const handleSchemaChange = (updatedSchema: JSONSchema) => {
    setCurrentSchema(updatedSchema)
    setHasChanges(true)
    // Optionally call onChange immediately for live updates
    onSchemaChange?.(updatedSchema)
  }

  const handleSave = () => {
    onSchemaChange?.(currentSchema)
    setHasChanges(false)
  }

  const handleClose = () => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?')
      if (!confirmed) return
    }
    onClose?.()
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg">Schema: {schemaName}</h2>
          {hasChanges && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button size="sm" onClick={handleSave} className="flex items-center gap-1">
              <Save className="h-4 w-4" />
              Save
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Schema Visual Editor */}
      <div className="flex-1 overflow-hidden">
        <SchemaVisualEditor
          schema={currentSchema}
          onChange={handleSchemaChange}
        />
      </div>
    </div>
  )
}