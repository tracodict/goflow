/**
 * Combobox vComponent Entry Point
 */

export { Combobox } from "./Combobox"
export type { ComboboxProps, ComboboxOption } from "./Combobox"
export { PageBuilderCombobox } from "./PageBuilderCombobox"
export type { PageBuilderComboboxProps } from "./PageBuilderCombobox"
export { ComboboxPropertyConfig } from "./property-config"

import { registerComponentRenderer, createComponentRenderer } from "../component-renderer-registry"

registerComponentRenderer(
  createComponentRenderer("Combobox", () => require("./PageBuilderCombobox").PageBuilderCombobox, 11),
)
