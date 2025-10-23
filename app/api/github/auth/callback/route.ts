import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getSession } from '@/lib/github-session'

const STATE_COOKIE_NAME = 'github_oauth_state'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  // Verify state token
  const storedState = request.cookies.get(STATE_COOKIE_NAME)?.value
  
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=invalid_state`
    )
  }
  
  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=no_code`
    )
  }
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    })
    
    const tokenData = await tokenResponse.json()
    
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error)
    }
    
    const accessToken = tokenData.access_token
    
    // Get user information
    const octokit = new Octokit({ auth: accessToken })
    const { data: user } = await octokit.rest.users.getAuthenticated()
    
    // Store token and user in session
    const session = await getSession()
    session.githubToken = accessToken
    session.user = {
      id: user.id,
      login: user.login,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
    }
    await session.save()
    
    // Redirect back to app
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?github_auth=success`
    )
    
    // Clear state cookie
    response.cookies.delete(STATE_COOKIE_NAME)
    
    return response
  } catch (error: any) {
    console.error('GitHub OAuth error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=auth_failed`
    )
  }
}
