import { NextResponse } from 'next/server'
import { sanitizeReturn } from '@/lib/auth'

function clearSessionCookies(res: NextResponse) {
  const domain = process.env.TOP_COOKIE_DOMAIN || '.lizhao.net'
  const clearOpts = { path: '/', maxAge: 0, domain, httpOnly: true, secure: true, sameSite: 'none' as const }
  res.cookies.set('lz_sess','', clearOpts)
  res.cookies.set({ name: 'lz_sess', value: '', path: '/', maxAge: 0 })
  // In dev, mark logged out so fake session not reused
  if (process.env.AUTH_DISABLED === '1') {
    res.cookies.set('dev_logged_out','1',{ path: '/', maxAge: 3600 })
  }
}

function buildCentralLogout(returnTo: string) {
  const authBase = process.env.AUTH_BASE_URL || 'https://auth.lizhao.net'
  return `${authBase.replace(/\/$/,'')}/logout?return=${encodeURIComponent(returnTo)}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const returnParam = sanitizeReturn(url.searchParams.get('return') || undefined)
  const isDev = process.env.AUTH_DISABLED === '1'
  const res = NextResponse.redirect(isDev ? returnParam : buildCentralLogout(returnParam), { status: 303 })
  clearSessionCookies(res)
  // In prod if REDIRECT_AUTH_LOGOUT disabled, just bounce to login start
  if (!isDev && process.env.REDIRECT_AUTH_LOGOUT === '0') {
    const authBase = process.env.AUTH_BASE_URL || 'https://auth.lizhao.net'
    res.headers.set('Location', `${authBase.replace(/\/$/,'')}/login?return=${encodeURIComponent(returnParam)}`)
  }
  return res
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const returnParam = sanitizeReturn(url.searchParams.get('return') || undefined)
  const isDev = process.env.AUTH_DISABLED === '1'
  const res = NextResponse.json({ ok: true })
  clearSessionCookies(res)
  if (!isDev && process.env.REDIRECT_AUTH_LOGOUT !== '0') {
    return NextResponse.json({ ok: true, centralLogout: buildCentralLogout(returnParam) }, { status: 200, headers: res.headers })
  }
  return res
}
