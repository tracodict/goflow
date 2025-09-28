/**
 * Button Property Tab Configuration
 */

import React from "react"
import { PropertyTabConfig } from "../property-config-types"

export const ButtonPropertyConfig: PropertyTabConfig = {
  componentType: "Button",
  sections: [
    {
      title: "Button Events",
      fields: [
        {
          key: "data-onclick-script",
          label: "onClick Script",
          type: "script",
          rows: 3,
          placeholder: "// JavaScript code for onClick event\n// Available: payload, context, component, page, app",
          helpText: "Event payload includes: timestamp, componentId, modifierKeys, position"
        },
        {
          key: "data-onmount-script",
          label: "onMount Script",
          type: "script",
          rows: 2,
          placeholder: "// JavaScript code for onMount event\n// Executed when button is first rendered"
        },
        {
          key: "data-onunmount-script",
          label: "onUnmount Script", 
          type: "script",
          rows: 2,
          placeholder: "// JavaScript code for onUnmount event\n// Executed when button is removed"
        }
      ]
    },
    {
      title: "State Properties",
      fields: [
        {
          key: "data-loading",
          label: "Loading",
          type: "checkbox"
        },
        {
          key: "data-disabled", 
          label: "Disabled",
          type: "checkbox"
        },
        {
          key: "data-loading-text",
          label: "Loading Text",
          type: "text",
          placeholder: "Loading..."
        }
      ]
    }
  ]
}