import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getSession, getTokenFromSession } from '@/lib/github-session'

export async function GET(request: NextRequest) {
  const token = await getTokenFromSession()
  
  if (!token) {
    return NextResponse.json({ authenticated: false })
  }
  
  try {
    // Verify token with GitHub
    const octokit = new Octokit({ auth: token })
    const session = await getSession()
    
    // Return cached user or fetch fresh
    if (session.user) {
      return NextResponse.json({ 
        authenticated: true, 
        user: session.user 
      })
    }
    
    const { data: user } = await octokit.rest.users.getAuthenticated()
    
    // Update session with user data
    session.user = {
      id: user.id,
      login: user.login,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
    }
    await session.save()
    
    return NextResponse.json({ 
      authenticated: true, 
      user: session.user 
    })
  } catch (error: any) {
    console.error('GitHub auth status check failed:', error)
    return NextResponse.json({ 
      authenticated: false, 
      error: 'Invalid token' 
    })
  }
}
