import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/github-session'

export async function POST(request: NextRequest) {
  const session = await getSession()
  session.destroy()
  
  return NextResponse.json({ success: true })
}
