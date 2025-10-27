import { useEffect, useMemo } from 'react'
import { useWorkspace } from '@/stores/workspace-store'
import { encodeWorkspaceId } from '@/lib/workspace/id'
import { DEFAULT_SETTINGS, useSystemSettings } from '@/components/petri/system-settings-context'

function normalizeBase(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

type Options = {
  includeDefault?: boolean
}

export function useFlowServiceUrl(options: Options = {}) {
  const includeDefault = options.includeDefault ?? true

  const workspaceId = useWorkspace((state) => state.workspaceId)
  const workspaceScoped = useMemo(() => {
    if (!workspaceId) return null
    try {
      const encoded = encodeWorkspaceId(workspaceId)
      return `/api/ws/${encoded}/flow`
    } catch (error) {
      console.warn('[useFlowServiceUrl] Failed to encode workspace id', { workspaceId, error })
      return null
    }
  }, [workspaceId])

  let settingsUrl: string | null = null
  try {
    const { settings } = useSystemSettings()
    settingsUrl = normalizeBase(settings?.flowServiceUrl)
  } catch (error) {
    settingsUrl = null
  }

  const envUrl = normalizeBase(typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FLOW_SERVICE_URL : undefined)
  const globalUpstream = normalizeBase(typeof window !== 'undefined' ? (window as any).__goflowUpstreamBase : undefined)
  const globalUrl = normalizeBase(typeof window !== 'undefined' ? (window as any).__goflowServiceBase : undefined)

  let localUrl: string | null = null
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage?.getItem?.('goflow.systemSettings')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed.flowServiceUrl === 'string') {
          localUrl = normalizeBase(parsed.flowServiceUrl)
        }
      }
    } catch {
      localUrl = null
    }
  }

  const defaultUrl = includeDefault ? normalizeBase(DEFAULT_SETTINGS.flowServiceUrl) : null
  const upstreamBase = settingsUrl || envUrl || globalUpstream || localUrl || defaultUrl
  const resolved = workspaceScoped || settingsUrl || envUrl || globalUrl || localUrl || defaultUrl

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (resolved) {
      ;(window as any).__goflow_flowServiceUrl = resolved
      ;(window as any).__goflowServiceBase = resolved
    }
    if (upstreamBase) {
      ;(window as any).__goflowUpstreamBase = upstreamBase
    }
  }, [resolved, upstreamBase])

  return resolved
}
