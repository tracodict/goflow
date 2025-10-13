/**
 * PivotTable vComponent Entry Point
 */

export { PivotTable } from "./PivotTable"
export type { PivotTableProps, FieldDefinition, ValueFieldDefinition } from "./PivotTable"
export { PageBuilderPivotTable } from "./PageBuilderPivotTable"
export { PivotTablePropertyConfig } from "./property-config"

import { registerComponentRenderer, createComponentRenderer } from "../component-renderer-registry"

registerComponentRenderer(
  createComponentRenderer("PivotTable", () => require("./PageBuilderPivotTable").PageBuilderPivotTable, 9),
)
