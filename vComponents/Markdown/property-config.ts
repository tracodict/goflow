/**
 * Markdown Property Configuration
 */

import { PropertyTabConfig } from "../property-config-types"

export const MarkdownPropertyConfig: PropertyTabConfig = {
  componentType: "Markdown",
  sections: [
    {
      title: "General",
      fields: [
        {
          key: "data-content",
          label: "Content",
          type: "textarea",
          placeholder: "# Welcome to GoFlow\n\nRender **Markdown** content here...",
          helpText: "Supports GitHub-flavored Markdown. Links open in a new window by default.",
          rows: 6,
        },
      ],
    },
  ],
}
