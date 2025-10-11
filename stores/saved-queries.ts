import { create } from 'zustand'
import { useQueryStore } from './query'
import { createQueryDefinition, updateQueryDefinition, deleteQueryDefinition, listQueryDefinitions, type QueryDefinition } from '@/lib/datastore-client'
import { DEFAULT_SETTINGS } from '@/components/petri/system-settings-context'

export interface SavedQuery {
  id?: string
  name: string // Primary key - query name must be unique
  type: 'mongo' | 'sql' | 's3'
  datasourceId: string
  content: string // JSON for mongo pipeline, SQL for others, S3 prefix/path for S3
  collection?: string
  table?: string
  s3Prefix?: string
  createdAt: string
  updatedAt: string
}

interface SavedQueriesState {
  queries: SavedQuery[]
  loading: boolean
  error?: string
  hydrated: boolean
  
  // Actions
  loadQueries(flowServiceUrl?: string): Promise<void>
  saveQuery(query: Omit<SavedQuery, 'createdAt' | 'updatedAt'>, flowServiceUrl?: string): Promise<void>
  updateQuery(name: string, updates: Partial<SavedQuery>, flowServiceUrl?: string): Promise<void>
  deleteQuery(name: string, flowServiceUrl?: string): Promise<void>
  openQuery(query: SavedQuery): void
  hydrate(): void
  syncWithServer(flowServiceUrl?: string): Promise<void>
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
        let queries: SavedQuery[] = []
        
        if (saved) {
          queries = JSON.parse(saved)
          queries = Array.isArray(queries) ? queries : []
        }
        
        // Add default Mock Query if it doesn't exist
        const hasMockQuery = queries.some(q => q.name === 'Mock Query')
        if (!hasMockQuery) {
          const defaultMockQuery: SavedQuery = {
            id: 'mock_query',
            name: 'Mock Query',
            type: 'mongo',
            datasourceId: 'ds_mock_mongo',
            content: '[\n  { "$match": {} },\n  { "$limit": 50 }\n]',
            collection: 'users',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          queries.unshift(defaultMockQuery)
          
          // Persist the updated queries including the default
          localStorage.setItem('goflow.savedQueries', JSON.stringify(queries))
        }
        
        set({ queries, hydrated: true })
      } catch (error) {
        console.warn('Failed to hydrate saved queries:', error)
        set({ queries: [], hydrated: true, error: 'Failed to load saved queries' })
      }
    },

    async loadQueries(flowServiceUrl?: string) {
      set({ loading: true, error: undefined })
      
      try {
        const serviceUrl = flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
        const result = await listQueryDefinitions(serviceUrl, { limit: 100 })
        
        // Transform QueryDefinition[] to SavedQuery[]
        const queries: SavedQuery[] = result.queries.map((qd: QueryDefinition) => {
          const normalizedType = qd.query_type === 'folder' ? 's3' : qd.query_type as 'mongo' | 'sql' | 's3'
          const pipeline = qd.parameters?.pipeline
          const normalizedContent = qd.query 
            ?? (pipeline ? JSON.stringify(pipeline, null, 2) : JSON.stringify(qd.parameters ?? {}))
            ?? '/'

          return {
            id: qd.id,
            name: qd.name,
            type: normalizedType,
            datasourceId: qd.data_source_id,
            content: normalizedContent,
            collection: qd.parameters?.collection,
            table: qd.parameters?.table,
            s3Prefix: qd.parameters?.folder_path,
            createdAt: qd.createdAt || new Date().toISOString(),
            updatedAt: qd.updatedAt || new Date().toISOString()
          }
        })
        
        set({ queries, loading: false })
        persistQueries()
      } catch (error: any) {
        console.warn('Failed to load queries from server, falling back to localStorage:', error)
        
        // Fallback to localStorage
        if (typeof window !== 'undefined') {
          try {
            const saved = localStorage.getItem('goflow.savedQueries')
            if (saved) {
              const queries = JSON.parse(saved)
              set({ queries: Array.isArray(queries) ? queries : [], loading: false })
            } else {
              set({ queries: [], loading: false })
            }
          } catch (localError) {
            console.warn('Failed to load from localStorage:', localError)
            set({ queries: [], loading: false, error: 'Failed to load saved queries' })
          }
        } else {
          set({ loading: false, error: error.message || 'Failed to load queries' })
        }
      }
    },

  }

  return {
    ...initialState,
    async saveQuery(queryData, flowServiceUrl?: string) {
      set({ loading: true, error: undefined })
      
      try {
        const serviceUrl = flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
        
        // Transform SavedQuery to QueryDefinition format
        const queryDefinition: Partial<QueryDefinition> = {
          name: queryData.name,
          data_source_id: queryData.datasourceId,
          query_type: queryData.type === 's3' ? 'folder' : (queryData.type as any),
          query: queryData.type === 'sql' ? queryData.content : undefined,
          parameters: {
            ...(queryData.type === 'mongo' ? { pipeline: JSON.parse(queryData.content) } : {}),
            ...(queryData.type === 's3' ? { folder_path: queryData.content } : {}),
            ...(queryData.collection ? { collection: queryData.collection } : {}),
            ...(queryData.table ? { table: queryData.table } : {})
          },
          enabled: true
        }
        
  const created = await createQueryDefinition(serviceUrl, queryDefinition)
  const normalizedType = created.query_type === 'folder' ? 's3' : created.query_type as 'mongo' | 'sql' | 's3'

        const newQuery: SavedQuery = {
          id: created.id,
          name: created.name,
          type: normalizedType,
          datasourceId: created.data_source_id,
          content: queryData.content,
          collection: created.parameters?.collection ?? queryData.collection,
          table: created.parameters?.table ?? queryData.table,
          s3Prefix: created.parameters?.folder_path ?? queryData.s3Prefix,
          createdAt: created.createdAt || new Date().toISOString(),
          updatedAt: created.updatedAt || new Date().toISOString()
        }

        set(state => ({
          queries: [newQuery, ...state.queries.filter(q => q.name !== queryData.name)],
          loading: false
        }))
        
        persistQueries()
      } catch (error: any) {
        console.error('Failed to save query to server:', error)
        
        // Fallback to localStorage only
        const newQuery: SavedQuery = {
          ...queryData,
          id: queryData.id || `local_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        set(state => ({
          queries: [newQuery, ...state.queries.filter(q => q.name !== queryData.name)],
          loading: false,
          error: 'Query saved locally only (server sync failed)'
        }))
        
        persistQueries()
      }
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

    async syncWithServer(flowServiceUrl?: string) {
      // Load fresh data from server
      await get().loadQueries(flowServiceUrl)
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
      } else if (query.type === 's3') {
        queryState.setS3Input(query.content)
        if (query.s3Prefix) {
          queryState.setS3Prefix(query.s3Prefix)
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