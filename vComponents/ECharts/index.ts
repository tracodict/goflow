/**
 * ECharts vComponent Entry Point
 */

export { ECharts } from "./ECharts"
export type { EChartsProps } from "./ECharts"
export { PageBuilderECharts } from "./PageBuilderECharts"
export type { PageBuilderEChartsProps } from "./PageBuilderECharts"
export { EChartsPropertyConfig } from "./property-config"

import { registerComponentRenderer, createComponentRenderer } from "../component-renderer-registry"

registerComponentRenderer(
  createComponentRenderer("ECharts", () => require("./PageBuilderECharts").PageBuilderECharts, 9)
)
