import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    console.log('[debug api] MCP click received', body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[debug api] MCP click error', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
