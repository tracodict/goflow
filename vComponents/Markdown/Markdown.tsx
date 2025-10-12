"use client"

import React, { useMemo } from "react"
import showdown from "showdown"

const converter = new showdown.Converter({
  tables: true,
  tasklists: true,
  strikethrough: true,
  simpleLineBreaks: true,
  openLinksInNewWindow: true,
})

converter.setFlavor("github")
converter.setOption("emoji", true)
converter.setOption("smartIndentationFix", true)
converter.setOption("smartLists", true)
converter.setOption("sanitize", true)

export interface MarkdownProps {
  /** Markdown content to render */
  content?: string
  className?: string
  style?: React.CSSProperties
}

export const Markdown: React.FC<MarkdownProps> = ({ content = "", className, style }) => {
  const html = useMemo(() => {
    if (!content) return ""
    try {
      return converter.makeHtml(content)
    } catch (error) {
      console.warn("[Markdown] Failed to convert markdown", error)
      return content
    }
  }, [content])

  const combinedClassName = useMemo(() => {
    return ["markdown-renderer", className].filter(Boolean).join(" ")
  }, [className])

  if (!content.trim()) {
    return <div className={combinedClassName} style={style} />
  }

  return <div className={combinedClassName} style={style} dangerouslySetInnerHTML={{ __html: html }} />
}

Markdown.displayName = "Markdown"
