"use client"
import React, { useState } from 'react'
import { ViaTokensPanel } from '@/components/via/via-tokens-panel'
import { SchemaEditForm } from '@/components/via/schema-edit-form'
import { fetchPreSupportedSchema } from '@/components/petri/pre-supported-schemas'
import { useSystemSettings } from '@/components/petri/system-settings-context'
import type { JSONSchema } from '@/jsonjoy-builder/src/types/jsonSchema'

export interface SchemaTabProps {
  /** List of defined color/schema names */
  definedColors: string[]
  /** JSON schemas available */
  jsonSchemas?: { name: string; schema: any }[]
  /** Called when a schema is updated */
  onSchemaUpdate?: (name: string, schema: JSONSchema) => void
  /** Called when a schema is selected for editing */
  onSchemaSelect?: (schemaName: string, schema: JSONSchema) => void
}

export const SchemaTab: React.FC<SchemaTabProps> = ({
  definedColors,
  jsonSchemas = [],
  onSchemaUpdate,
  onSchemaSelect
}) => {
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null)
  const [editFormOpen, setEditFormOpen] = useState(false)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const { settings } = useSystemSettings()

  const handleColorSelect = async (colorName: string) => {
    setSelectedSchema(colorName)
    setLoadingSchema(true)

    try {
      // First check if it's a workflow-defined schema
      const workflowSchema = jsonSchemas.find(js => js.name === colorName)
      
      if (workflowSchema) {
        // Use workflow-defined schema
        if (onSchemaSelect) {
          onSchemaSelect(colorName, workflowSchema.schema)
        } else {
          // Fallback to edit form if no main panel handler
          setEditFormOpen(true)
        }
      } else {
        // Fetch pre-supported schema from CDN
        const schema = await fetchPreSupportedSchema(colorName, settings.dictionaryUrl || '')
        
        if (schema && onSchemaSelect) {
          onSchemaSelect(colorName, schema)
        } else if (schema) {
          // Fallback to edit form if no main panel handler
          setEditFormOpen(true)
        } else {
          console.warn(`Could not load schema for: ${colorName}`)
          // Reset selection if schema couldn't be loaded
          setSelectedSchema(null)
        }
      }
    } catch (error) {
      console.error(`Error loading schema ${colorName}:`, error)
      setSelectedSchema(null)
    } finally {
      setLoadingSchema(false)
    }
  }

  const handleSchemaApply = (updatedSchema: JSONSchema) => {
    if (selectedSchema && onSchemaUpdate) {
      onSchemaUpdate(selectedSchema, updatedSchema)
    }
  }

  const handleFormClose = () => {
    setEditFormOpen(false)
    setSelectedSchema(null)
  }

  // Find the selected schema data (for edit form fallback)
  const selectedSchemaData = selectedSchema 
    ? jsonSchemas.find(js => js.name === selectedSchema) || { name: selectedSchema, schema: {} }
    : null

  return (
    <>
      <ViaTokensPanel
        definedColors={definedColors}
        onSelect={handleColorSelect}
        selected={selectedSchema}
      />
      
      {loadingSchema && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="text-sm">Loading schema...</div>
          </div>
        </div>
      )}
      
      {selectedSchemaData && editFormOpen && (
        <SchemaEditForm
          open={editFormOpen}
          schemaName={selectedSchemaData.name}
          schema={selectedSchemaData.schema}
          onApply={handleSchemaApply}
          onClose={handleFormClose}
        />
      )}
    </>
  )
}