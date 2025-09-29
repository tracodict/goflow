"use client"
import React from 'react'
import { ViaTokenGrid } from '@/components/via/via-token-grid'

export interface WorkflowTokensProps {
  color?: string
  baseUrl?: string
  dictionaryUrl?: string
  className?: string
  style?: React.CSSProperties
  elementId?: string
  isPreview?: boolean
}

/**
 * WorkflowTokens
 * Thin wrapper around ViaTokenGrid exposing workflow token visualization for a single color set.
 */
export const WorkflowTokens = React.forwardRef<HTMLDivElement, WorkflowTokensProps>(function WorkflowTokens(
  { color = 'INT', baseUrl = '/api', dictionaryUrl = '/api/dictionary', className, style, elementId, isPreview = false }, ref
) {
  const finalElementId = elementId || `workflow-tokens-${React.useId()}`
  return (
    <div ref={ref} data-element-id={finalElementId} className={className} style={style}>
      <ViaTokenGrid baseUrl={baseUrl} color={color} dictionaryUrl={dictionaryUrl} />
    </div>
  )
})

WorkflowTokens.displayName = 'WorkflowTokens'
