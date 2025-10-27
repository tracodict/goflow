import { NextRequest, NextResponse } from 'next/server'

type RouteParams = {
  params: {
    workspaceId: string
  }
}

export async function POST(_request: NextRequest, _context: RouteParams) {
  return NextResponse.json(
    { error: 'Local workspace provider is not implemented yet' },
    { status: 501 }
  )
}
