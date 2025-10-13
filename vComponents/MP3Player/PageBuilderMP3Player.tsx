"use client"

import * as React from "react"

import { MP3Player } from "./MP3Player"

export interface PageBuilderMP3PlayerProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-src"?: string
  "data-title"?: string
  "data-autoplay"?: string
  "data-loop"?: string
}

export const PageBuilderMP3Player: React.FC<PageBuilderMP3PlayerProps> = ({
  "data-src": dataSrc,
  "data-title": dataTitle,
  "data-autoplay": dataAutoplay,
  "data-loop": dataLoop,
  onClick,
  className,
  style,
  ...rest
}) => {
  const autoplay = dataAutoplay === "true"
  const loop = dataLoop === "true"
  const src = dataSrc && dataSrc.trim().length > 0 ? dataSrc : undefined
  const title = dataTitle && dataTitle.trim().length > 0 ? dataTitle : undefined

  return (
    <div
      {...rest}
      onClick={onClick}
      className={className}
      style={style}
      data-component-type="MP3Player"
    >
      <MP3Player src={src} title={title} autoPlay={autoplay} loop={loop} />
    </div>
  )
}

PageBuilderMP3Player.displayName = "PageBuilderMP3Player"
