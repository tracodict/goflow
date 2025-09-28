/**
 * Page Routing Utilities - Simplified Tree-Based Version
 * 
 * Handles conversion between page tree hierarchy and URL paths:
 * - Maps tree structure directly to URL paths (DDD/PPP -> /DDD/PPP)
 * - Case-sensitive matching to respect actual page names
 * - Folders included in path hierarchy
 */

import type { PageItem } from '@/stores/pages'

/**
 * Convert a name to a URL-safe slug (preserving original case as much as possible)
 */
export function nameToSlug(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars but keep case
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    || 'untitled' // Fallback for empty results
}

/**
 * Build path segments for a page by traversing up the parent chain
 */
export function getPagePathSegments(pageId: string, allPages: PageItem[]): string[] {
  const pageMap = new Map(allPages.map(p => [p.id, p]))
  const segments: string[] = []
  let currentId: string | undefined = pageId
  
  // Traverse up the parent chain, collecting ALL items (folders + pages)
  const visited = new Set<string>()
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const item = pageMap.get(currentId)
    if (!item) break
    
    // Add this item's name to the path
    segments.unshift(nameToSlug(item.name))
    currentId = item.parentId
  }
  
  return segments
}

/**
 * Get the full URL path for a page
 */
export function getPagePath(pageId: string, allPages: PageItem[]): string {
  const page = allPages.find(p => p.id === pageId && p.type === 'page')
  if (!page) return '/'
  
  const segments = getPagePathSegments(pageId, allPages)
  return segments.length > 0 ? `/${segments.join('/')}` : '/'
}

/**
 * Build a complete path-to-page-id lookup map
 */
export function buildPagePathMap(allPages: PageItem[]): Map<string, string> {
  const pathMap = new Map<string, string>()
  
  // Process all pages to build their paths
  for (const page of allPages.filter(p => p.type === 'page')) {
    const path = getPagePath(page.id, allPages)
    pathMap.set(path, page.id)
    console.log('[buildPagePathMap]', { pageName: page.name, pageId: page.id, path })
  }
  
  console.log('[buildPagePathMap] Final map:', Array.from(pathMap.entries()))
  return pathMap
}

/**
 * Find page ID by URL path
 */
export function findPageByPath(path: string, allPages: PageItem[]): string | null {
  const pathMap = buildPagePathMap(allPages)
  return pathMap.get(path) || null
}

/**
 * Generate navigation URL for a page
 */
export function getPageNavigationURL(
  pageId: string, 
  allPages: PageItem[], 
  mode: 'builder' | 'preview' | 'run' = 'preview'
): string {
  const page = allPages.find(p => p.id === pageId && p.type === 'page')
  if (!page) return '/'
  
  if (mode === 'builder') {
    // Builder mode: stay on root route with page selection
    return `/?page=${pageId}`
  } else {
    // Preview/run mode: use the page path
    const basePath = getPagePath(pageId, allPages)
    if (mode === 'run') {
      return `${basePath}?mode=run`
    } else {
      return `${basePath}?mode=preview`
    }
  }
}

/**
 * Extract mode and page info from current URL
 */
export function parseCurrentURL(pathname: string, searchParams?: URLSearchParams): {
  mode: 'builder' | 'preview' | 'run'
  pageId?: string
  path: string
} {
  const params = searchParams || new URLSearchParams()
  
  // Builder mode: root path with ?page=xxx
  if (pathname === '/' && params.get('page')) {
    return {
      mode: 'builder',
      pageId: params.get('page') || undefined,
      path: pathname
    }
  }
  
  // Run mode: any path with ?mode=run
  if (params.get('mode') === 'run') {
    return {
      mode: 'run',
      path: pathname
    }
  }
  
  // Default: preview mode
  return {
    mode: 'preview',
    path: pathname
  }
}

/**
 * Get breadcrumb items for a page path
 */
export function getPageBreadcrumbs(pageId: string, allPages: PageItem[]): Array<{ id: string, name: string, path: string }> {
  const pageMap = new Map(allPages.map(p => [p.id, p]))
  const breadcrumbs: Array<{ id: string, name: string, path: string }> = []
  let currentId: string | undefined = pageId
  
  // Traverse up the parent chain
  const visited = new Set<string>()
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const item = pageMap.get(currentId)
    if (!item) break
    
    breadcrumbs.unshift({
      id: item.id,
      name: item.name,
      path: item.type === 'page' ? getPagePath(item.id, allPages) : '#'
    })
    
    currentId = item.parentId
  }
  
  return breadcrumbs
}