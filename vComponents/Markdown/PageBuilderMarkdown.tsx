"use client"

import React, { useMemo } from "react"
import { Markdown } from "./Markdown"

export interface PageBuilderMarkdownProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-content"?: string
  "data-component-type"?: string
}

const placeholderStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  fontStyle: "italic",
}

export const PageBuilderMarkdown: React.FC<PageBuilderMarkdownProps> = ({
  "data-content": markdownContent,
  "data-component-type": componentType,
  onClick,
  className,
  style,
  ...rest
}) => {
  const content = markdownContent ?? ""
  const hasContent = content.trim().length > 0

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    backgroundColor: "transparent",
    padding: "16px",
    borderRadius: "8px",
    border: hasContent ? "1px solid #e5e7eb" : "1px dashed #cbd5e1",
    lineHeight: 1.6,
    ...style,
  }), [hasContent, style])

  return (
    <div
      {...rest}
      data-component-type={componentType}
      onClick={onClick}
      className={className}
      style={containerStyle}
    >
      {hasContent ? (
        <Markdown content={content} />
      ) : (
        <div style={placeholderStyle}>Markdown: add content in properties panel.</div>
      )}
    </div>
  )
}

PageBuilderMarkdown.displayName = "PageBuilderMarkdown"
