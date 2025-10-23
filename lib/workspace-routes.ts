import type { FileTreeNode } from '@/stores/workspace-store'

export interface RouteConfig {
  path: string
  filePath: string
  isDynamic: boolean
}

export function generateRoutesFromPages(tree: FileTreeNode[]): RouteConfig[] {
  const pagesFolder = tree.find(node => node.name === 'Pages')
  if (!pagesFolder) return []
  
  return buildRoutes(pagesFolder.children || [], '/')
}

function buildRoutes(nodes: FileTreeNode[], basePath: string): RouteConfig[] {
  const routes: RouteConfig[] = []
  
  for (const node of nodes) {
    if (node.type === 'file') {
      // File name becomes route segment
      const name = node.name // Extension already stripped
      let routePath = basePath
      
      if (name === 'index') {
        // index.page -> /basePath
        routePath = basePath
      } else if (name.startsWith('[') && name.endsWith(']')) {
        // [id].page -> /basePath/:id (dynamic route)
        const param = name.slice(1, -1)
        routePath = `${basePath}:${param}`
      } else {
        // name.page -> /basePath/name
        routePath = `${basePath}${name}`
      }
      
      routes.push({
        path: routePath,
        filePath: node.path,
        isDynamic: name.startsWith('[')
      })
    } else if (node.type === 'directory') {
      // Recurse into subdirectory
      const subPath = `${basePath}${node.name}/`
      routes.push(...buildRoutes(node.children || [], subPath))
    }
  }
  
  return routes
}

export function getPageDataByRoute(route: string, files: Map<string, any>): any | null {
  // Find file that matches route
  // This is a simplified implementation - you may need more sophisticated routing logic
  for (const [path, file] of files.entries()) {
    if (file.type === 'page') {
      // Extract route from path
      // e.g., Pages/home.page -> /home
      // e.g., Pages/dashboard/index.page -> /dashboard
      const pathParts = path.split('/')
      if (pathParts[0] === 'Pages') {
        let pagePath = '/'
        const fileName = pathParts[pathParts.length - 1].replace('.page', '')
        
        if (fileName !== 'index') {
          const segments = pathParts.slice(1, -1)
          pagePath = '/' + [...segments, fileName].join('/')
        } else if (pathParts.length > 2) {
          const segments = pathParts.slice(1, -1)
          pagePath = '/' + segments.join('/')
        }
        
        if (pagePath === route) {
          try {
            return JSON.parse(file.content)
          } catch (error) {
            console.error('Failed to parse page data:', error)
            return null
          }
        }
      }
    }
  }
  
  return null
}
