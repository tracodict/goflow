import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { getDb } from '@/components/chat/mongo'
import { resolveModel } from '@/components/chat/llm'
import type { ChatMessage, ChatSession } from '@/components/chat/types'

type ResolvedModel = ReturnType<typeof resolveModel>

const SUMMARY_WORD_MAX = 30
const SUMMARY_WORD_MIN = 10
const PROMPT_CONTENT_LIMIT = 600

function normaliseWhitespace(value: string | undefined | null) {
  if (!value) return ''
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

function fallbackSummary(messages: ChatMessage[]) {
  const firstMessage = messages.find((m) => m.role === 'user') ?? messages[0]
  const text = normaliseWhitespace(firstMessage?.content)
  if (!text) return ''
  const words = text.split(/\s+/u).filter(Boolean)
  const desired = Math.min(SUMMARY_WORD_MAX, Math.max(SUMMARY_WORD_MIN, words.length))
  const snippet = words.slice(0, desired).join(' ')
  return words.length > desired ? `${snippet}…` : snippet
}

function buildSummaryPrompt(messages: ChatMessage[]) {
  if (!messages.length) return ''
  const toRoleLabel = (role: string) => {
    switch (role) {
      case 'assistant':
        return 'Assistant'
      case 'system':
        return 'System'
      case 'tool':
        return 'Tool'
      default:
        return 'User'
    }
  }
  const truncate = (text: string) => {
    const trimmed = normaliseWhitespace(text)
    if (trimmed.length <= PROMPT_CONTENT_LIMIT) return trimmed
    return `${trimmed.slice(0, PROMPT_CONTENT_LIMIT - 1)}…`
  }
  const conversation = messages
    .map((m) => `${toRoleLabel(m.role)}: ${truncate(String(m.content || ''))}`)
    .join('\n\n')

  return `You are writing a concise summary of the first exchange in a chat session. ` +
    `Summarize the main user goal or topic in at most ${SUMMARY_WORD_MAX} words and do not add a heading.\n\n` +
    `Conversation:\n${conversation}\n\nSummary:`
}

// GET /api/chat/sessions - list all sessions
export async function GET() {
  const db = await getDb()
  const sessions = await db.collection('chat_sessions').find({}).sort({ updatedAt: -1 }).toArray()
  const messagesCollection = db.collection('chat_messages')
  const result: ChatSession[] = []
  const summaryModelId = process.env.CHAT_SUMMARY_MODEL || process.env.DEFAULT_CHAT_MODEL
  let model: ResolvedModel | null = null
  let modelResolutionFailed = false

  for (const rawSession of sessions) {
    const raw = rawSession as unknown as Record<string, any>
    const session: ChatSession = {
      _id: raw._id,
      sessionId: String(raw.sessionId),
      title: raw.title,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      isActive: raw.isActive,
      summary: raw.summary,
    }
    let summary = normaliseWhitespace(session.summary)

    if (!summary) {
      const firstDocs = await messagesCollection
        .find({ sessionId: session.sessionId })
        .sort({ createdAt: 1 })
        .limit(4)
        .toArray()
      const firstMessages = firstDocs.map((doc) => ({
        _id: doc._id ? String(doc._id) : undefined,
        sessionId: String((doc as any).sessionId),
        role: (doc as any).role as ChatMessage['role'],
        content: String((doc as any).content ?? ''),
        attachments: (doc as any).attachments,
        createdAt: (doc as any).createdAt,
      })) as unknown as ChatMessage[]

      if (firstMessages.length) {
        const prompt = buildSummaryPrompt(firstMessages)

        if (prompt) {
          if (!model && !modelResolutionFailed) {
            try {
              model = resolveModel(summaryModelId)
            } catch (error) {
              modelResolutionFailed = true
              console.error('[chat] Failed to resolve summary model', error)
            }
          }

          if (model) {
            try {
              const summaryResult = await generateText({
                model,
                prompt,
                temperature: 0.2,
                maxTokens: 120,
              })
              summary = normaliseWhitespace(summaryResult.text)
            } catch (error) {
              console.error(`[chat] Summary generation failed for session ${session.sessionId}`, error)
            }
          }
        }

        if (!summary) {
          summary = fallbackSummary(firstMessages)
        }

        if (summary) {
          try {
            await db.collection('chat_sessions').updateOne(
              { sessionId: session.sessionId },
              { $set: { summary, summaryGeneratedAt: new Date().toISOString() } }
            )
          } catch (error) {
            console.warn(`[chat] Failed to persist summary for session ${session.sessionId}`, error)
          }
        }
      }
    }

    result.push({ ...session, summary })
  }

  return Response.json({ sessions: result })
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
