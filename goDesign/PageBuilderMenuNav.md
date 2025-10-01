# GoFlow Navigation Menu Tutorial

## Building Interactive Navigation with Custom Scripts and Nested Menus

This comprehensive tutorial guides you through implementing and using the Enhanced Navigation Menu component in GoFlow's PageBuilder platform, covering everything from basic setup to advanced scripting patterns.

> **Status Update**: The Menu component is now fully functional in the PageBuilder! 
> - ✅ **Component Registration**: Properly registered in the component system
> - ✅ **Component Library**: Available in the left panel → Components → Radix section as "Menu"
> - ✅ **Page Rendering**: Functional rendering support in PageElement.tsx
> - ✅ **Canvas Selection**: Fixed click event handling - components can now be selected directly on canvas
> - ✅ **Properties Panel**: Configuration options working in the right panel
> - ✅ **Menu Definition**: Visual menu builder panel implemented
- ✅ **Integration (Phase 1 Stub)**: Menu Definition Panel now opens in modeless dialog (stub editor)
- 🔧 **Integration (Full Visual Editor)**: Advanced drag & drop + script binding UI pending

## Table of Contents
1. [Enhanced Navigation Menu Overview](#1-enhanced-navigation-menu-overview)
2. [Component Interface Implementation](#2-component-interface-implementation)
3. [Menu Definition and Configuration](#3-menu-definition-and-configuration)
4. [Custom Scripting for Menu Items](#4-custom-scripting-for-menu-items)
5. [Visual Page Builder Integration](#5-visual-page-builder-integration)
6. [Advanced Usage Patterns](#6-advanced-usage-patterns)
7. [Full Viewport Preview Mode](#7-full-viewport-preview-mode)
8. [Best Practices and Examples](#8-best-practices-and-examples)

---

## 1. Enhanced Navigation Menu Overview

### 1.1 Key Features

The Enhanced Navigation Menu extends Radix UI's Navigation Menu with:

- **Nested Menu Support**: Unlimited depth menu hierarchies
- **Custom Script Integration**: Per-menu-item JavaScript execution
- **Visual Configuration**: Drag-and-drop menu builder in property panel
- **Multiple Script Types**: Navigation, workflow, and custom scripts
- **Rich Metadata**: Icons, badges, descriptions, and tags
- **State Management**: Open/close state tracking and programmatic control
- **Full Accessibility**: Built on Radix UI primitives

### 1.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced Navigation Menu                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Menu Config   │  │   Script System │  │  Event Handler  │  │
│  │                 │  │                 │  │                 │  │
│  │ • Items Tree    │  │ • Navigation    │  │ • Click Events  │  │
│  │ • Visual Props  │  │ • Workflow      │  │ • State Changes │  │
│  │ • Behavior      │  │ • Custom        │  │ • Script Exec   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Interface Implementation

### 2.1 Component Event Interface

The Enhanced Navigation Menu follows GoFlow's standard component interface:

```typescript
// Navigation Menu Event Interface
export const NavigationMenuEventInterface = {
  events: {
    onMenuItemClick: {
      description: "Fired when a menu item is clicked",
      payload: {
        type: "object",
        properties: {
          timestamp: { type: "number" },
          componentId: { type: "string" },
          menuItem: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              href: { type: "string" },
              script: { type: "string" },
              scriptType: { 
                type: "string", 
                enum: ["navigation", "workflow", "custom"] 
              }
            }
          },
          action: { type: "string", enum: ["click", "hover", "focus"] },
          path: { 
            type: "array", 
            items: { type: "string" },
            description: "Path to nested menu item"
          },
          modifierKeys: {
            type: "object",
            properties: {
              ctrl: { type: "boolean" },
              shift: { type: "boolean" },
              alt: { type: "boolean" }
            }
          }
        }
      }
    },
    onMenuStateChange: {
      description: "Fired when menu open/close state changes",
      payload: {
        type: "object",
        properties: {
          timestamp: { type: "number" },
          componentId: { type: "string" },
          openMenus: {
            type: "array",
            items: { type: "string" }
          },
          activeItem: { type: "string" }
        }
      }
    }
  },
  
  actions: {
    setMenuItems: {
      description: "Update the menu items configuration",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { /* MenuItem schema */ }
          }
        }
      }
    },
    openMenu: {
      description: "Programmatically open a specific menu",
      parameters: {
        type: "object",
        properties: {
          menuId: { type: "string" }
        }
      }
    },
    closeMenu: {
      description: "Programmatically close a specific menu",
      parameters: {
        type: "object",
        properties: {
          menuId: { type: "string" }
        }
      }
    }
  }
}
```

### 2.2 MenuItem Data Structure

```typescript
interface MenuItem {
  id: string              // Unique identifier
  label: string           // Display text
  href?: string          // Optional URL
  disabled?: boolean     // Disabled state
  icon?: string          // HTML/SVG icon
  badge?: string | number // Badge text or number
  script?: string        // Custom JavaScript
  scriptType?: 'navigation' | 'workflow' | 'custom'
  children?: MenuItem[]  // Nested menu items
  metadata?: {
    description?: string
    tags?: string[]
    [key: string]: any
  }
}
```

---

## 3. Menu Definition and Configuration

### 3.1 Using the Visual Menu Builder

#### Step 1: Add Navigation Menu to Page

1. **Drag Component**: From the component library, drag "Menu" onto your page
   - Open the left panel → "Components" tab
   - Expand the "Radix" section
   - Look for "Menu" component (formerly "Enhanced Navigation Menu")
   - Drag it to your desired location on the page canvas
2. **Select Component**: Click the menu component directly on the canvas to select it
3. **Open Properties**: Navigate to the right panel → "Properties" tab

> **Troubleshooting**: If you don't see "Menu" in the Radix section:
> 1. Refresh your browser to ensure component registration is loaded
> 2. Check that the component appears in the "Radix" accordion section (not "General")  
> 3. Look for the Menu icon with description "Advanced navigation with nested menus and custom scripts"
> 4. The component may need a few seconds to load after page initialization
>
> **Canvas Selection**: The Menu component now supports direct selection on the canvas! You no longer need to use the Page Structure tab as a workaround.

#### Step 2: Configure Global Settings

```
┌─ Navigation Menu Configuration ──────────────────────────┐
│ Orientation:  [Horizontal ▼]                            │
│ Trigger:      [Click ▼]                                 │
│                                                          │
│ ☑ Show Icons     ☐ Show Badges                          │
└──────────────────────────────────────────────────────────┘
```

**Orientation Options:**
- **Horizontal**: Menu items arranged left-to-right (default)
- **Vertical**: Menu items stacked vertically

**Trigger Options:**
- **Click**: Submenus open on click
- **Hover**: Submenus open on hover

#### Step 3: Build Menu Structure

Click "Add Item" to create your first menu item:

```
┌─ Menu Items ──────────────────────────────────────────────┐
│ [+ Add Item]                                              │
│                                                           │
│ ├─ [≡] ▶ Home                                    [✎][+][🗑] │
│ │   → /home                                               │
│ │                                                         │
│ ├─ [≡] ▼ Products                               [✎][+][🗑] │
│ │   │                                                     │
│ │   └─ [≡] ▶ Software                           [✎][+][🗑] │
│ │   │   → /products/software                              │
│ │   │                                                     │
│ │   └─ [≡] ▶ Services                           [✎][+][🗑] │
│ │       → /products/services                              │
│ │                                                         │
│ └─ [≡] ▶ Contact [Script] 📧                    [✎][+][🗑] │
│     → Custom Script                                       │
└───────────────────────────────────────────────────────────┘
```

**Icons:**
- **[≡]** - Drag handle for reordering
- **▶/▼** - Expand/collapse for nested items
- **[✎]** - Edit item properties
- **[+]** - Add child item
- **[🗑]** - Delete item

### 3.2 Menu Item Properties

When editing a menu item, you can configure:

```
┌─ Menu Item Editor ────────────────────────────────────────┐
│ Label:           [Product Catalog          ]              │
│ URL (optional):  [/products               ]              │
│ Icon (HTML/SVG): [<ShoppingCart />        ]              │
│ Badge:           [New                      ]              │
│ Script Type:     [Custom            ▼]                   │
│                                                           │
│ ☐ Disabled                                                │
│                                                           │
│ Custom Script:                           [Edit Script]    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ function handleProductMenu(eventPayload, context) {    │ │
│ │   // Custom logic here                                 │ │
│ │ }                                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                           │
│ Description:                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Navigate to our product catalog with                   │ │
│ │ filtering options                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

---

## 4. Custom Scripting for Menu Items

### 4.1 Script Types

#### Navigation Scripts
For simple URL navigation with optional parameters:

```javascript
// Navigation script template
function navigate(eventPayload, context) {
  // Navigate to the specified URL
  context.navigation.navigateTo('/products', {
    newTab: eventPayload.modifierKeys.ctrl
  })
  
  // Optional: Show notification
  context.ui.showNotification({
    type: 'info',
    message: 'Navigating to Products'
  })
}
```

#### Workflow Scripts
For creating workflow cases or executing workflow actions:

```javascript
// Workflow script template
function executeWorkflow(eventPayload, context) {
  // Create a new workflow case
  const workflowId = 'product-inquiry-workflow'
  const caseData = {
    initiatedBy: context.user.id,
    menuItem: eventPayload.menuItem.label,
    timestamp: eventPayload.timestamp,
    source: 'navigation-menu'
  }
  
  context.workflow.createCase(workflowId, caseData)
    .then(caseId => {
      context.ui.showNotification({
        type: 'success',
        message: `Product inquiry case ${caseId} created`
      })
      
      // Navigate to case details
      context.navigation.navigateTo(`/cases/${caseId}`)
    })
    .catch(error => {
      context.ui.showNotification({
        type: 'error',
        message: `Failed to create workflow case: ${error.message}`
      })
    })
}
```

#### Custom Scripts
For complex logic and integrations:

```javascript
// Custom script example: Dynamic submenu loading
function loadDynamicSubmenu(eventPayload, context) {
  // Show loading state
  context.component.setState({ 
    hoveredItem: eventPayload.menuItem.id,
    loading: true 
  })
  
  // Fetch dynamic menu items
  context.data.query('user-specific-menu-items', {
    userId: context.user.id,
    parentMenuId: eventPayload.menuItem.id
  })
  .then(data => {
    // Update menu configuration with dynamic items
    const currentConfig = context.component.getConfig()
    const updatedItems = currentConfig.items.map(item => {
      if (item.id === eventPayload.menuItem.id) {
        return {
          ...item,
          children: data.menuItems
        }
      }
      return item
    })
    
    context.component.setConfig({ 
      ...currentConfig, 
      items: updatedItems 
    })
  })
  .finally(() => {
    context.component.setState({ loading: false })
  })
}
```

### 4.2 Script Context API

The script context provides comprehensive APIs for menu interactions:

```javascript
// Available in all menu item scripts
const context = {
  // Component control
  component: {
    id: string,
    getConfig: () => NavigationMenuConfig,
    setConfig: (config: Partial<NavigationMenuConfig>) => void,
    getState: () => MenuState,
    setState: (state: Partial<MenuState>) => void,
    emit: (event: string, payload: any) => void
  },
  
  // Navigation utilities
  navigation: {
    navigateTo: (path: string, options?: { newTab?: boolean }) => void,
    goBack: () => void,
    goForward: () => void,
    getCurrentPath: () => string
  },
  
  // Workflow integration
  workflow: {
    createCase: (workflowId: string, data?: any) => Promise<string>,
    executeAction: (actionId: string, params?: any) => Promise<any>
  },
  
  // Data access
  data: {
    query: (queryId: string, params?: any) => Promise<any>,
    mutate: (mutation: any) => Promise<any>,
    subscribe: (callback: Function) => () => void
  },
  
  // UI interactions
  ui: {
    showNotification: (options: NotificationOptions) => void,
    openModal: (modalId: string, props?: any) => void,
    closeModal: (modalId: string) => void
  },
  
  // User context
  user: {
    id: string,
    name: string,
    email: string,
    roles: string[],
    permissions: string[]
  },
  
  // Utility functions
  utils: {
    formatDate: (date: Date) => string,
    validateSchema: (data: any, schema: any) => ValidationResult,
    log: (message: string, level?: LogLevel) => void
  }
}
```

---

## 5. Visual Page Builder Integration

### 5.1 Adding Navigation Menu to Pages

#### Drag and Drop Process

1. **Open Component Library**: In the left panel, switch to "Components" tab
2. **Find Menu Component**: 
   - Expand the "Radix" section in the component library
   - Look for "Menu" with the description "Advanced navigation with nested menus and custom scripts"
   - The component will be displayed with a Menu icon and clear labeling
3. **Drag to Canvas**: Drag the component to your desired location on the page
4. **Configure**: Select the component and use the property panel to configure

#### Component Registration

The Enhanced Navigation Menu is automatically registered in GoFlow's component system:

- **Component Type**: `NavigationMenu`
- **Display Name**: "Menu" 
- **Category**: "Radix" (appears in Radix section)
- **Description**: "Advanced navigation with nested menus and custom scripts"

When dragged onto the page, the component creates a `div` element with:
- `data-type="enhanced-navigation-menu"`
- `data-component-type="NavigationMenu"`
- Pre-configured menu structure with sample items
- Default styling for proper display
- **Full canvas interaction**: Can be selected, dragged, and configured directly on the visual editor

#### Initial Configuration

When first added, the navigation menu has a basic structure:

```javascript
// Default menu configuration
{
  items: [
    {
      id: 'home',
      label: 'Home',
      href: '/'
    },
    {
      id: 'about',
      label: 'About',
      href: '/about'
    }
  ],
  orientation: 'horizontal',
  showIcons: false,
  showBadges: false
}
```

### 5.2 Property Panel Integration

#### Menu Properties Tab
```
┌─ Enhanced Navigation Menu Properties ────────────────────┐
│                                                          │
│ ┌─ Basic ─────────────────────────────────────────────┐  │
│ │ Component ID: nav-menu-abc123                      │  │
│ │ Class Name:   [custom-nav-menu        ]           │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ Menu Configuration ────────────────────────────────┐  │
│ │ Menu Configuration              [Configure Menu]   │  │
│ │                                                    │  │
│ │ Orientation: [Horizontal ▼]                       │  │
│ │                                                    │  │
│ │ ☑ Show Icons     ☐ Show Badges                    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ Events ───────────────────────────────────────────┐  │
│ │ • onMenuItemClick                                  │  │
│ │ • onMenuStateChange                                │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ Actions ──────────────────────────────────────────┐  │
│ │ • setMenuItems                                     │  │
│ │ • openMenu                                         │  │
│ │ • closeMenu                                        │  │
│ │ • closeAllMenus                                    │  │
│ │ • setActiveItem                                    │  │
│ └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

The properties panel provides quick access to:
- **Basic Settings**: Component ID and CSS classes
- **Menu Configuration**: Button to open the full menu definition panel
- **Orientation**: Switch between horizontal and vertical layouts
- **Display Options**: Toggle icons and badges visibility
- **Component Events**: Available for script binding
- **Component Actions**: Programmatic control methods

#### Event Handling Configuration

Set up page-level event handlers for navigation menu events:

```javascript
// Page-level menu item click handler
function handleNavigationMenuClick(eventPayload, context) {
  // Log navigation event
  context.utils.log(`Menu item clicked: ${eventPayload.menuItem.label}`)
  
  // Update page state
  const action = context.createAction('NAVIGATION_MENU_CLICK', {
    menuItemId: eventPayload.menuItem.id,
    menuItemLabel: eventPayload.menuItem.label,
    timestamp: eventPayload.timestamp
  })
  
  context.dispatch(action)
  
  // Track analytics
  context.analytics.track('menu_item_clicked', {
    item_id: eventPayload.menuItem.id,
    item_label: eventPayload.menuItem.label,
    user_id: context.user.id
  })
}
```

---

## 6. Advanced Usage Patterns

### 6.1 Dynamic Menu Generation

Create menus that adapt based on user permissions or data:

```javascript
// Dynamic menu generation based on user role
function generateUserMenu(eventPayload, context) {
  const userRole = context.user.roles[0]
  let menuItems = []
  
  // Base menu items for all users
  menuItems.push({
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: '<DashboardIcon />'
  })
  
  // Admin-specific menu items
  if (userRole === 'admin') {
    menuItems.push({
      id: 'admin',
      label: 'Administration',
      children: [
        {
          id: 'users',
          label: 'User Management',
          href: '/admin/users',
          script: 'loadUserManagement',
          scriptType: 'custom'
        },
        {
          id: 'settings',
          label: 'System Settings',
          href: '/admin/settings'
        }
      ]
    })
  }
  
  // Manager-specific menu items
  if (userRole === 'manager' || userRole === 'admin') {
    menuItems.push({
      id: 'reports',
      label: 'Reports',
      children: [
        {
          id: 'sales',
          label: 'Sales Reports',
          script: 'generateSalesReport',
          scriptType: 'workflow'
        },
        {
          id: 'performance',
          label: 'Performance Metrics',
          script: 'showPerformanceMetrics',
          scriptType: 'custom'
        }
      ]
    })
  }
  
  // Update the navigation menu
  context.component.setMenuItems({ items: menuItems })
}
```

### 6.2 Context-Aware Menu Behavior

Modify menu behavior based on current page or application state:

```javascript
// Context-aware menu highlighting
function updateMenuForCurrentPage(eventPayload, context) {
  const currentPath = context.navigation.getCurrentPath()
  const config = context.component.getConfig()
  
  // Find and activate current menu item
  function findAndActivateItem(items, path) {
    return items.map(item => {
      if (item.href === path) {
        context.component.setActiveItem({ itemId: item.id })
        return { ...item, active: true }
      }
      
      if (item.children) {
        return {
          ...item,
          children: findAndActivateItem(item.children, path)
        }
      }
      
      return { ...item, active: false }
    })
  }
  
  const updatedItems = findAndActivateItem(config.items, currentPath)
  context.component.setConfig({ ...config, items: updatedItems })
}
```

### 6.3 Integration with Workflow Engine

Connect menu actions to GoFlow's workflow engine:

```javascript
// Workflow integration example
function initiateWorkflowFromMenu(eventPayload, context) {
  const menuItem = eventPayload.menuItem
  
  // Different workflow actions based on menu item
  switch (menuItem.id) {
    case 'create-case':
      context.workflow.createCase('case-management-workflow', {
        type: 'new-case',
        initiatedBy: context.user.id,
        priority: 'normal'
      })
      .then(caseId => {
        context.ui.showNotification({
          type: 'success',
          message: `Case ${caseId} created successfully`
        })
        context.navigation.navigateTo(`/cases/${caseId}`)
      })
      break
      
    case 'approval-request':
      context.workflow.executeAction('request-approval', {
        requestType: 'document-approval',
        requestedBy: context.user.id,
        documents: context.page.state.selectedDocuments
      })
      .then(approvalId => {
        context.ui.showNotification({
          type: 'info',
          message: 'Approval request submitted'
        })
      })
      break
      
    case 'report-issue':
      // Open issue reporting modal
      context.ui.openModal('issue-report-modal', {
        userId: context.user.id,
        currentPage: context.navigation.getCurrentPath()
      })
      break
  }
}
```

---

## 7. Full Viewport Preview Mode

### 7.1 Preview Mode Behavior

When switching to preview mode in the page builder:

1. **Header Bar Hidden**: The GoFlow header bar is completely hidden
2. **Full Viewport**: The page takes the full browser viewport
3. **Navigation Menu**: Functions exactly as it would in production
4. **Script Execution**: All menu scripts execute normally
5. **State Management**: Page state is preserved and functional

### 7.2 Implementing Preview Mode

The Builder component automatically handles preview mode:

```typescript
// Builder component preview mode handling
{!isPreviewMode && (
  <Menubar className="border-b rounded-none shadow-none px-2">
    {/* Header bar content only shown in edit mode */}
  </Menubar>
)}

<div className="flex-1 flex overflow-hidden relative">
  {/* Main workspace - full viewport in preview mode */}
  <div className={cn(
    "flex-1 flex bg-muted/30 relative overflow-hidden",
    isPreviewMode && "h-screen" // Full height in preview
  )}>
    {/* Page content */}
  </div>
</div>
```

### 7.3 Preview Mode Testing

Use preview mode to test:

- **Navigation Menu Functionality**: Click through all menu items
- **Script Execution**: Verify custom scripts work as expected
- **Responsive Behavior**: Test on different screen sizes
- **Performance**: Check loading times and interaction responsiveness
- **Accessibility**: Verify keyboard navigation and screen reader support

---

## 8. Best Practices and Examples

### 8.1 Menu Structure Best Practices

#### Logical Hierarchy
```
✅ Good Structure:
├─ Home
├─ Products
│  ├─ Software
│  └─ Hardware
├─ Services
│  ├─ Consulting
│  └─ Support
└─ Contact

❌ Avoid Deep Nesting:
├─ Main
│  └─ Category
│     └─ Subcategory
│        └─ Sub-subcategory (too deep!)
```

#### Descriptive Labels
```javascript
// ✅ Good labels
{
  id: 'user-profile',
  label: 'My Profile',
  description: 'View and edit your profile settings'
}

// ❌ Avoid cryptic labels  
{
  id: 'up',
  label: 'UP'  // What does this mean?
}
```

### 8.2 Script Performance Best Practices

#### Efficient Script Execution
```javascript
// ✅ Good: Fast execution, error handling
function efficientMenuScript(eventPayload, context) {
  try {
    // Quick validation
    if (!eventPayload.menuItem) return
    
    // Async operations with proper error handling
    context.data.query('quick-data')
      .then(result => {
        context.ui.showNotification({
          type: 'success',
          message: 'Action completed'
        })
      })
      .catch(error => {
        context.utils.log(`Menu script error: ${error.message}`, 'error')
      })
  } catch (error) {
    context.utils.log(`Script execution failed: ${error.message}`, 'error')
  }
}

// ❌ Avoid: Blocking operations, no error handling
function inefficientMenuScript(eventPayload, context) {
  // Synchronous blocking call - bad!
  let result = context.data.syncQuery('heavy-operation')
  
  // No error handling - bad!
  context.navigation.navigateTo(result.url)
}
```

### 8.3 Accessibility Considerations

#### Keyboard Navigation
```javascript
// Ensure keyboard accessibility
function handleKeyboardNavigation(eventPayload, context) {
  // Support keyboard navigation
  if (eventPayload.keyboardEvent) {
    switch (eventPayload.keyboardEvent.key) {
      case 'Enter':
      case ' ': // Spacebar
        // Execute primary action
        executeMenuAction(eventPayload, context)
        break
      case 'ArrowDown':
        // Navigate to next item
        navigateToNext(context)
        break
      case 'ArrowUp':
        // Navigate to previous item
        navigateToPrevious(context)
        break
      case 'Escape':
        // Close menu
        context.component.closeAllMenus()
        break
    }
  }
}
```

#### Screen Reader Support
```javascript
// Provide descriptive labels and ARIA attributes
{
  id: 'product-catalog',
  label: 'Product Catalog',
  metadata: {
    description: 'Browse our complete product catalog with search and filtering options',
    ariaLabel: 'Product catalog navigation',
    ariaDescribedBy: 'catalog-help-text'
  }
}
```

### 8.4 Common Usage Examples

#### E-commerce Navigation
```javascript
// E-commerce menu structure
const ecommerceMenu = {
  items: [
    {
      id: 'shop',
      label: 'Shop',
      children: [
        {
          id: 'categories',
          label: 'Categories',
          script: 'loadProductCategories',
          scriptType: 'custom'
        },
        {
          id: 'deals',
          label: 'Deals',
          href: '/deals',
          badge: 'Hot',
          icon: '<FireIcon />'
        },
        {
          id: 'new-arrivals',
          label: 'New Arrivals',
          href: '/new-arrivals',
          badge: 'New'
        }
      ]
    },
    {
      id: 'account',
      label: 'My Account',
      script: 'checkLoginStatus',
      scriptType: 'custom',
      children: [
        {
          id: 'profile',
          label: 'Profile',
          href: '/account/profile'
        },
        {
          id: 'orders',
          label: 'Order History',
          href: '/account/orders'
        },
        {
          id: 'wishlist',
          label: 'Wishlist',
          href: '/account/wishlist',
          badge: '3'
        }
      ]
    }
  ],
  showIcons: true,
  showBadges: true
}
```

#### Admin Dashboard Navigation
```javascript
// Admin dashboard menu
const adminMenu = {
  items: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/admin',
      icon: '<DashboardIcon />'
    },
    {
      id: 'content',
      label: 'Content Management',
      children: [
        {
          id: 'pages',
          label: 'Pages',
          href: '/admin/pages',
          script: 'loadPageList',
          scriptType: 'custom'
        },
        {
          id: 'media',
          label: 'Media Library',
          href: '/admin/media'
        }
      ]
    },
    {
      id: 'users',
      label: 'User Management',
      children: [
        {
          id: 'all-users',
          label: 'All Users',
          href: '/admin/users',
          badge: '1,234'
        },
        {
          id: 'roles',
          label: 'Roles & Permissions',
          href: '/admin/roles'
        },
        {
          id: 'pending',
          label: 'Pending Approvals',
          href: '/admin/pending',
          badge: '5',
          script: 'checkPendingApprovals',
          scriptType: 'custom'
        }
      ]
    },
    {
      id: 'settings',
      label: 'System Settings',
      href: '/admin/settings',
      script: 'checkSystemHealth',
      scriptType: 'workflow'
    }
  ],
  orientation: 'vertical',
  showIcons: true,
  showBadges: true
}
```

---

## Conclusion

The Enhanced Navigation Menu provides a powerful, flexible solution for creating interactive navigation experiences in GoFlow applications. By combining:

- **Visual Configuration**: Intuitive drag-and-drop menu building
- **Custom Scripting**: Flexible JavaScript execution for complex interactions  
- **Component Interface**: Standard event and action patterns
- **Full Integration**: Seamless integration with workflows, data, and UI systems

You can create sophisticated navigation solutions that adapt to your users' needs while maintaining consistency with GoFlow's component architecture.

### Next Steps

1. **Practice**: Create a navigation menu for your application using the visual builder
2. **Experiment**: Try different script types and see how they behave
3. **Integrate**: Connect menu items to your existing workflows and data sources
4. **Optimize**: Use the preview mode to test and refine your navigation
5. **Share**: Document your menu patterns for reuse across projects

### Resources

- [Component Interface Standard](./PageBuilderTutorial.md)
- [Workflow Integration Guide](./LLMPlan.md)
- [GoFlow API Reference](./CORE_APIs.md)
- [Best Practices Guide](./Plan.md)
