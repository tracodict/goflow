"use client"
import { useEffect, useState } from 'react'
import { getDataSourceSchema } from '@/lib/datastore-client'
import { useSystemSettings, DEFAULT_SETTINGS } from '@/components/petri/system-settings-context'

export function useDatasourceSchema(id?: string) {
  const [collections, setCollections] = useState<string[]>([])
  const [tables, setTables] = useState<string[]>([])
  const [folders, setFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { settings } = useSystemSettings()
  const flowServiceUrl = settings?.flowServiceUrl || DEFAULT_SETTINGS.flowServiceUrl
  useEffect(()=> {
    let cancelled = false
    async function run(){
      if (!id) { setCollections([]); setTables([]); setFolders([]); return }
      setLoading(true)
      try {
        const schema = await getDataSourceSchema(flowServiceUrl, id)
        const collectionNames = toNameArray(schema.collections)
        const tableNames = toNameArray(schema.tables)
        const folderNames = toNameArray(schema.folders ?? schema.prefixes ?? schema.directories)
        if (!cancelled) {
          setCollections(collectionNames)
          setTables(tableNames)
          setFolders(folderNames)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[useDatasourceSchema] Failed to load schema', error)
          setCollections([])
          setTables([])
          setFolders([])
        }
      } finally { if (!cancelled) setLoading(false) }
    }
    run()
    return ()=> { cancelled = true }
  }, [id, flowServiceUrl])
  return { collections, tables, folders, loading }
}

function toNameArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map(item => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const candidate =
          (item as any).name ||
          (item as any).key ||
          (item as any).path ||
          (item as any).prefix ||
          (item as any).id
        return typeof candidate === 'string' ? candidate : undefined
      }
      return undefined
    })
    .filter((val): val is string => typeof val === 'string' && val.length > 0)
}