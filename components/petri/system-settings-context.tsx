"use client"
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type SystemSettings = Record<string, string>

const DEFAULT_SETTINGS: SystemSettings = {
  flowServiceUrl: 'https://goflow.lizhao.net',
  dictionaryUrl: 'https://raw.githubusercontent.com/tracodict/jschema/refs/heads/main/ep299',
}

interface Ctx {
  settings: SystemSettings
  setSetting: (key: string, value: string) => void
  deleteSetting: (key: string) => void
  addSetting: () => void
  resetDefaults: () => void
}

const SystemSettingsContext = createContext<Ctx | null>(null)
const LS_KEY = 'goflow.systemSettings'

function loadInitial(): SystemSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as SystemSettings
    return { ...DEFAULT_SETTINGS, ...parsed } // ensure defaults present
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(() => loadInitial())

  // Persist
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY, JSON.stringify(settings))
    }
  }, [settings])

  const setSetting = useCallback((key: string, value: string) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }, [])

  const deleteSetting = useCallback((key: string) => {
    setSettings((s) => {
      if (key in DEFAULT_SETTINGS) return s // protect defaults from deletion via delete; could allow but spec not explicit
      const next = { ...s }
      delete next[key]
      return next
    })
  }, [])

  const addSetting = useCallback(() => {
    setSettings((s) => {
      let base = 'newKey'
      let idx = 1
      while (s[base] || base in DEFAULT_SETTINGS) {
        base = `newKey${idx++}`
      }
      return { ...s, [base]: '' }
    })
  }, [])

  const resetDefaults = useCallback(() => setSettings({ ...DEFAULT_SETTINGS }), [])

  return (
    <SystemSettingsContext.Provider value={{ settings, setSetting, deleteSetting, addSetting, resetDefaults }}>
      {children}
    </SystemSettingsContext.Provider>
  )
}

export function useSystemSettings() {
  const ctx = useContext(SystemSettingsContext)
  if (!ctx) throw new Error('useSystemSettings must be used within SystemSettingsProvider')
  return ctx
}

export { DEFAULT_SETTINGS }
