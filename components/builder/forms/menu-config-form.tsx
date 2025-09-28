"use client"
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { DynamicForm } from '@/components/run/forms/dynamic-form'

export interface MenuConfigFormProps {
  /** Whether the form is open/visible */
  open: boolean
  /** Initial menu configuration data */
  config: any
  /** Called when user applies changes */
  onApply: (config: any) => void
  /** Called when user cancels or closes */
  onClose: () => void
}

export const MenuConfigForm: React.FC<MenuConfigFormProps> = ({
  open,
  config,
  onApply,
  onClose
}) => {
  const [configDraft, setConfigDraft] = useState<any>(() => config)

  // Update draft when config prop changes
  React.useEffect(() => {
    setConfigDraft(config)
  }, [config])

  if (!open) return null

  const handleApply = () => {
    onApply(configDraft)
    onClose()
  }

  const handleCancel = () => {
    setConfigDraft(config) // Reset to original
    onClose()
  }

  // Menu configuration schema for JsonForms
  const menuConfigSchema = {
    type: "object",
    properties: {
      orientation: {
        type: "string",
        enum: ["horizontal", "vertical"],
        default: "horizontal",
        title: "Orientation"
      },
      showIcons: {
        type: "boolean",
        default: true,
        title: "Show Icons"
      },
      showBadges: {
        type: "boolean", 
        default: false,
        title: "Show Badges"
      },
      items: {
        type: "array",
        title: "Menu Items",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              title: "ID",
              description: "Unique identifier for the menu item"
            },
            label: {
              type: "string",
              title: "Label",
              description: "Display text for the menu item"
            },
            href: {
              type: "string",
              title: "Link URL",
              description: "Link URL (optional)"
            },
            icon: {
              type: "string",
              title: "Icon",
              description: "Icon (emoji or icon name)"
            },
            script: {
              type: "string",
              title: "Custom Script",
              description: "Custom JavaScript code (optional)",
              format: "textarea"
            },
            scriptType: {
              type: "string",
              enum: ["custom"],
              title: "Script Type",
              description: "Type of script"
            },
            children: {
              type: "array",
              title: "Sub-menu Items",
              items: {
                type: "object",
                properties: {
                  id: { 
                    type: "string",
                    title: "ID" 
                  },
                  label: { 
                    type: "string",
                    title: "Label" 
                  },
                  href: { 
                    type: "string",
                    title: "Link URL" 
                  },
                  icon: { 
                    type: "string",
                    title: "Icon" 
                  }
                },
                required: ["id", "label"]
              }
            }
          },
          required: ["id", "label"]
        }
      }
    },
    required: ["items", "orientation"]
  }

  // Custom UI schema for better layout
  const uiSchema = {
    type: "VerticalLayout",
    elements: [
      {
        type: "HorizontalLayout",
        elements: [
          {
            type: "Control",
            scope: "#/properties/orientation"
          },
          {
            type: "Control",
            scope: "#/properties/showIcons"
          },
          {
            type: "Control",
            scope: "#/properties/showBadges"
          }
        ]
      },
      {
        type: "Control",
        scope: "#/properties/items",
        options: {
          detail: {
            type: "VerticalLayout",
            elements: [
              {
                type: "HorizontalLayout",
                elements: [
                  {
                    type: "Control",
                    scope: "#/properties/id"
                  },
                  {
                    type: "Control",
                    scope: "#/properties/label"
                  }
                ]
              },
              {
                type: "HorizontalLayout",
                elements: [
                  {
                    type: "Control",
                    scope: "#/properties/href"
                  },
                  {
                    type: "Control",
                    scope: "#/properties/icon"
                  }
                ]
              },
              {
                type: "Control",
                scope: "#/properties/script",
                options: {
                  multi: true
                }
              },
              {
                type: "Control",
                scope: "#/properties/scriptType"
              },
              {
                type: "Control",
                scope: "#/properties/children",
                options: {
                  detail: {
                    type: "HorizontalLayout",
                    elements: [
                      {
                        type: "Control",
                        scope: "#/properties/id"
                      },
                      {
                        type: "Control",
                        scope: "#/properties/label"
                      },
                      {
                        type: "Control",
                        scope: "#/properties/href"
                      },
                      {
                        type: "Control",
                        scope: "#/properties/icon"
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      }
    ]
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40">
      <div className="w-[800px] max-h-[85vh] rounded-md border bg-white shadow-lg flex flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
          <div className="flex items-center gap-3">
            <span>Configure Menu</span>
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
        <div className="flex-1 overflow-auto p-4">
          <DynamicForm
            schema={menuConfigSchema}
            data={configDraft}
            onChange={setConfigDraft}
            uiSchema={uiSchema}
            readOnly={false}
          />
        </div>
      </div>
    </div>
  )
}