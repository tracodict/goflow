import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getTokenFromSession } from '@/lib/github-session'
import { parseGitHubWorkspaceId } from '@/lib/workspace/id'
import { decrypt } from '@/lib/datasource-crypto'

function isEncryptedString(value: any): value is string {
  return typeof value === 'string' && value.startsWith('djE6') // base64 of "v1:"
}

async function decryptObject(obj: any): Promise<any> {
  if (typeof obj === 'string') {
    if (isEncryptedString(obj)) {
      try {
        return JSON.parse(await decrypt(obj))
      } catch (e) {
        // If decryption fails or not JSON, return decrypted string
        return await decrypt(obj)
      }
    }
    return obj
  }
  if (Array.isArray(obj)) {
    return Promise.all(obj.map(decryptObject))
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await decryptObject(value)
    }
    return result
  }
  return obj
}

type RouteParams = {
  params: Promise<{
    workspaceId: string
  }>
}

async function getOctokit() {
  const token = await getTokenFromSession()
  if (!token) {
    return null
  }
  // Optionally, use FLOW_SERVICE_URL for custom baseUrl if needed
  // return new Octokit({ auth: token, baseUrl: FLOW_SERVICE_URL })
  return new Octokit({ auth: token })
}

export async function GET(request: NextRequest, context: RouteParams) {
  const octokit = await getOctokit()

  if (!octokit) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const path = request.nextUrl.searchParams.get('path')

  if (!path) {
    return NextResponse.json({ error: 'Missing path query parameter' }, { status: 400 })
  }

  const { workspaceId } = await context.params
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch
    })

    if (Array.isArray(data) || !('content' in data)) {
      return NextResponse.json({ error: 'Not a file' }, { status: 400 })
    }

    const content = Buffer.from(data.content, 'base64').toString('utf-8')

    // Attempt to parse as JSON and decrypt any encrypted strings
    let payload: any
    try {
      const parsed = JSON.parse(content)
      const decrypted = await decryptObject(parsed)
      payload = { success: true, data: decrypted }
    } catch (e) {
      // Not JSON, fall back to raw string
      payload = { success: true, data: content }
    }

    const response = NextResponse.json(payload)
    response.headers.set('x-github-file-sha', data.sha)
    return response
  } catch (error: any) {
    console.error('GitHub file read error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to read file' },
      { status: error?.status === 404 ? 404 : 500 }
    )
  }
}

export async function PUT(request: NextRequest, context: RouteParams) {
  const octokit = await getOctokit()

  if (!octokit) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path, content, sha } = await request.json()

  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 })
  }

  if (!sha || typeof sha !== 'string') {
    return NextResponse.json({ error: 'Missing file sha' }, { status: 400 })
  }

  const { workspaceId } = await context.params
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)

  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Update ${path}`,
      content: Buffer.from(content ?? '').toString('base64'),
      sha,
      branch
    })

    return NextResponse.json({ sha: data.content?.sha })
  } catch (error: any) {
    console.error('GitHub file update error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update file' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  const octokit = await getOctokit()

  if (!octokit) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path, content } = await request.json()

  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 })
  }

  const { workspaceId } = await context.params
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)

  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Create ${path}`,
      content: Buffer.from(content ?? '').toString('base64'),
      branch
    })

    return NextResponse.json({ sha: data.content?.sha })
  } catch (error: any) {
    console.error('GitHub file create error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to create file' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  const octokit = await getOctokit()

  if (!octokit) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path, sha } = await request.json()

  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 })
  }

  if (!sha || typeof sha !== 'string') {
    return NextResponse.json({ error: 'Missing file sha' }, { status: 400 })
  }

  const { workspaceId } = await context.params
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)

  try {
    await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path,
      message: `Delete ${path}`,
      sha,
      branch
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('GitHub file delete error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete file' },
      { status: 500 }
    )
  }
}
