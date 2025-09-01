'use client'
import React from 'react'

export interface SessionValue {
  loading: boolean
  session: any
  refresh: () => Promise<void>
}

const Ctx = React.createContext<SessionValue>({ loading: true, session: null, refresh: async () => {} })

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [redirecting, setRedirecting] = React.useState(false)

  const fetchSession = React.useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/session', { cache: 'no-store' })
      if (resp.ok) {
        const data = await resp.json()
        setSession(data)
      } else setSession(null)
    } catch { setSession(null) }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { fetchSession() }, [fetchSession])

  // If fetch finished and no session, force redirect to central auth start instead of local login
  React.useEffect(() => {
    if (!loading && !session && !redirecting) {
      setRedirecting(true)
      try {
        const authBase = process.env.NEXT_PUBLIC_AUTH_BASE_URL || process.env.NEXT_PUBLIC_AUTH_BASE || 'https://auth.lizhao.net'
        const start = new URL('/oauth/start', authBase)
        start.searchParams.set('return', window.location.href)
        window.location.replace(start.toString())
      } catch {/* ignore */}
    }
  }, [loading, session, redirecting])

  if (redirecting) return null
  return <Ctx.Provider value={{ loading, session, refresh: fetchSession }}>{children}</Ctx.Provider>
}

export function useSession() { return React.useContext(Ctx) }
