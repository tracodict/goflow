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
  const { owner, repo, branch } = parseGitHubWorkspaceId(params.workspaceId)
  const { baseBranch = 'main', commitMessage } = await request.json()

  try {
    const { data: comparison } = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: baseBranch,
      head: branch
    })

    if (comparison.commits.length === 0) {
      return NextResponse.json({ message: 'No changes to save' })
    }

    const { data: tempBranchRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })

    const { data: tempCommit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: tempBranchRef.object.sha
    })

    const { data: baseRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    })

    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage || 'Save workspace changes',
      tree: tempCommit.tree.sha,
      parents: [baseRef.object.sha]
    })

    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
      sha: newCommit.sha
    })

    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })

    return NextResponse.json({ success: true, sha: newCommit.sha })
  } catch (error: any) {
    console.error('GitHub save workspace error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to save workspace' },
      { status: 500 }
    )
  }
}
