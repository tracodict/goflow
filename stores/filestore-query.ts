import { create } from 'zustand'
import { 
  QueryDefinition, 
  QueryResult,
  listQueryDefinitions,
  createQueryDefinition,
  updateQueryDefinition,
  deleteQueryDefinition,
  executeQuery
} from '@/lib/filestore-client'

interface QueryState {
  queries: QueryDefinition[] // Always an array, never null
  loading: boolean
  error?: string
  executingIds: Set<string>
  executionResults: Record<string, {
    result: QueryResult
    timestamp: string
  }>
  
  // Actions
  fetchQueries: (flowServiceUrl: string, dataSourceId?: string) => Promise<void>
  createQuery: (flowServiceUrl: string, payload: Partial<QueryDefinition>) => Promise<QueryDefinition>
  updateQuery: (flowServiceUrl: string, id: string, payload: Partial<QueryDefinition>) => Promise<QueryDefinition>
  deleteQuery: (flowServiceUrl: string, id: string) => Promise<void>
  executeQuery: (flowServiceUrl: string, id: string, params?: Record<string, any>) => Promise<QueryResult>
  
  // Getters
  getQueryById: (id: string) => QueryDefinition | undefined
  getQueriesByDataSource: (dataSourceId: string) => QueryDefinition[]
  getQueriesByType: (queryType: QueryDefinition['query_type']) => QueryDefinition[]
  getLastExecutionResult: (queryId: string) => QueryResult | undefined
}

export const useQueryStore = create<QueryState>((set, get) => ({
  queries: [],
  loading: false,
  error: undefined,
  executingIds: new Set(),
  executionResults: {},
  
  fetchQueries: async (flowServiceUrl: string, dataSourceId?: string) => {
    set({ loading: true, error: undefined })
    try {
      const response = await listQueryDefinitions(
        flowServiceUrl,
        dataSourceId ? { data_source_id: dataSourceId } : undefined
      )
      set({ queries: response.queries || [], loading: false })
    } catch (error: any) {
      set({ 
        error: error?.message || 'Failed to fetch queries', 
        loading: false 
      })
    }
  },
  
  createQuery: async (flowServiceUrl: string, payload: Partial<QueryDefinition>) => {
    try {
      const newQuery = await createQueryDefinition(flowServiceUrl, payload)
      set(state => ({
        queries: [...state.queries, newQuery]
      }))
      return newQuery
    } catch (error: any) {
      set({ error: error?.message || 'Failed to create query' })
      throw error
    }
  },
  
  updateQuery: async (flowServiceUrl: string, id: string, payload: Partial<QueryDefinition>) => {
    try {
      const updatedQuery = await updateQueryDefinition(flowServiceUrl, id, payload)
      set(state => ({
        queries: state.queries.map(q => 
          q.id === id ? updatedQuery : q
        )
      }))
      return updatedQuery
    } catch (error: any) {
      set({ error: error?.message || 'Failed to update query' })
      throw error
    }
  },
  
  deleteQuery: async (flowServiceUrl: string, id: string) => {
    try {
      await deleteQueryDefinition(flowServiceUrl, id)
      set(state => {
        const { [id]: deletedResult, ...remainingResults } = state.executionResults
        return {
          queries: state.queries.filter(q => q.id !== id),
          executionResults: remainingResults
        }
      })
    } catch (error: any) {
      set({ error: error?.message || 'Failed to delete query' })
      throw error
    }
  },
  
  executeQuery: async (flowServiceUrl: string, id: string, params?: Record<string, any>) => {
    set(state => ({
      executingIds: new Set(state.executingIds).add(id)
    }))
    
    try {
      const result = await executeQuery(flowServiceUrl, id, params)
      
      // Update query execution stats
      set(state => ({
        queries: state.queries.map(q => 
          q.id === id ? {
            ...q,
            last_executed_at: new Date().toISOString(),
            execution_count: ((q as any).execution_count || 0) + 1
          } : q
        ),
        executionResults: {
          ...state.executionResults,
          [id]: {
            result,
            timestamp: new Date().toISOString()
          }
        },
        executingIds: new Set([...state.executingIds].filter(execId => execId !== id))
      }))
      
      return result
    } catch (error: any) {
      set(state => ({
        executingIds: new Set([...state.executingIds].filter(execId => execId !== id)),
        error: error?.message || 'Query execution failed'
      }))
      throw error
    }
  },
  
  getQueryById: (id: string) => {
    return get().queries.find(q => q.id === id)
  },
  
  getQueriesByDataSource: (dataSourceId: string) => {
    return get().queries.filter(q => q.data_source_id === dataSourceId)
  },
  
  getQueriesByType: (queryType: QueryDefinition['query_type']) => {
    return get().queries.filter(q => q.query_type === queryType)
  },
  
  getLastExecutionResult: (queryId: string) => {
    return get().executionResults[queryId]?.result
  }
}))