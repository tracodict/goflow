import { NextRequest } from 'next/server'
import { getWorkspaceProvider } from '@/lib/workspace/provider'
import { POST as githubSave } from '@/app/api/github/workspace/[workspaceId]/save/route'
import { POST as fsSave } from '@/app/api/fs/workspace/[workspaceId]/save/route'

type RouteParams = {
  params: {
    workspaceId: string
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  const provider = getWorkspaceProvider()
  if (provider === 'github') {
    return githubSave(request, context)
  }
  return fsSave(request, context)
}
