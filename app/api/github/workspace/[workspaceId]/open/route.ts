import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getTokenFromSession } from '@/lib/github-session'
import { parseGitHubWorkspaceId } from '@/lib/workspace/id'

type RouteParams = {
  params: {
    workspaceId: string
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const token = await getTokenFromSession()

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const octokit = new Octokit({ auth: token })
  const { workspaceId } = await params
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)
  const { baseBranch = 'main' } = await request.json()
  const tempBranch = branch

  try {
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    })

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${tempBranch}`,
      sha: ref.object.sha
    })

    return NextResponse.json({ success: true, branch: tempBranch })
  } catch (error: any) {
    if (error?.status === 422 && typeof error.message === 'string' && error.message.includes('Reference already exists')) {
      return NextResponse.json({ success: true, branch: tempBranch })
    }

    if (error?.status === 404) {
      return NextResponse.json({ error: 'Repository not found or access denied' }, { status: 404 })
    }

    console.error('GitHub workspace open error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to open workspace' },
      { status: 500 }
    )
  }
}
