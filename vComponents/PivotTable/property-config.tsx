import type { PropertyTabConfig } from "../property-config-types"

export const PivotTablePropertyConfig: PropertyTabConfig = {
  componentType: "PivotTable",
  sections: [
    {
      title: "Data Source",
      fields: [
        {
          key: "data-ssrm-endpoint",
          label: "API Endpoint",
          type: "text",
          placeholder: "/api/ssrm",
          helpText: "Endpoint that implements the SSRM request contract.",
        },
        {
          key: "data-ssrm-database",
          label: "Mongo Database",
          type: "text",
          placeholder: "go_petri_flow",
        },
        {
          key: "data-ssrm-collection",
          label: "Mongo Collection",
          type: "text",
          placeholder: "case_state",
        },
        {
          key: "data-page-size",
          label: "Page Size",
          type: "text",
          placeholder: "200",
          helpText: "Number of rows to request per SSRM call.",
        },
      ],
    },
    {
      title: "Pipeline & Filters",
      fields: [
        {
          key: "data-base-pipeline",
          label: "Base Pipeline (JSON)",
          type: "script",
          placeholder: "[]",
          helpText: "Optional Mongo aggregation stages prepended ahead of SSRM stages.",
        },
        {
          key: "data-filter-model",
          label: "Filter Model (JSON)",
          type: "script",
          placeholder: "{}",
          helpText: "Initial filterModel forwarded to the SSRM endpoint.",
        },
      ],
    },
    {
      title: "Field Configuration",
      fields: [
        {
          key: "data-field-definitions",
          label: "Field Definitions (JSON)",
          type: "script",
          placeholder: JSON.stringify(
            [
              { field: "status", label: "Status", groupable: true, filterable: true, sortable: true },
              { field: "workflowId", label: "Workflow", groupable: true, filterable: true, sortable: true },
              { field: "mode", label: "Mode", pivotable: true, filterable: true, sortable: true },
              { field: "version", label: "Version", aggregatable: true, sortable: true },
              { field: "updatedAt", label: "Updated At", filterable: true, sortable: true },
            ],
            null,
            2,
          ),
          helpText: "Metadata used to label grouping, pivot, and aggregation fields.",
        },
        {
          key: "data-default-group-fields",
          label: "Default Group Fields (JSON)",
          type: "script",
          placeholder: '["status", "workflowId"]',
        },
        {
          key: "data-default-pivot-fields",
          label: "Default Pivot Fields (JSON)",
          type: "script",
          placeholder: '["mode"]',
        },
        {
          key: "data-default-value-fields",
          label: "Value Aggregations (JSON)",
          type: "script",
          placeholder: JSON.stringify(
            [{ field: "version", aggFunc: "max", label: "Max Version" }],
            null,
            2,
          ),
          helpText: "List of measure fields and aggregation functions to apply.",
        },
        {
          key: "data-non-aggregated-fields",
          label: "Detail Fields (JSON)",
          type: "script",
          placeholder: '["caseId", "stateHash", "updatedAt"]',
          helpText: "Fields shown for fully expanded leaf rows when pivoting is disabled.",
        },
      ],
    },
  ],
}
