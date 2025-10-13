/**
 * MP3Player vComponent Entry Point
 */

export { MP3Player } from "./MP3Player"
export type { MP3PlayerProps } from "./MP3Player"
export { PageBuilderMP3Player } from "./PageBuilderMP3Player"
export type { PageBuilderMP3PlayerProps } from "./PageBuilderMP3Player"
export { MP3PlayerPropertyConfig } from "./property-config"

import { registerComponentRenderer, createComponentRenderer } from "../component-renderer-registry"

registerComponentRenderer(
  createComponentRenderer("MP3Player", () => require("./PageBuilderMP3Player").PageBuilderMP3Player, 10),
)
