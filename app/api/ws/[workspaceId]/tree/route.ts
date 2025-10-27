import { NextRequest } from 'next/server'
import { getWorkspaceProvider } from '@/lib/workspace/provider'
import { GET as githubTree } from '@/app/api/github/workspace/[workspaceId]/tree/route'
import { GET as fsTree } from '@/app/api/fs/workspace/[workspaceId]/tree/route'

type RouteParams = {
  params: {
    workspaceId: string
  }
}

export async function GET(request: NextRequest, context: RouteParams) {
  const provider = getWorkspaceProvider()
  if (provider === 'github') {
    return githubTree(request, context)
  }
  return fsTree(request, context)
}
