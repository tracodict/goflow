import { create } from 'zustand'
import { 
  DataSource, 
  DataSourceTestRequest,
  listDataSources,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSource
} from '@/lib/filestore-client'

interface DataSourceState {
  dataSources: DataSource[] // Always an array, never null
  loading: boolean
  error?: string
  testingIds: Set<string>
  
  // Actions
  fetchDataSources: (flowServiceUrl: string) => Promise<void>
  createDataSource: (flowServiceUrl: string, payload: Partial<DataSource>) => Promise<DataSource>
  updateDataSource: (flowServiceUrl: string, id: string, payload: Partial<DataSource>) => Promise<DataSource>
  deleteDataSource: (flowServiceUrl: string, id: string) => Promise<void>
  testDataSource: (flowServiceUrl: string, id: string, testRequest?: DataSourceTestRequest) => Promise<void>
  
  // Getters
  getDataSourceById: (id: string) => DataSource | undefined
  getDataSourcesByType: (type: DataSource['type']) => DataSource[]
}

export const useDataSourceStore = create<DataSourceState>((set, get) => ({
  dataSources: [],
  loading: false,
  testingIds: new Set(),
  
  fetchDataSources: async (flowServiceUrl: string) => {
    set({ loading: true, error: undefined })
    try {
      const response = await listDataSources(flowServiceUrl)
      set({ dataSources: response.data_sources || [], loading: false })
      
      // Broadcast to old datasource store for compatibility
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('goflow-filestore-datasources-updated', {
          detail: { dataSources: response.data_sources }
        }))
      }
    } catch (error: any) {
      set({ 
        error: error?.message || 'Failed to fetch data sources', 
        loading: false 
      })
    }
  },
  
  createDataSource: async (flowServiceUrl: string, payload: Partial<DataSource>) => {
    try {
      const newDataSource = await createDataSource(flowServiceUrl, payload)
      set(state => {
        const newDataSources = [...state.dataSources, newDataSource]
        
        // Broadcast update for compatibility
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('goflow-filestore-datasources-updated', {
            detail: { dataSources: newDataSources }
          }))
        }
        
        return { dataSources: newDataSources }
      })
      return newDataSource
    } catch (error: any) {
      set({ error: error?.message || 'Failed to create data source' })
      throw error
    }
  },
  
  updateDataSource: async (flowServiceUrl: string, id: string, payload: Partial<DataSource>) => {
    try {
      const updatedDataSource = await updateDataSource(flowServiceUrl, id, payload)
      set(state => ({
        dataSources: state.dataSources.map(ds => 
          ds.id === id ? updatedDataSource : ds
        )
      }))
      return updatedDataSource
    } catch (error: any) {
      set({ error: error?.message || 'Failed to update data source' })
      throw error
    }
  },
  
  deleteDataSource: async (flowServiceUrl: string, id: string) => {
    try {
      await deleteDataSource(flowServiceUrl, id)
      set(state => ({
        dataSources: state.dataSources.filter(ds => ds.id !== id)
      }))
    } catch (error: any) {
      set({ error: error?.message || 'Failed to delete data source' })
      throw error
    }
  },
  
  testDataSource: async (flowServiceUrl: string, id: string, testRequest?: DataSourceTestRequest) => {
    set(state => ({
      testingIds: new Set(state.testingIds).add(id)
    }))
    
    try {
      const testResult = await testDataSource(flowServiceUrl, id, testRequest)
      
      // Update the data source with test results (matching filestore.sh pattern)
      set(state => ({
        dataSources: state.dataSources.map(ds => 
          ds.id === id ? {
            ...ds,
            test_status: testResult.ok ? 'healthy' : 'error',
            test_latency_ms: testResult.latencyMs,
            test_error: testResult.error,
            last_tested_at: new Date().toISOString()
          } : ds
        ),
        testingIds: new Set([...state.testingIds].filter(testId => testId !== id))
      }))
    } catch (error: any) {
      // Update the data source with error status
      set(state => ({
        dataSources: state.dataSources.map(ds => 
          ds.id === id ? {
            ...ds,
            test_status: 'error',
            test_error: error?.message || 'Test failed',
            last_tested_at: new Date().toISOString()
          } : ds
        ),
        testingIds: new Set([...state.testingIds].filter(testId => testId !== id)),
        error: error?.message || 'Test failed'
      }))
      throw error
    }
  },
  
  getDataSourceById: (id) => {
    return get().dataSources.find(ds => ds.id === id)
  },
  
  getDataSourcesByType: (type) => {
    return get().dataSources.filter(ds => ds.type === type)
  }
}))