"use client"

import { notFound } from 'next/navigation'
import { usePagesStore } from '@/stores/pages'
import { PageWorkspace } from '@/components/builder/PageWorkspace'
import { parseCurrentURL } from '@/lib/page-routing'
import { useBuilderStore } from '@/stores/pagebuilder/editor'
import { useEffect } from 'react'

interface PageRouteClientProps {
  path: string
  searchParams: { [key: string]: string | string[] | undefined }
}

export function PageRouteClient({ path, searchParams }: PageRouteClientProps) {
  // Convert searchParams to URLSearchParams for parsing
  const urlParams = new URLSearchParams()
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => urlParams.append(key, v))
      } else if (value) {
        urlParams.set(key, value)
      }
    })
  }
  
  const { mode } = parseCurrentURL(path, urlParams)
  const { findPageByPath } = usePagesStore()
  const { togglePreviewMode, isPreviewMode, loadElements } = useBuilderStore()
  
  // Find the page by path
  const pageId = findPageByPath(path)
  console.log('[PageRoute] Path resolution:', { path, pageId })
  
  if (!pageId) {
    console.log('[PageRoute] No page found for path:', path)
    notFound()
  }
  
  const page = usePagesStore.getState().findPageById(pageId)
  if (!page) {
    notFound()
  }
  
  // Set preview/run mode and load page elements
  useEffect(() => {
    if ((mode === 'preview' || mode === 'run') && !isPreviewMode) {
      togglePreviewMode()
    }
    
    // Load page elements into builder store
    if (page.elements && Object.keys(page.elements).length > 0) {
      loadElements(page.elements)
    }
  }, [mode, page.elements, isPreviewMode, togglePreviewMode, loadElements])
  
  return (
    <div className="h-screen w-full">
      <PageWorkspace />
    </div>
  )
}