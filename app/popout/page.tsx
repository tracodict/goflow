"use client"

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BuilderStoreProvider, useBuilderStoreContext } from '@/stores/pagebuilder/editor-context'
import { PageWorkspace } from '@/components/builder/PageWorkspace'
import type { Element } from '@/stores/pagebuilder/editor'

// Component to enable preview mode on mount
function PopoutContent() {
  const store = useBuilderStoreContext()
  
  useEffect(() => {
    // Enable preview mode for popout window
    const state = store.getState()
    if (!state.isPreviewMode) {
      state.togglePreviewMode()
    }
  }, [store])
  
  return <PageWorkspace />
}

// Component that uses search params - needs to be wrapped in Suspense
function PopoutPageContent() {
  const searchParams = useSearchParams()
  const tabId = searchParams.get('tabId')
  const title = searchParams.get('title') || 'Page'
  
  const [elements, setElements] = useState<Record<string, Element> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get elements from localStorage (parent window saves before opening popout)
    const storedElements = localStorage.getItem(`popout-${tabId}`)
    if (storedElements) {
      try {
        const parsed = JSON.parse(storedElements)
        setElements(parsed)
      } catch (e) {
        console.error('Failed to parse stored elements:', e)
      }
    }
    setLoading(false)
  }, [tabId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-muted-foreground">Loading {title}...</div>
      </div>
    )
  }

  if (!elements || Object.keys(elements).length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-muted-foreground">No content available</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-10 border-b border-border flex items-center px-4 bg-card">
        <strong className="text-sm">{title}</strong>
        <span className="ml-auto text-xs text-muted-foreground">Preview Mode</span>
      </div>
      <div className="flex-1 overflow-auto">
        <BuilderStoreProvider tabId={tabId || 'popout'} initialElements={elements}>
          <PopoutContent />
        </BuilderStoreProvider>
      </div>
    </div>
  )
}

export default function PopoutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <PopoutPageContent />
    </Suspense>
  )
}
