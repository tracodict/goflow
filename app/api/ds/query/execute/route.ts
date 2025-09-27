import { NextResponse } from 'next/server'

// Very simple mock dataset
const MOCK_ROWS = Array.from({ length: 25 }).map((_,i) => ({ _id: i+1, name: `User ${i+1}`, email: `user${i+1}@example.com` }))

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { ast } = body
    const limit = Math.min(ast?.limit || 100, 100)
    const rows = MOCK_ROWS.slice(0, limit)
    return NextResponse.json({ columns: Object.keys(rows[0] || {}).map(k => ({ name: k })), rows, meta: { executionMs: 1, datasourceId: ast?.datasourceId || 'ds_mock_mongo', cached: false } })
  } catch (e:any) {
    return NextResponse.json({ error: { message: e?.message || 'Execution failed' } }, { status: 400 })
  }
}
