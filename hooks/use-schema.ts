"use client"
import { useEffect, useState } from 'react'
import { introspectSchema } from '@/lib/datasource-client'

export function useDatasourceSchema(id?: string) {
  const [collections, setCollections] = useState<string[]>([])
  const [tables, setTables] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(()=> {
    let cancelled = false
    async function run(){
      if (!id) { setCollections([]); setTables([]); return }
      setLoading(true)
      try {
        const data = await introspectSchema(id)
        if (!cancelled) {
          setCollections(data.collections||[])
          setTables(data.tables||[])
        }
      } finally { if (!cancelled) setLoading(false) }
    }
    run()
    return ()=> { cancelled = true }
  }, [id])
  return { collections, tables, loading }
}