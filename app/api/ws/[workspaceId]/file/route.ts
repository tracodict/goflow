import { NextRequest } from 'next/server'
import { getWorkspaceProvider } from '@/lib/workspace/provider'
import {
  GET as githubGet,
  PUT as githubPut,
  POST as githubPost,
  DELETE as githubDelete
} from '@/app/api/github/workspace/[workspaceId]/file/route'
import {
  GET as fsGet,
  PUT as fsPut,
  POST as fsPost,
  DELETE as fsDelete
} from '@/app/api/fs/workspace/[workspaceId]/file/route'

type RouteParams = {
  params: {
    workspaceId: string
  }
}

export async function GET(request: NextRequest, context: { params: { workspaceId: string } }) {
  const provider = getWorkspaceProvider()
  if (provider === 'github') {
    return githubGet(request, context)
  }
  return fsGet(request, context)
}

export async function PUT(request: NextRequest, context: RouteParams) {
  const provider = getWorkspaceProvider()
  if (provider === 'github') {
    return githubPut(request, context)
  }
  return fsPut(request, context)
}

export async function POST(request: NextRequest, context: RouteParams) {
  const provider = getWorkspaceProvider()
  if (provider === 'github') {
    return githubPost(request, context)
  }
  return fsPost(request, context)
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const provider = getWorkspaceProvider()
  if (provider === 'github') {
    return githubDelete(request, context)
  }
  return fsDelete(request, context)
}
