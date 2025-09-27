import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface PageItem {
  id: string
  name: string
  type: 'folder' | 'page'
  parentId?: string
  elements: Record<string, any> // Page elements for the builder
  createdAt: string
  updatedAt: string
  isExpanded?: boolean // For folders in the tree
}

interface PagesState {
  pages: PageItem[]
  activePageId: string | null
  selectedItemId: string | null

  // Actions
  addPage: (name: string, parentId?: string) => string
  addFolder: (name: string, parentId?: string) => string
  deletePage: (id: string) => void
  deleteFolder: (id: string) => void
  renamePage: (id: string, name: string) => void
  renameFolder: (id: string, name: string) => void
  movePage: (id: string, newParentId?: string) => void
  setActivePage: (id: string | null) => void
  setSelectedItem: (id: string | null) => void
  toggleFolder: (id: string) => void
  updatePageElements: (id: string, elements: Record<string, any>) => void
  getPageTree: () => PageItem[]
  findPageById: (id: string) => PageItem | undefined
  getHomePage: () => PageItem | undefined
}

const generateId = () => `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export const usePagesStore = create<PagesState>()(
  persist(
    (set, get) => ({
      pages: [
        // Default Home page
        {
          id: 'home',
          name: 'Home',
          type: 'page',
          elements: {
            "page-root": {
              id: "page-root",
              tagName: "div",
              attributes: { className: "page-container" },
              styles: {
                minHeight: "100vh",
                padding: "20px",
                backgroundColor: "#ffffff",
                fontFamily: "system-ui, sans-serif",
              },
              childIds: ["welcome-text"],
              content: undefined,
            },
            "welcome-text": {
              id: "welcome-text",
              tagName: "h1",
              attributes: {},
              styles: {
                fontSize: "2rem",
                fontWeight: "bold",
                color: "#1f2937",
                textAlign: "center",
                marginBottom: "1rem",
              },
              childIds: [],
              parentId: "page-root",
              content: "Welcome to Your Home Page",
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      activePageId: 'home',
      selectedItemId: null,

      addPage: (name: string, parentId?: string) => {
        const id = generateId()
        const newPage: PageItem = {
          id,
          name,
          type: 'page',
          parentId,
          elements: {
            "page-root": {
              id: "page-root",
              tagName: "div",
              attributes: { className: "page-container" },
              styles: {
                minHeight: "100vh",
                padding: "20px",
                backgroundColor: "#ffffff",
                fontFamily: "system-ui, sans-serif",
              },
              childIds: [],
              content: undefined,
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set((state) => ({
          pages: [...state.pages, newPage],
        }))

        return id
      },

      addFolder: (name: string, parentId?: string) => {
        const id = generateId()
        const newFolder: PageItem = {
          id,
          name,
          type: 'folder',
          parentId,
          elements: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isExpanded: false,
        }

        set((state) => ({
          pages: [...state.pages, newFolder],
        }))

        return id
      },

      deletePage: (id: string) => {
        set((state) => {
          const updatedPages = state.pages.filter((page) => page.id !== id)
          const newActivePageId = state.activePageId === id ? null : state.activePageId
          const newSelectedItemId = state.selectedItemId === id ? null : state.selectedItemId
          
          return {
            pages: updatedPages,
            activePageId: newActivePageId,
            selectedItemId: newSelectedItemId,
          }
        })
      },

      deleteFolder: (id: string) => {
        set((state) => {
          // Also delete all children in the folder
          const getChildIds = (parentId: string): string[] => {
            const children = state.pages.filter(p => p.parentId === parentId)
            return children.reduce((acc, child) => {
              acc.push(child.id)
              if (child.type === 'folder') {
                acc.push(...getChildIds(child.id))
              }
              return acc
            }, [] as string[])
          }

          const toDelete = [id, ...getChildIds(id)]
          const updatedPages = state.pages.filter((page) => !toDelete.includes(page.id))
          
          const newActivePageId = toDelete.includes(state.activePageId || '') ? null : state.activePageId
          const newSelectedItemId = toDelete.includes(state.selectedItemId || '') ? null : state.selectedItemId
          
          return {
            pages: updatedPages,
            activePageId: newActivePageId,
            selectedItemId: newSelectedItemId,
          }
        })
      },

      renamePage: (id: string, name: string) => {
        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === id
              ? { ...page, name, updatedAt: new Date().toISOString() }
              : page
          ),
        }))
      },

      renameFolder: (id: string, name: string) => {
        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === id
              ? { ...page, name, updatedAt: new Date().toISOString() }
              : page
          ),
        }))
      },

      movePage: (id: string, newParentId?: string) => {
        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === id
              ? { ...page, parentId: newParentId, updatedAt: new Date().toISOString() }
              : page
          ),
        }))
      },

      setActivePage: (id: string | null) => {
        set({ activePageId: id })
      },

      setSelectedItem: (id: string | null) => {
        set({ selectedItemId: id })
      },

      toggleFolder: (id: string) => {
        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === id && page.type === 'folder'
              ? { ...page, isExpanded: !page.isExpanded }
              : page
          ),
        }))
      },

      updatePageElements: (id: string, elements: Record<string, any>) => {
        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === id
              ? { ...page, elements, updatedAt: new Date().toISOString() }
              : page
          ),
        }))
      },

      getPageTree: () => {
        const { pages } = get()
        
        // Build tree structure
        const buildTree = (parentId?: string): PageItem[] => {
          return pages
            .filter((page) => page.parentId === parentId)
            .sort((a, b) => {
              // Folders first, then pages, then alphabetical
              if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1
              }
              return a.name.localeCompare(b.name)
            })
            .map((page) => ({
              ...page,
              children: page.type === 'folder' ? buildTree(page.id) : undefined,
            }))
        }

        return buildTree()
      },

      findPageById: (id: string) => {
        return get().pages.find((page) => page.id === id)
      },

      getHomePage: () => {
        const { pages } = get()
        return pages.find((page) => page.type === 'page' && page.name.toLowerCase() === 'home')
      },
    }),
    {
      name: "pages-storage",
      version: 1,
    }
  )
)