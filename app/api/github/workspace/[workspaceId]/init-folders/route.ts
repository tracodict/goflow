import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getTokenFromSession } from '@/lib/github-session'
import { parseGitHubWorkspaceId } from '@/lib/workspace/id'

type RouteParams = {
  params: {
    workspaceId: string
  }
}

const WORKSPACE_FOLDERS = ['Pages', 'DataSources', 'Queries', 'Workflows', 'Schemas', 'MCPTools']

export async function POST(_: NextRequest, { params }: RouteParams) {
  const token = await getTokenFromSession()

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const octokit = new Octokit({ auth: token })
  const { workspaceId } = await params
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)

  try {
    for (const folder of WORKSPACE_FOLDERS) {
      try {
        await octokit.rest.repos.getContent({
          owner,
          repo,
          path: folder,
          ref: branch
        })
      } catch (error: any) {
        if (error?.status === 404) {
          await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${folder}/.gitkeep`,
            message: `Initialize ${folder} folder`,
            content: Buffer.from('').toString('base64'),
            branch
          })
        } else {
          throw error
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('GitHub init-folders error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to initialize workspace folders' },
      { status: 500 }
    )
  }
}
