import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { streamText, type CoreMessage } from 'ai'
import { resolveModel } from '@/components/chat/llm'
import { ensureIndexes, getDb } from '@/components/chat/mongo'
import type { ChatMessage } from '@/components/chat/types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId') || 'default'
  const db = await getDb()
  const docs = await db.collection('chat_messages').find({ sessionId }).sort({ createdAt: 1 }).toArray()
  // map to ChatMessage shape
  const messages = docs.map((d:any)=> ({ _id: d._id?.toString?.(), sessionId: d.sessionId, role: d.role, content: d.content, attachments: d.attachments, createdAt: d.createdAt }))
  return Response.json({ messages })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=> ({})) as { sessionId?: string; messages?: ChatMessage[]; model?: string }
  const sessionId = body.sessionId || 'default'
  const messages = (body.messages || []).map(m=> ({ role: m.role, content: m.content })) as CoreMessage[]

  // persist user message (last one)
  try {
    await ensureIndexes()
    const db = await getDb()
    const now = new Date()
    const last = (body.messages || []).slice(-1)[0]
    if (last && last.role === 'user') {
      await db.collection('chat_messages').insertOne({ sessionId, role: last.role, content: last.content, attachments: last.attachments, createdAt: now.toISOString() })
      await db.collection('chat_sessions').updateOne({ sessionId }, { $set: { sessionId, updatedAt: now.toISOString() }, $setOnInsert: { createdAt: now.toISOString() } }, { upsert: true })
    }
  } catch (e) {
    console.error('[chat] persist error', e)
  }

  // resolve model from body or cookie
  let cookieModel: string | undefined
  try {
    const store: any = await (cookies() as any)
    cookieModel = store?.get?.('chat-model')?.value
  } catch {}
  const selectedModel = body.model || cookieModel
  const model = resolveModel(selectedModel)
  const result = await streamText({ model, messages })

  // tap stream to persist assistant message at end
  const stream = result.toAIStream({
    onFinal: async (finalText) => {
      try {
        const db = await getDb()
        await db.collection('chat_messages').insertOne({ sessionId, role: 'assistant', content: finalText, createdAt: new Date().toISOString() })
      } catch (e) { console.error('[chat] persist assistant error', e) }
    }
  })
  const res = new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  try {
    if (body.model) {
      res.headers.append('Set-Cookie', `chat-model=${encodeURIComponent(body.model)}; Path=/; Max-Age=${60*60*24*30}`)
    }
  } catch {}
  return res
}
