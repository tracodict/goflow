"use client"

import { Builder } from "@/components/builder/Builder"
import { PageWorkspace } from "@/components/builder/PageWorkspace"  
import { usePagesStore } from "@/stores/pages"
import { useBuilderStore } from "@/stores/pagebuilder/editor"
import { useSearchParams, usePathname, notFound } from "next/navigation"
import { useEffect } from "react"
import { parseCurrentURL } from '@/lib/page-routing'

export default function Home() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const pageId = searchParams.get('page')
  const mode = searchParams.get('mode')
  
  console.log('[Root] Pathname:', pathname, 'PageId:', pageId, 'Mode:', mode)
  
  const { findPageById, findPageByPath, setActivePage } = usePagesStore()
  const { loadElements, togglePreviewMode, isPreviewMode } = useBuilderStore()

  // Handle different routing scenarios
  useEffect(() => {
    if (pageId) {
      // Builder mode with specific page: /?page=xyz
      const page = findPageById(pageId)
      if (page) {
        setActivePage(pageId)
        if (page.elements && Object.keys(page.elements).length > 0) {
          loadElements(page.elements)
        }
      }
    } else if (pathname !== '/') {
      // This shouldn't happen since we only have root route now
      // But handle it gracefully
      console.warn('[Root] Non-root pathname detected:', pathname)
    }
  }, [pageId, pathname, findPageById, setActivePage, loadElements])

  // Handle preview/run modes
  useEffect(() => {
    if (mode === 'run' || mode === 'preview') {
      if (!isPreviewMode) {
        togglePreviewMode()
      }
    }
  }, [mode, isPreviewMode, togglePreviewMode])

  // If in preview/run mode, render just the workspace
  if (mode === 'run' || mode === 'preview') {
    return (
      <div className="h-screen w-full">
        <PageWorkspace />
      </div>
    )
  }

  // Default: builder mode
  return <Builder />
}