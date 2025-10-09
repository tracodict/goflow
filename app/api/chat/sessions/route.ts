import { NextRequest } from 'next/server'
import { getDb } from '@/components/chat/mongo'
import type { ChatSession } from '@/components/chat/types'

// GET /api/chat/sessions - list all sessions
export async function GET() {
  const db = await getDb()
  const sessions = await db.collection('chat_sessions').find({}).sort({ updatedAt: -1 }).toArray()
  return Response.json({ sessions })
}

// POST /api/chat/sessions - create new session
export async function POST(req: NextRequest) {
  const db = await getDb()
  const now = new Date().toISOString()
  const body = await req.json().catch(() => ({}))
  const sessionId = body.sessionId || Math.random().toString(36).slice(2)
  await db.collection('chat_sessions').insertOne({ sessionId, createdAt: now, updatedAt: now, isActive: false })
  return Response.json({ sessionId })
}
