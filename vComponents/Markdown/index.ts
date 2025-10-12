/**
 * Markdown vComponent Entry Point
 *
 * Exports the Markdown renderer and registers the PageBuilder wrapper
 * so the component can be rendered dynamically inside the builder.
 */

export { Markdown } from "./Markdown"
export type { MarkdownProps } from "./Markdown"
export { PageBuilderMarkdown } from "./PageBuilderMarkdown"
export type { PageBuilderMarkdownProps } from "./PageBuilderMarkdown"
export { MarkdownPropertyConfig } from "./property-config"

import { registerComponentRenderer, createComponentRenderer } from "../component-renderer-registry"

registerComponentRenderer(
  createComponentRenderer("Markdown", () => require("./PageBuilderMarkdown").PageBuilderMarkdown, 8)
)
