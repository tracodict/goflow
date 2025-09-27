import { NextResponse } from 'next/server'
import { getDatasourceStore } from '@/lib/datasource-store'

export async function GET() {
  try {
    const store = getDatasourceStore()
    const datasources = await store.list()
    
    const list = datasources.map(ds => ({
      ...ds,
      connectionPreview: store.maskConnectionInfo(ds)
    }))
    
    return NextResponse.json({ datasources: list })
  } catch (error: any) {
    console.error('[datasources:GET] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to list datasources' } },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const store = getDatasourceStore()
    
    const datasource = await store.create({
      name: body.name || 'Untitled Datasource',
      type: body.type || 'mongo',
      configPublic: body.configPublic || body.config || { database: 'app' },
      secret: body.secret,
      status: 'unknown'
    })
    
    return NextResponse.json(datasource, { status: 201 })
  } catch (error: any) {
    console.error('[datasources:POST] Error:', error)
    return NextResponse.json(
      { error: { message: error?.message || 'Failed to create datasource' } },
      { status: 400 }
    )
  }
}
