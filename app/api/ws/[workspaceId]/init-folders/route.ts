import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceProvider } from '@/lib/workspace/provider'
import { POST as githubInit } from '@/app/api/github/workspace/[workspaceId]/init-folders/route'

type RouteParams = {
  params: {
    workspaceId: string
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  const provider = getWorkspaceProvider()
  if (provider === 'github') {
    return githubInit(request, context)
  }
  return NextResponse.json(
    { error: 'Local workspace provider is not implemented yet' },
    { status: 501 }
  )
}
