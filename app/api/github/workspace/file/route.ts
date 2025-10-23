import { NextRequest, NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'
import { getTokenFromSession } from '@/lib/github-session'

// GET - Read file
export async function GET(request: NextRequest) {
  const token = await getTokenFromSession()
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const octokit = new Octokit({ auth: token })
  const { searchParams } = request.nextUrl
  const owner = searchParams.get('owner')!
  const repo = searchParams.get('repo')!
  const branch = searchParams.get('branch')!
  const path = searchParams.get('path')!
  
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch
    }) as { data: any }
    
    if ('content' in data) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      return NextResponse.json({ content, sha: data.sha })
    }
    
    return NextResponse.json({ error: 'Not a file' }, { status: 400 })
  } catch (error: any) {
    console.error('GitHub get file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to read file' }, 
      { status: error.status || 500 }
    )
  }
}

// PUT - Update file
export async function PUT(request: NextRequest) {
  const token = await getTokenFromSession()
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const octokit = new Octokit({ auth: token })
  const { owner, repo, branch, path, content, sha } = await request.json()
  
  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Update ${path}`,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch
    })
    
    return NextResponse.json({ sha: data.content?.sha })
  } catch (error: any) {
    console.error('GitHub update file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update file' }, 
      { status: error.status || 500 }
    )
  }
}

// POST - Create file
export async function POST(request: NextRequest) {
  const token = await getTokenFromSession()
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const octokit = new Octokit({ auth: token })
  const { owner, repo, branch, path, content } = await request.json()
  
  try {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Create ${path}`,
      content: Buffer.from(content).toString('base64'),
      branch
    })
    
    return NextResponse.json({ sha: data.content?.sha })
  } catch (error: any) {
    console.error('GitHub create file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create file' }, 
      { status: error.status || 500 }
    )
  }
}

// DELETE - Delete file
export async function DELETE(request: NextRequest) {
  const token = await getTokenFromSession()
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const octokit = new Octokit({ auth: token })
  const { owner, repo, branch, path, sha } = await request.json()
  
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
    console.error('GitHub delete file error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete file' }, 
      { status: error.status || 500 }
    )
  }
}
