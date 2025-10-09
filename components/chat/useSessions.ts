import { useEffect, useState } from 'react'
import type { ChatSession } from './types'

export function useSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(false)

  const reloadSessions = () => {
    setLoading(true)
    fetch('/api/chat/sessions', { credentials: 'same-origin' })
      .then(res => res.json())
      .then(data => setSessions(data.sessions || []))
      .finally(() => setLoading(false))
  }
  useEffect(reloadSessions, [])

  const createSession = async () => {
    const res = await fetch('/api/chat/sessions', { method: 'POST', credentials: 'same-origin' })
    const data = await res.json()
    reloadSessions()
    return data.sessionId
  }

  const setActiveSession = async (sessionId: string) => {
    if (!sessionId) return
    await fetch('/api/chat/sessions/' + sessionId, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
      credentials: 'same-origin'
    })
    reloadSessions()
  }

  const deleteSession = async (sessionId: string) => {
    await fetch('/api/chat/sessions/' + sessionId, { method: 'DELETE', credentials: 'same-origin' })
    reloadSessions()
  }

  return { sessions, loading, createSession, setActiveSession, deleteSession, reloadSessions }
}
