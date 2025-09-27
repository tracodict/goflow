import { promises as fs } from 'fs'
import path from 'path'

export interface Datasource {
  id: string
  name: string
  type: 'mongo' | 'postgres' | 'mysql' | 's3'
  configPublic: Record<string, any>
  secret?: {
    uri?: string
    host?: string
    port?: number
    user?: string
    password?: string
    database?: string
    collection?: string
    // S3-specific secret fields
    provider?: string
    accessKey?: string
    secretKey?: string
    region?: string
    endpoint?: string
    serviceAccountKey?: string
    projectId?: string
    [key: string]: any
  }
  status?: 'unknown' | 'healthy' | 'error'
  lastLatencyMs?: number
  lastError?: string
  createdAt?: string
  updatedAt?: string
}

interface StoreData {
  version: number
  datasources: Datasource[]
}

class DatasourceStore {
  private data: StoreData = { version: 1, datasources: [] }
  private isLoaded = false
  private storePath: string
  private writeTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.storePath = path.join(process.cwd(), '.goflow', 'datasources.json')
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return

    try {
      // Ensure .goflow directory exists
      await fs.mkdir(path.dirname(this.storePath), { recursive: true })
      
      // Try to load existing data
      const content = await fs.readFile(this.storePath, 'utf-8')
      const parsed = JSON.parse(content) as StoreData
      
      if (parsed.version === 1 && Array.isArray(parsed.datasources)) {
        this.data = parsed
      } else {
        console.warn('[datasource-store] Invalid store format, using defaults')
        this.data = { version: 1, datasources: [] }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, start with default mock data
        this.data = {
          version: 1,
          datasources: [
            {
              id: 'ds_mock_mongo',
              name: 'Mock MongoDB',
              type: 'mongo',
              configPublic: { database: 'app' },
              status: 'unknown',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        }
        await this.persistData()
      } else {
        console.error('[datasource-store] Failed to load store:', error)
        // Use default data but don't persist yet
        this.data = { version: 1, datasources: [] }
      }
    }

    this.isLoaded = true
  }

  private async persistData(): Promise<void> {
    try {
      // Debounce writes to avoid excessive I/O
      if (this.writeTimeout) {
        clearTimeout(this.writeTimeout)
      }

      this.writeTimeout = setTimeout(async () => {
        try {
          const content = JSON.stringify(this.data, null, 2)
          await fs.writeFile(this.storePath, content, 'utf-8')
          if (process.env.GOFLOW_DEBUG) {
            console.log('[datasource-store] Persisted', this.data.datasources.length, 'datasources')
          }
        } catch (error) {
          console.error('[datasource-store] Failed to persist:', error)
        }
      }, 100) // 100ms debounce
    } catch (error) {
      console.error('[datasource-store] Failed to schedule persist:', error)
    }
  }

  private updateTimestamp(datasource: Partial<Datasource>): void {
    datasource.updatedAt = new Date().toISOString()
  }

  async list(): Promise<Datasource[]> {
    await this.ensureLoaded()
    return [...this.data.datasources] // Return copy to prevent external mutation
  }

  async findById(id: string): Promise<Datasource | undefined> {
    await this.ensureLoaded()
    return this.data.datasources.find(ds => ds.id === id)
  }

  async create(datasource: Omit<Datasource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Datasource> {
    await this.ensureLoaded()
    
    const id = 'ds_' + Math.random().toString(36).slice(2, 10)
    const now = new Date().toISOString()
    
    const newDatasource: Datasource = {
      id,
      ...datasource,
      status: datasource.status || 'unknown',
      createdAt: now,
      updatedAt: now
    }

    this.data.datasources.push(newDatasource)
    await this.persistData()
    
    return newDatasource
  }

  async update(id: string, updates: Partial<Omit<Datasource, 'id' | 'createdAt'>>): Promise<Datasource | null> {
    await this.ensureLoaded()
    
    const index = this.data.datasources.findIndex(ds => ds.id === id)
    if (index === -1) return null

    // Merge updates while preserving existing data
    const existing = this.data.datasources[index]
    const updated: Datasource = {
      ...existing,
      ...updates,
      id, // Ensure id can't be changed
      createdAt: existing.createdAt, // Preserve creation date
    }
    
    this.updateTimestamp(updated)
    this.data.datasources[index] = updated
    await this.persistData()
    
    return updated
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureLoaded()
    
    const index = this.data.datasources.findIndex(ds => ds.id === id)
    if (index === -1) return false

    this.data.datasources.splice(index, 1)
    await this.persistData()
    
    return true
  }

  async updateStatus(id: string, status: Datasource['status'], error?: string, latencyMs?: number): Promise<void> {
    const updates: Partial<Datasource> = { status }
    if (error !== undefined) updates.lastError = error
    if (latencyMs !== undefined) updates.lastLatencyMs = latencyMs
    
    await this.update(id, updates)
  }

  // Utility method to mask sensitive information in connection previews
  maskConnectionInfo(datasource: Datasource): any {
    const secret = datasource.secret
    if (!secret) return null

    const masked: any = {
      host: secret.host,
      port: secret.port,
      user: secret.user,
      database: secret.database,
      collection: secret.collection,
    }

    if (secret.uri) {
      try {
        const u = new URL(secret.uri.replace(/^mongodb\+srv:/, 'mongodb:'))
        masked.uri = secret.uri.replace(u.password || '', '***')
      } catch {
        masked.uri = secret.uri
      }
    }

    if (secret.password) {
      masked.password = '***'
    }

    return masked
  }
}

// Singleton instance
let storeInstance: DatasourceStore | null = null

export function getDatasourceStore(): DatasourceStore {
  if (!storeInstance) {
    storeInstance = new DatasourceStore()
  }
  return storeInstance
}

// For backwards compatibility with existing code
export default getDatasourceStore