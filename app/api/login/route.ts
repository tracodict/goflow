import { NextResponse } from 'next/server'
import { authDisabled, buildAuthStartURL, sanitizeReturn } from '@/lib/auth'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const returnParam = sanitizeReturn(url.searchParams.get('return') || undefined)
  const domain = process.env.TOP_COOKIE_DOMAIN || '.lizhao.net'
  if (authDisabled()) {
    // In dev we just set a dummy cookie matching prod domain for easier manual tests.
    const res = NextResponse.redirect(returnParam)
    res.cookies.set('lz_sess','dev-session',{ path: '/', maxAge: 3600, domain, httpOnly: true })
  // Clear dev logout marker
  res.cookies.set('dev_logged_out','',{ path: '/', maxAge: 0 })
    return res
  }
  return NextResponse.redirect(buildAuthStartURL(returnParam))
}
