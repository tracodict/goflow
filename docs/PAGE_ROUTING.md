# Page Routing System Implementation

## Overview

The page routing system has been implemented to map the hierarchical page tree structure from the Pages tab into navigable URLs. This enables:

- **Direct URL access** to any page in preview or run mode
- **SEO-friendly URLs** based on page names and folder structure  
- **Builder integration** with URL synchronization
- **Mode switching** between builder, preview, and run contexts

## Routing Structure

### URL Patterns

1. **Builder Mode**: `/?page={pageId}` 
   - Main builder interface with specific page loaded
   - Example: `/?page=about-us`

2. **Preview Mode**: `/{path-segments}`
   - Clean URLs for page preview
   - Example: `/about/team` (for page "Team" in "About" folder)

3. **Run Mode**: `/{path-segments}?mode=run`
   - Same paths as preview but with run mode query param
   - Example: `/contact?mode=run`

### Path Generation

- **Folders**: Provide structure but don't create routes themselves
- **Pages**: Generate actual navigable endpoints
- **Slugs**: Auto-generated from page names using kebab-case conversion
- **Uniqueness**: Ensured within sibling groups (automatic `-2`, `-3` suffixes)
- **Home Page**: Special case - maps to root `/` if named "Home" at top level

## Implementation Files

### Core Utilities (`lib/page-routing.ts`)
```typescript
// Key functions:
nameToSlug(name: string): string
getPagePath(pageId: string, allPages: PageItem[]): string  
findPageByPath(path: string, allPages: PageItem[]): string | null
getPageNavigationURL(pageId: string, pages: PageItem[], mode): string
buildPagePathMap(allPages: PageItem[]): Map<string, string>
```

### Dynamic Route Handler (`app/[...segments]/page.tsx`)
- Catches all page routes using Next.js catch-all segments
- Resolves path to page ID using store lookup
- Loads page elements into builder store
- Switches to preview/run mode automatically
- Returns 404 for non-existent paths

### Enhanced Pages Store (`stores/pages.ts`)
```typescript
// New methods added:
getPagePath(id: string): string
findPageByPath(path: string): string | null  
getPageNavigationURL(id: string, mode?): string
buildPathMap(): Map<string, string>
```

### Updated Builder Integration (`components/builder/tabs/PagesTab.tsx`)
- Page selection now navigates via URL instead of direct element loading
- Maintains unsaved changes workflow
- Uses `useRouter` for navigation
- Preserves existing UI patterns

### Navigation Hook (`hooks/use-page-navigation.ts`)
```typescript
// Provides:
navigateToPage(pageId, mode)
previewCurrentPage(pageId) // Opens in new tab
runCurrentPage(pageId)     // Opens in new tab  
navigateToPath(path, mode)
```

### Not Found Page (`app/not-found.tsx`)
- Clean 404 page for invalid routes
- Links back to home page

## Usage Examples

### From Builder (Pages Tab)
```typescript
// Clicking a page in the tree:
const url = getPageNavigationURL(pageId, 'builder')
router.push(url) // -> /?page=about-us
```

### From Navigation Menu
```typescript  
const { navigateToPage } = usePageNavigation()

// Navigate to page in preview mode:
navigateToPage('contact-page', 'preview') // -> /contact

// Open page in run mode (new tab):
runCurrentPage('contact-page') // -> /contact?mode=run
```

### Direct URL Access
- User types `/about/team` in browser
- System resolves to page ID and renders PageWorkspace in preview mode
- Page elements loaded automatically

## Benefits

1. **Bookmarkable URLs**: Users can bookmark and share direct links to pages
2. **SEO Friendly**: Clean, descriptive URLs based on actual page names
3. **Mode Flexibility**: Same content accessible in different contexts
4. **Builder Integration**: Seamless switching between editing and viewing
5. **Automatic Updates**: URLs update when pages are renamed or moved
6. **404 Handling**: Graceful fallback for invalid routes

## Future Enhancements

- **Custom Slugs**: Allow manual override of auto-generated slugs
- **Redirects**: Handle old URLs when pages are moved/renamed  
- **Metadata**: Page-specific title/description for SEO
- **Analytics**: Track page views and navigation patterns
- **Caching**: Optimize path resolution for large page trees

The routing system provides a solid foundation for turning the page builder into a full website management platform with proper URL structure and navigation.