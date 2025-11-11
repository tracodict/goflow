import { NextRequest } from 'next/server'
import { getDb } from '@/components/chat/mongo'

// PATCH /api/chat/sessions/:sessionId - set active/inactive
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const db = await getDb()
  const body = await req.json()
  const { isActive } = body
  const { sessionId } = await params
  if (isActive) {
    await db.collection('chat_sessions').updateMany({}, { $set: { isActive: false } })
  }
  await db.collection('chat_sessions').updateOne({ sessionId }, { $set: { isActive } })
  return Response.json({ sessionId, isActive })
}

// DELETE /api/chat/sessions/:sessionId - delete session and its messages
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const db = await getDb()
  const { sessionId } = await params
  await db.collection('chat_sessions').deleteOne({ sessionId })
  await db.collection('chat_messages').deleteMany({ sessionId })
  return Response.json({ sessionId, deleted: true })
}
