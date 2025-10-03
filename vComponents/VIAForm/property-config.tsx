/**
 * VIAForm Property Tab Configuration
 */

import React from "react"
import { PropertyTabConfig } from "../property-config-types"

export const VIAFormPropertyConfig: PropertyTabConfig = {
  componentType: "VIAForm",
  sections: [
    {
      title: "VIA Events",
      fields: [
        {
          key: "data-ontokenselected-script",
          label: "onTokenSelected Script",
          type: "script",
          rows: 3,
          placeholder: "// JavaScript code for token selection event\n// Available: payload, context, component, page, app\n// payload.token contains selected token data",
          helpText: "Event payload includes: token (id, caseId, placeId, value, color)"
        },
        {
          key: "data-ontransitionfired-script",
          label: "onTransitionFired Script",
          type: "script",
          rows: 3,
          placeholder: "// JavaScript code for transition fired event\n// payload.transitionId, payload.result available",
          helpText: "Fired when a transition is executed on a token"
        },
        {
          key: "data-oncolorchanged-script",
          label: "onColorChanged Script",
          type: "script",
          rows: 2,
          placeholder: "// JavaScript code for color change event\n// payload.color contains selected color/schema",
          helpText: "Fired when the selected color/schema changes"
        },
        {
          key: "data-onmount-script",
          label: "onMount Script",
          type: "script",
          rows: 2,
          placeholder: "// JavaScript code for onMount event\n// Executed when VIAForm is first rendered"
        },
        {
          key: "data-onunmount-script",
          label: "onUnmount Script", 
          type: "script",
          rows: 2,
          placeholder: "// JavaScript code for onUnmount event\n// Executed when VIAForm is removed"
        }
      ]
    },
    {
      title: "VIA Configuration",
      fields: [
        {
          key: "data-initial-color",
          label: "Initial Color/Schema",
          type: "text",
          placeholder: "e.g., Order, Customer, Product",
          helpText: "The color/schema to select when the component first loads"
        },
        {
          key: "data-show-action-buttons",
          label: "Show Action Buttons",
          type: "checkbox",
          helpText: "Whether to display action buttons in the token grid"
        }
      ]
    },
    {
      title: "Layout & Appearance",
      fields: [
        {
          key: "data-height",
          label: "Height",
          type: "text",
          placeholder: "e.g., 400px, 50vh, 100%",
          helpText: "Height of the VIA form component"
        },
        {
          key: "data-width",
          label: "Width",
          type: "text",
          placeholder: "e.g., 100%, 600px, 80vw",
          helpText: "Width of the VIA form component"
        },
        {
          key: "className",
          label: "CSS Classes",
          type: "text",
          placeholder: "space-separated CSS class names",
          helpText: "Additional CSS classes to apply to the component"
        }
      ]
    }
  ]
}

export default VIAFormPropertyConfig