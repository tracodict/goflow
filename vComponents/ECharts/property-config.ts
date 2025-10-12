import { PropertyTabConfig } from "../property-config-types"
import { EChartsPropertyPanel } from "./PropertyPanel"

export const EChartsPropertyConfig: PropertyTabConfig = {
  componentType: "ECharts",
  sections: [],
  customRenderer: EChartsPropertyPanel,
}
