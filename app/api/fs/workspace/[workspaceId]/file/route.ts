import { NextRequest, NextResponse } from 'next/server'

type RouteParams = {
  params: {
    workspaceId: string
  }
}

function notImplemented() {
  return NextResponse.json(
    { error: 'Local workspace provider is not implemented yet' },
    { status: 501 }
  )
}

export async function GET(_request: NextRequest, _context: RouteParams) {
  return notImplemented()
}

export async function PUT(_request: NextRequest, _context: RouteParams) {
  return notImplemented()
}

export async function POST(_request: NextRequest, _context: RouteParams) {
  return notImplemented()
}

export async function DELETE(_request: NextRequest, _context: RouteParams) {
  return notImplemented()
}
