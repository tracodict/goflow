import { NextRequest, NextResponse } from 'next/server'
import { sanitizeReturn } from '@/lib/auth'

// Minimal middleware to enforce auth cookie outside dev.
export async function middleware(req: NextRequest) {
  const isDev = process.env.AUTH_DISABLED === '1'
  if (isDev) return NextResponse.next()

  const publicPrefixes = ['/api/health', '/public', '/_next', '/favicon', '/robots.txt']
  if (publicPrefixes.some(p => req.nextUrl.pathname.startsWith(p))) return NextResponse.next()

  const sid = req.cookies.get('lz_sess')?.value
  if (!sid) {
    const authBase = process.env.AUTH_BASE_URL || 'https://auth.lizhao.net'
    const start = new URL('/login', authBase)
  start.searchParams.set('return', sanitizeReturn(req.nextUrl.toString()))
    return NextResponse.redirect(start)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
