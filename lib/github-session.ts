import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  githubToken?: string
  user?: {
    id: number
    login: string
    name: string | null
    email: string | null
    avatar_url: string
  }
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'goflow_github_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

export async function getTokenFromSession(): Promise<string | null> {
  const session = await getSession()
  return session.githubToken || null
}
