import { create } from 'zustand'
import { useQueryStore } from './query'

export interface SavedQuery {
  name: string // Primary key - query name must be unique
  type: 'mongo' | 'sql'
  datasourceId: string
  content: string // JSON for mongo pipeline, SQL for others
  collection?: string
  table?: string
  createdAt: string
  updatedAt: string
}

interface SavedQueriesState {
  queries: SavedQuery[]
  loading: boolean
  error?: string
  hydrated: boolean
  
  // Actions
  loadQueries(): Promise<void>
  saveQuery(query: Omit<SavedQuery, 'createdAt' | 'updatedAt'>): Promise<void>
  updateQuery(name: string, updates: Partial<SavedQuery>): Promise<void>
  deleteQuery(name: string): Promise<void>
  openQuery(query: SavedQuery): void
  hydrate(): void
}

export const useSavedQueriesStore = create<SavedQueriesState>((set, get) => {
  const persistQueries = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('goflow.savedQueries', JSON.stringify(get().queries))
      } catch (error) {
        console.warn('Failed to persist queries:', error)
      }
    }
  }

  // Initialize with default state, hydration will happen after mount
  const initialState = {
    queries: [] as SavedQuery[],
    loading: false,
    error: undefined,
    hydrated: false,

    hydrate() {
      if (typeof window === 'undefined') return
      
      try {
        const saved = localStorage.getItem('goflow.savedQueries')
        if (saved) {
          const queries = JSON.parse(saved)
          set({ queries: Array.isArray(queries) ? queries : [], hydrated: true })
        } else {
          set({ hydrated: true })
        }
      } catch (error) {
        console.warn('Failed to hydrate saved queries:', error)
        set({ queries: [], hydrated: true, error: 'Failed to load saved queries' })
      }
    },

    async loadQueries() {
      // Load from localStorage on demand
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('goflow.savedQueries')
          if (saved) {
            const queries = JSON.parse(saved)
            set({ queries: Array.isArray(queries) ? queries : [] })
          }
        } catch (error) {
          console.warn('Failed to load saved queries:', error)
          set({ queries: [] })
        }
      }
    },

  }

  return {
    ...initialState,
    async saveQuery(queryData) {
      const newQuery: SavedQuery = {
        ...queryData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      set(state => ({
        queries: [newQuery, ...state.queries.filter(q => q.name !== queryData.name)]
      }))
      
      persistQueries()
    },

    async updateQuery(name, updates) {
      set(state => ({
        queries: state.queries.map(q => 
          q.name === name 
            ? { ...q, ...updates, updatedAt: new Date().toISOString() }
            : q
        )
      }))
      
      persistQueries()
    },

    async deleteQuery(name) {
      set(state => ({
        queries: state.queries.filter(q => q.name !== name)
      }))
      
      persistQueries()
    },

    openQuery(query) {
      // Use direct store import for reliable communication
      const queryState = useQueryStore.getState()
      
      queryState.setDatasource(query.datasourceId)
      if (query.type === 'mongo') {
        queryState.setMongoInput(query.content)
        if (query.collection) {
          queryState.setCollection(query.collection)
        }
      } else {
        queryState.setSqlInput(query.content)
        if (query.table) {
          queryState.setTable(query.table)
        }
      }
    }
  }
})