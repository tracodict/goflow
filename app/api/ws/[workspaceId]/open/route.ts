import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceProvider } from '@/lib/workspace/provider'
import { POST as githubOpen } from '@/app/api/github/workspace/[workspaceId]/open/route'

type RouteParams = {
  params: {
    workspaceId: string
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  const provider = getWorkspaceProvider()
  if (provider === 'github') {
    return githubOpen(request, context)
  }
  return NextResponse.json(
    { error: 'Local workspace provider is not implemented yet' },
    { status: 501 }
  )
}
