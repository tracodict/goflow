import { NextResponse } from 'next/server'
import { getDatasourceStore } from '@/lib/datasource-store'

export async function GET(
  _: Request,
  ctx: Promise<{ params: { id: string } | Promise<{ id: string }> }> | { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolved: any = await ctx
    const params: any = await resolved.params
    const { id } = params
    
    const store = getDatasourceStore()
    const datasource = await store.findById(id)
    
    if (!datasource) {
      return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
    }
    
    return NextResponse.json({
      ...datasource,
      connectionPreview: store.maskConnectionInfo(datasource)
    })
  } catch (error: any) {
    console.error('[datasource:GET] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch datasource' } },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  ctx: Promise<{ params: { id: string } | Promise<{ id: string }> }> | { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolved: any = await ctx
    const params: any = await resolved.params
    const { id } = params
    
    const body = await req.json().catch(() => ({}))
    const store = getDatasourceStore()
    
    // Build update object from body
    const updates: any = {}
    if (body.name) updates.name = body.name
    if (body.configPublic) updates.configPublic = body.configPublic
    if (body.config) updates.configPublic = { ...updates.configPublic, ...body.config }
    if (body.secret) updates.secret = body.secret
    if (body.status) updates.status = body.status
    if (typeof body.lastLatencyMs === 'number') updates.lastLatencyMs = body.lastLatencyMs
    if (body.lastError !== undefined) updates.lastError = body.lastError
    
    const updated = await store.update(id, updates)
    
    if (!updated) {
      return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
    }
    
    return NextResponse.json({
      ...updated,
      connectionPreview: store.maskConnectionInfo(updated)
    })
  } catch (error: any) {
    console.error('[datasource:PATCH] Error:', error)
    return NextResponse.json(
      { error: { message: error?.message || 'Failed to update datasource' } },
      { status: 400 }
    )
  }
}

export async function DELETE(
  _: Request,
  ctx: Promise<{ params: { id: string } | Promise<{ id: string }> }> | { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolved: any = await ctx
    const params: any = await resolved.params
    const { id } = params
    
    const store = getDatasourceStore()
    const deleted = await store.delete(id)
    
    if (!deleted) {
      return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
    }
    
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[datasource:DELETE] Error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to delete datasource' } },
      { status: 500 }
    )
  }
}
