"use client"
// Utility to lazily fetch and cache pre-supported JSON schemas list from CDN root defined by system settings.
// The CDN root (dictionaryUrl) hosts a schema.json file listing supported schemas.
// We only need the names for the combobox; the full schema bodies (if required later) can be fetched separately.

import { useCallback, useRef, useState } from 'react'
import { useSystemSettings } from './system-settings-context'

// Module-level cache (persists across component mounts during session)
let cachedNames: string[] | null = null
let inFlight: Promise<string[]> | null = null
// Cache for individual schema bodies by name
const schemaBodyCache: Record<string, any> = {}
const schemaBodyInFlight: Record<string, Promise<any>> = {}

async function fetchPreSupported(dictionaryUrl: string): Promise<string[]> {
  // Normalize root: ensure no trailing slash for join
  const root = dictionaryUrl.replace(/\/+$/, '')
  const url = `${root}/schems.json`
  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    // Accept array<string> or array<{name:string}>
    if (Array.isArray(data)) {
      const names = data
        .map((item) => {
          if (!item) return null
            if (typeof item === 'string') return item
            if (typeof item === 'object' && typeof item.name === 'string') return item.name
            return null
        })
        .filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i)
      return names
    }
    return []
  } catch (e) {
    console.warn('[pre-supported-schemas] failed to fetch', url, e)
    return []
  }
}

function ensurePromise(dictionaryUrl: string): Promise<string[]> {
  if (cachedNames) return Promise.resolve(cachedNames)
  if (inFlight) return inFlight
  inFlight = fetchPreSupported(dictionaryUrl).then((names) => {
    cachedNames = names
    return names
  }).finally(() => { inFlight = null })
  return inFlight
}

export function usePreSupportedSchemas() {
  const { settings } = useSystemSettings()
  const [names, setNames] = useState<string[]>(() => cachedNames || [])
  const [loaded, setLoaded] = useState<boolean>(!!cachedNames)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const load = useCallback(async () => {
    if (loadingRef.current || loaded) return
    loadingRef.current = true
    const list = await ensurePromise(settings.dictionaryUrl || '')
    if (!list.length && !cachedNames) {
      setError('Empty or failed fetch')
    } else {
      setError(null)
    }
    setNames(list)
    setLoaded(true)
    loadingRef.current = false
  }, [loaded, settings.dictionaryUrl])

  return { names, loaded, error, load }
}

// Helper to synchronously read cached names without hook (e.g., non-react code)
export function getCachedPreSupportedSchemas(): string[] {
  return cachedNames ? [...cachedNames] : []
}

// Fetch and cache full JSON schema body for a given pre-supported schema name.
// Path pattern: {dictionaryUrl}/{initLetter}/{name}.schema.json
export async function fetchPreSupportedSchema(name: string, dictionaryUrl: string): Promise<any | null> {
  if (!name) return null
  if (schemaBodyCache.hasOwnProperty(name)) return schemaBodyCache[name]
  if (Object.prototype.hasOwnProperty.call(schemaBodyInFlight, name)) return schemaBodyInFlight[name]
  const root = (dictionaryUrl || '').replace(/\/+$/, '')
  if (!root) return null
  const letter = name[0]
  const upper = letter.toUpperCase()
  const candidates = [ `${root}/${upper}/${name}.schema.json` ]
  // Fallback try original-case letter if different
  if (upper !== letter) candidates.push(`${root}/${letter}/${name}.schema.json`)
  schemaBodyInFlight[name] = (async () => {
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'force-cache' })
        if (!res.ok) { continue }
        const data = await res.json()
        schemaBodyCache[name] = data
        return data
      } catch (e) {
        // try next candidate
      }
    }
    schemaBodyCache[name] = null
    return null
  })().finally(() => { delete schemaBodyInFlight[name] })
  return schemaBodyInFlight[name]
}
