import { cookies } from 'next/headers'

export interface SessionRecord {
  id: string
  userId: string
  email: string
  name: string
  picture?: string
  globalRoles: string[]
  appRoles?: Record<string, string[]>
  expiresAt: number
}

export interface Principal {
  userId: string
  email: string
  name: string
  picture?: string
  roles: string[]
  exp: number
}

const DEV_FAKE_SESSION: Principal = {
  userId: 'dev-user',
  email: 'dev@lizhao.net',
  name: 'Dev User',
  picture: undefined,
  roles: ['admin','workflow:editor'],
  exp: Date.now()/1000 + 3600
}

export function authDisabled() {
  return process.env.AUTH_DISABLED === '1'
}

// In real deployment this would call central auth service introspection endpoint.
async function fetchSessionFromAuth(sessionId: string): Promise<Principal | null> {
  const base = process.env.AUTH_BASE_URL
  if (!base) return null
  try {
    const resp = await fetch(`${base.replace(/\/$/,'')}/session`, { headers: { 'Cookie': `lz_sess=${encodeURIComponent(sessionId)}` }, cache: 'no-store' })
    if (!resp.ok) return null
    const data = await resp.json()
    return data as Principal
  } catch { return null }
}

export async function getSession(): Promise<Principal | null> {
  if (authDisabled()) {
    const jar = await cookies()
    if (jar.get('dev_logged_out')) return null
    return DEV_FAKE_SESSION
  }
  const jar = await cookies()
  const sid = jar.get('lz_sess')?.value
  if (!sid) return null
  const principal = await fetchSessionFromAuth(sid)
  if (!principal) return null
  // Domain allow-list enforcement
  const allowedEnv = process.env.ALLOWED_DOMAIN || process.env.ALLOWED_DOMAINS
  if (allowedEnv) {
    const list = allowedEnv.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    if (list.length) {
      const emailHost = (principal.email.split('@')[1] || '').toLowerCase()
      if (!list.includes(emailHost)) return null
    }
  }
  return principal
}

export async function requireSession(): Promise<Principal> {
  const s = await getSession()
  if (!s) throw new Error('UNAUTHENTICATED')
  return s
}

export function buildAuthStartURL(returnUrl: string) {
  const authBase = process.env.AUTH_BASE_URL || 'https://auth.lizhao.net'
  const sanitized = sanitizeReturn(returnUrl)
  const u = new URL('/oauth/start', authBase)
  u.searchParams.set('return', sanitized)
  return u.toString()
}

export function principalForApp(session: Principal, appKey?: string) {
  // For future per-app filtering; currently roles already consolidated in central service.
  return session
}

// Accept only https URLs whose host ends with .lizhao.net (or exact test env), else fall back to DEFAULT_RETURN
export function sanitizeReturn(candidate: string | undefined | null): string {
  const fallback = process.env.DEFAULT_RETURN || 'https://test.lizhao.net'
  if (!candidate) return fallback
  try {
    const u = new URL(candidate)
    const hostOk = /\.lizhao\.net$/i.test(u.hostname)
    const schemeOk = u.protocol === 'https:'
    if (schemeOk && hostOk) return u.toString()
  } catch { /* ignore */ }
  return fallback
}
