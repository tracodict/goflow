/**
 * Page Navigation Hook
 * 
 * Provides navigation utilities for the page builder system:
 * - Navigate between pages in different modes (builder, preview, run)
 * - Handle URL synchronization
 * - Provide preview/run shortcuts from builder
 */

"use client"

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { usePagesStore } from '@/stores/pages'

export function usePageNavigation() {
  const router = useRouter()
  const { getPageNavigationURL, findPageByPath } = usePagesStore()

  const navigateToPage = useCallback((
    pageId: string, 
    mode: 'builder' | 'preview' | 'run' = 'preview'
  ) => {
    const url = getPageNavigationURL(pageId, mode)
    router.push(url)
  }, [router, getPageNavigationURL])

  const previewCurrentPage = useCallback((pageId: string) => {
    const url = getPageNavigationURL(pageId, 'preview')
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [getPageNavigationURL])

  const runCurrentPage = useCallback((pageId: string) => {
    const url = getPageNavigationURL(pageId, 'run')
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [getPageNavigationURL])

  const navigateToPath = useCallback((path: string, mode: 'preview' | 'run' = 'preview') => {
    const pageId = findPageByPath(path)
    if (pageId) {
      navigateToPage(pageId, mode)
    }
  }, [navigateToPage, findPageByPath])

  return {
    navigateToPage,
    previewCurrentPage,
    runCurrentPage,
    navigateToPath,
  }
}