import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getTokenFromSession } from '@/lib/github-session'

export async function POST(request: NextRequest) {
  const token = await getTokenFromSession()
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const octokit = new Octokit({ auth: token })
  const { owner, repo, baseBranch, tempBranch } = await request.json()
  
  try {
    // Get base branch reference
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    })
    
    // Create temp branch from base
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${tempBranch}`,
      sha: ref.object.sha
    })
    
    return NextResponse.json({ success: true, branch: tempBranch })
  } catch (error: any) {
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Repository not found or access denied' }, 
        { status: 404 }
      )
    }
    
    if (error.status === 422 && error.message.includes('Reference already exists')) {
      return NextResponse.json({ success: true, branch: tempBranch })
    }
    
    console.error('GitHub workspace open error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to open workspace' }, 
      { status: 500 }
    )
  }
}
