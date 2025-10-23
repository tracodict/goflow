import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getTokenFromSession } from '@/lib/github-session'

export async function POST(request: NextRequest) {
  const token = await getTokenFromSession()
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const octokit = new Octokit({ auth: token })
  const { owner, repo, branch, baseBranch, commitMessage } = await request.json()
  
  try {
    // 1. Get all commits from temp branch
    const { data: comparison } = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: baseBranch,
      head: branch
    })
    
    if (comparison.commits.length === 0) {
      return NextResponse.json({ message: 'No changes to save' })
    }
    
    // 2. Get the tree of the temp branch
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
    
    // 3. Get base branch reference
    const { data: baseRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    })
    
    // 4. Create squashed commit on base branch
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage || 'Save workspace changes',
      tree: tempCommit.tree.sha,
      parents: [baseRef.object.sha]
    })
    
    // 5. Update base branch to point to new commit
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
      sha: newCommit.sha
    })
    
    // 6. Delete temp branch
    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })
    
    return NextResponse.json({ success: true, sha: newCommit.sha })
  } catch (error: any) {
    console.error('GitHub save workspace error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save workspace' }, 
      { status: 500 }
    )
  }
}
