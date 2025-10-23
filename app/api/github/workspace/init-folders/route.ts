import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getTokenFromSession } from '@/lib/github-session'

export async function POST(request: NextRequest) {
  const token = await getTokenFromSession()
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const octokit = new Octokit({ auth: token })
  const { owner, repo, branch } = await request.json()
  
  const folders = ['Pages', 'DataSources', 'Queries', 'Workflows', 'Schemas', 'MCPTools']
  
  try {
    for (const folder of folders) {
      try {
        // Check if folder exists
        await octokit.rest.repos.getContent({
          owner,
          repo,
          path: folder,
          ref: branch
        })
      } catch (error: any) {
        if (error.status === 404) {
          // Create folder with .gitkeep file
          await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${folder}/.gitkeep`,
            message: `Initialize ${folder} folder`,
            content: Buffer.from('').toString('base64'),
            branch
          })
        }
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('GitHub init folders error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to initialize folders' }, 
      { status: 500 }
    )
  }
}
