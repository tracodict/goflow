"use client"
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Wand2 } from 'lucide-react'
// Import the visual schema editor (pure builder) from jsonjoy-builder
import SchemaVisualEditor from '@/jsonjoy-builder/src/components/SchemaEditor/SchemaVisualEditor'
import { SchemaInferencer } from '@/jsonjoy-builder/src/components/features/SchemaInferencer'
import type { JSONSchema } from '@/jsonjoy-builder/src/types/jsonSchema'

export interface SchemaEditFormProps {
  /** Whether the form is open/visible */
  open: boolean
  /** Schema name to display in header */
  schemaName: string
  /** Initial schema data */
  schema: JSONSchema
  /** Called when user applies changes */
  onApply: (schema: JSONSchema) => void
  /** Called when user cancels or closes */
  onClose: () => void
}

export const SchemaEditForm: React.FC<SchemaEditFormProps> = ({
  open,
  schemaName,
  schema,
  onApply,
  onClose
}) => {
  const [schemaDraft, setSchemaDraft] = useState<JSONSchema>(() => schema)
  const [showInferencer, setShowInferencer] = useState(false)

  // Update draft when schema prop changes
  React.useEffect(() => {
    setSchemaDraft(schema)
  }, [schema])

  if (!open) return null

  const handleApply = () => {
    onApply(schemaDraft)
    onClose()
  }

  const handleCancel = () => {
    setSchemaDraft(schema) // Reset to original
    setShowInferencer(false)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40">
        <div className="w-[780px] max-h-[85vh] rounded-md border bg-white shadow-lg flex flex-col">
          <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
            <div className="flex items-center gap-3">
              <span>Edit Schema: {schemaName || 'Unnamed'}</span>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowInferencer(true)} 
                className="flex items-center gap-1" 
                aria-label="Infer from JSON sample"
              >
                <Wand2 className="h-4 w-4" /> Infer
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
              <Button size="icon" variant="ghost" aria-label="Close" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <SchemaVisualEditor 
              schema={schemaDraft} 
              onChange={(next) => setSchemaDraft(next as JSONSchema)} 
            />
          </div>
        </div>
      </div>
      
      {showInferencer && (
        <SchemaInferencer
          open={showInferencer}
          onOpenChange={(open) => setShowInferencer(open)}
          onSchemaInferred={(s) => {
            setSchemaDraft(s as JSONSchema)
          }}
        />
      )}
    </>
  )
}