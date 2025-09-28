/**
 * Page Routing Utilities
 * 
 * Handles conversion between page tree hierarchy and URL paths:
 * - Computes full paths from folder/page hierarchy (like sitemap)
 * - Generates unique slugs within sibling groups
 * - Provides bidirectional mapping: page id <-> URL path
 * - Supports navigation between builder and preview/run modes
 */

import type { PageItem } from '@/stores/pages'

/**
 * Convert a name to a URL-safe slug
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    || 'untitled' // Fallback for empty results
}

/**
 * Ensure slug uniqueness within a sibling group
 */
export function makeSlugUnique(baseSlug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug
  }
  
  let counter = 2
  let uniqueSlug: string
  
  do {
    uniqueSlug = `${baseSlug}-${counter}`
    counter++
  } while (existingSlugs.includes(uniqueSlug))
  
  return uniqueSlug
}

/**
 * Build a path segments array for a page, traversing up the parent chain
 */
export function getPagePathSegments(pageId: string, allPages: PageItem[]): string[] {
  const pageMap = new Map(allPages.map(p => [p.id, p]))
  const segments: string[] = []
  let currentId: string | undefined = pageId
  
  // Traverse up the parent chain, collecting names
  const visited = new Set<string>()
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const page = pageMap.get(currentId)
    if (!page) break
    
    // Include both folders and pages in the path for proper hierarchy
    segments.unshift(nameToSlug(page.name))
    
    currentId = page.parentId
  }
  
  return segments
}

/**
 * Get the full URL path for a page
 */
export function getPagePath(pageId: string, allPages: PageItem[]): string {
  const page = allPages.find(p => p.id === pageId)
  if (!page || page.type !== 'page') {
    return '/'
  }
  
  const segments = getPagePathSegments(pageId, allPages)
  
  return segments.length > 0 ? `/${segments.join('/')}` : '/'
}

/**
 * Build a complete path-to-page-id lookup map
 */
export function buildPagePathMap(allPages: PageItem[]): Map<string, string> {
  const pathMap = new Map<string, string>()
  
  // Group pages by parent to ensure sibling uniqueness
  const pagesByParent = new Map<string | undefined, PageItem[]>()
  for (const page of allPages.filter(p => p.type === 'page')) {
    const parentId = page.parentId
    if (!pagesByParent.has(parentId)) {
      pagesByParent.set(parentId, [])
    }
    pagesByParent.get(parentId)!.push(page)
  }
  
  // Process each sibling group to ensure unique slugs
  for (const [parentId, siblings] of pagesByParent) {
    const usedSlugs = new Set<string>()
    
    for (const page of siblings) {
      const baseSlug = nameToSlug(page.name)
      const uniqueSlug = makeSlugUnique(baseSlug, Array.from(usedSlugs))
      usedSlugs.add(uniqueSlug)
      
      // Build full path for this page
      const segments = getPagePathSegments(page.id, allPages)
      // Replace the last segment with our unique slug
      if (segments.length > 0) {
        segments[segments.length - 1] = uniqueSlug
      }
      
      const fullPath = segments.length > 0 ? `/${segments.join('/')}` : '/'
      
      // Special case: home page at root gets multiple mappings
      if (page.name.toLowerCase() === 'home' && !page.parentId) {
        pathMap.set('/', page.id)
        pathMap.set('/home', page.id) // Also map /home to home page
        // Handle case variations for direct access
        pathMap.set('/Home', page.id)
        pathMap.set('/HOME', page.id)
      } else {
        // Add both the computed path and case variations
        pathMap.set(fullPath, page.id)
        // Add lowercase version for case-insensitive matching
        if (fullPath !== fullPath.toLowerCase()) {
          pathMap.set(fullPath.toLowerCase(), page.id)
        }
      }
    }
  }
  
  return pathMap
}

/**
 * Find page ID by URL path
 */
export function findPageByPath(path: string, allPages: PageItem[]): string | null {
  const pathMap = buildPagePathMap(allPages)
  
  // Try exact match first
  let pageId = pathMap.get(path)
  if (pageId) return pageId
  
  // Try lowercase fallback for case-insensitive matching
  pageId = pathMap.get(path.toLowerCase())
  if (pageId) return pageId
  
  // Try with trailing slash removed/added
  const altPath = path.endsWith('/') ? path.slice(0, -1) : path + '/'
  pageId = pathMap.get(altPath) || pathMap.get(altPath.toLowerCase())
  if (pageId) return pageId
  
  return null
}

/**
 * Generate navigation URL for a page
 */
export function getPageNavigationURL(
  pageId: string, 
  allPages: PageItem[], 
  mode: 'builder' | 'preview' | 'run' = 'preview'
): string {
  const basePath = getPagePath(pageId, allPages)
  
  if (mode === 'builder') {
    // Builder mode: stay on main route with page selection
    return `/?page=${pageId}`
  } else if (mode === 'run') {
    // Run mode: append run query param
    return `${basePath}?mode=run`
  } else {
    // Preview mode: clean path
    return basePath
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
    const page = pageMap.get(currentId)
    if (!page) break
    
    breadcrumbs.unshift({
      id: page.id,
      name: page.name,
      path: getPagePath(page.id, allPages)
    })
    
    currentId = page.parentId
  }
  
  return breadcrumbs
}