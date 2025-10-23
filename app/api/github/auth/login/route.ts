import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const STATE_COOKIE_NAME = 'github_oauth_state'

export async function GET(request: NextRequest) {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/github/auth/callback`
  const state = crypto.randomBytes(32).toString('hex')
  
  const authUrl = new URL('https://github.com/login/oauth/authorize')
  authUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID || '')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'repo,user:email')
  authUrl.searchParams.set('state', state)
  
  const response = NextResponse.redirect(authUrl.toString())
  
  // Store state in cookie for verification
  response.cookies.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  })
  
  return response
}
