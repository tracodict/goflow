"use client"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Composer } from './Composer'
import type { ChatMessage } from './types'
import CodeMirror from '@uiw/react-codemirror'
import { json as cmJson } from '@codemirror/lang-json'
import { javascript as cmJavascript } from '@codemirror/lang-javascript'
import { sql as cmSql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import showdown from 'showdown'

import { useSessions } from './useSessions'

function useStream(onDelta: (delta: string) => void) {
  // Support both AIStream token format (0:"...") and SSE JSON lines (data: {...}).
  const tokenRe = /0:"((?:[^"\\]|\\.)*)"/g
  const sseDataRe = /(^|\n)data:\s*(\{[\s\S]*?\})(?=\n|$)/g

  return async (sessionId: string, messages: ChatMessage[], model: string) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, messages, model }),
      headers: { 'content-type': 'application/json' },
    })
    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const handleChunk = (chunk: string) => {
      buffer += chunk

      // 1) Try to parse SSE JSON events first
      try {
        let m: RegExpExecArray | null
        sseDataRe.lastIndex = 0
        while ((m = sseDataRe.exec(buffer))) {
          const jsonStr = m[2]
          try {
            const evt = JSON.parse(jsonStr)
            if (typeof evt?.delta === 'string' && String(evt.type || '').includes('delta')) {
              onDelta(evt.delta)
            } else if (typeof evt?.textDelta === 'string') {
              onDelta(evt.textDelta)
            } else if (typeof evt?.content === 'string' && String(evt.type || '').includes('message')) {
              onDelta(evt.content)
            }
          } catch {}
        }
      } catch {}

      // 2) Parse AIStream token segments 0:"..."
      let lastIdx = 0
      let t: RegExpExecArray | null
      tokenRe.lastIndex = 0
      while ((t = tokenRe.exec(buffer))) {
        const esc = t[1]
        try {
          const decoded = JSON.parse(`"${esc}"`)
          onDelta(decoded)
        } catch {
          // partial token; stop and keep in buffer
          break
        }
        lastIdx = tokenRe.lastIndex
      }

      // Always call onDelta for plain text chunks
      if (chunk) {
        onDelta(chunk)
      }

      if (lastIdx > 0 && lastIdx <= buffer.length) {
        buffer = buffer.slice(lastIdx)
      } else {
        // prevent unbounded growth on non-matching noise
        if (buffer.length > 4096) buffer = buffer.slice(-1024)
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      handleChunk(decoder.decode(value, { stream: true }))
    }
  }
}

export default function ChatPanel(){
  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [model, setModel] = useState<string>('openai/gpt-oss-20b')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesBoxRef = useRef<HTMLDivElement>(null)
  const append = (msg: ChatMessage)=> setMessages(m=> [...m, msg])

  // Session management
  // Use proper import for React hooks
  // import { useSessions } from './useSessions' at top
  const { sessions, loading: sessionsLoading, createSession, setActiveSession, deleteSession, reloadSessions } = useSessions()

  // Switch session and reload messages
  useEffect(() => {
    if (!sessions.length) return
    const active = sessions.find((s: import('./types').ChatSession) => s.isActive)
    if (active && active.sessionId !== sessionId) {
      setSessionId(active.sessionId)
    }
    // If no active session, clear sessionId
    if (!active) setSessionId('')
  }, [sessions])

  const run = useStream((delta)=> {
    setMessages(m=> {
      const copy = [...m]
      const last = copy[copy.length-1]
      if(last && last.role === 'assistant'){
        last.content += delta
      }
      return copy
    })
  })

  const onSubmit = async (text: string) => {
    const userMsg: ChatMessage = { sessionId, role: 'user', content: text, createdAt: new Date().toISOString() }
    const history = [...messages, userMsg]
    setMessages(history)
    append({ sessionId, role: 'assistant', content: '', createdAt: new Date().toISOString() })
    setStreaming(true)
    try {
      await run(sessionId, history, model)
    } finally {
      setStreaming(false)
    }
  }

  const onUpload = async (files: File[])=>{
    const fd = new FormData()
    files.forEach(f=> fd.append('files', f))
    const res = await fetch('/api/files/upload', { method: 'POST', body: fd })
    const data = await res.json().catch(()=>({})) as any
    // simple UX: append system message with uploaded URLs
    const urls = (data?.files||[]) as {url:string,name:string}[]
    if(urls.length){
      append({ sessionId, role: 'system', content: 'uploaded: '+ urls.map(u=> u.url).join(', '), createdAt: new Date().toISOString() })
    }
  }

  useEffect(()=>{
    // init model from localStorage
    try {
      const saved = localStorage.getItem('chat:model')
      if (saved) setModel(saved)
    } catch {}
    // load existing messages for current session
    ;(async()=>{
      const res = await fetch('/api/chat?sessionId='+encodeURIComponent(sessionId))
      if(res.ok){
        const data = await res.json()
        if(Array.isArray(data?.messages)) setMessages(data.messages)
      }
    })()
  },[sessionId])

  // Restore scroll position only after messages are loaded, and only once per session
  useEffect(() => {
    const key = 'chat:scrollTop:' + sessionId
    const box = messagesBoxRef.current
    if (!box) return
    let restored = false
    if (messages.length > 0) {
      const saved = localStorage.getItem(key)
      if (saved) {
        box.scrollTop = parseInt(saved, 10)
        restored = true
      }
      if (!restored && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    }
    // Only run this effect once per session load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, messages.length])

  // Save scroll position on scroll
  useEffect(() => {
    const key = 'chat:scrollTop:' + sessionId
    const box = messagesBoxRef.current
    if (!box) return
    const handler = () => {
      localStorage.setItem(key, String(box.scrollTop))
    }
    box.addEventListener('scroll', handler)
    return () => box.removeEventListener('scroll', handler)
  }, [sessionId])

  // Scroll to bottom when messages change (unless user scrolled up)
  useEffect(() => {
    const box = messagesBoxRef.current
    if (box && messagesEndRef.current) {
      // Only scroll to bottom if user is near the bottom
      const threshold = 100
      if (box.scrollHeight - box.scrollTop - box.clientHeight < threshold) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    }
  }, [messages])

  useEffect(()=>{
    try { localStorage.setItem('chat:model', model) } catch {}
  }, [model])

  return (
    <div className="flex flex-col h-full gap-3 p-3">
      {/* Session CRUD UI in Chat tab body, only if no active session */}
      {!sessions.find((s: import('./types').ChatSession) => s.isActive) ? (
        <div className="flex flex-col h-full gap-3 p-3 items-center justify-center">
          <div className="flex gap-2 items-center">
            {sessionsLoading ? <span>Loading…</span> : null}
            {sessions.map((s: import('./types').ChatSession) => (
              <span key={s.sessionId} className="flex items-center gap-1">
                {/* Display session as shadcn card */}
                <div className="border rounded shadow p-2 flex flex-col items-center min-w-[120px]">
                  <span className="font-semibold text-xs mb-1">{s.title || s.sessionId.slice(0, 8)}</span>
                  <div className="flex gap-1">
                    <button
                      className="p-1 rounded text-blue-700 hover:bg-blue-100"
                      style={{ border: 'none', background: 'none' }}
                      title="Activate session"
                      onClick={async () => { await setActiveSession(s.sessionId); setSessionId(s.sessionId); }}
                    >
                      <span aria-label="activate" title="Activate">&#x25B6;</span>
                    </button>
                    <button
                      className="p-1 rounded text-red-700 hover:bg-red-100"
                      style={{ border: 'none', background: 'none' }}
                      title="Delete session"
                      onClick={async () => { await deleteSession(s.sessionId); setSessionId(''); }}
                    >
                      <span aria-label="delete" title="Delete">&#x1F5D1;</span>
                    </button>
                  </div>
                </div>
              </span>
            ))}
            {/* Create session icon button */}
            <button className="p-1 rounded text-green-700 hover:bg-green-100" style={{ border: 'none', background: 'none' }} title="New session" onClick={async () => {
              const newId = await createSession();
              await setActiveSession(newId);
              setSessionId(newId);
            }}>
              <span aria-label="new" title="New">&#x2795;</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div ref={messagesBoxRef} className="flex-1 overflow-auto rounded text-sm bg-white">
            {messages.map((m, idx)=> (
              <div key={(m as any)._id || `${m.role}-${m.createdAt}-${idx}`} className={m.role==='user'? 'text-right':''}>
                <div className={"inline-block px-3 py-2 rounded "+ (m.role==='user'? 'bg-emerald-100':'bg-gray-100')}>
                  <div className="opacity-60 text-xs mb-1">{m.role}</div>
                  <MessageBody content={m.content} />
                </div>
              </div>
            ))}
            {streaming? <div className="text-gray-400 text-xs">assistant is typing…</div>: null}
            <div ref={messagesEndRef} />
          </div>
          <Composer
            onSubmit={onSubmit}
            onUpload={onUpload}
            model={model}
            setModel={setModel}
            models={[
              { id: 'openai/gpt-oss-20b', label: 'Gpt OSS 20b' },
              { id: 'openai/gpt-oss-120b', label: 'Gpt OSS 120b' }
            ]}
            onCloseSession={(() => {
              const active = sessions.find((s: import('./types').ChatSession) => s.isActive)
              if (!active) return undefined
              return async () => {
                await fetch('/api/chat/sessions/' + active.sessionId, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ isActive: false }),
                  credentials: 'same-origin'
                })
                setSessionId('')
                reloadSessions()
              }
            })()}
          />
        </div>
      )}

    </div>
  )
}

// --- Rendering helpers for fenced code blocks and markdown ---

const fenceRe = /```([\w-]+)?\n([\s\S]*?)```/g

function splitContent(content: string): Array<{ kind: 'text' | 'code' | 'markdown'; text?: string; code?: string; lang?: string }>{
  const parts: Array<{ kind: 'text' | 'code' | 'markdown'; text?: string; code?: string; lang?: string }> = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  fenceRe.lastIndex = 0
  while ((m = fenceRe.exec(content))) {
    const before = content.slice(lastIndex, m.index)
    if (before) parts.push({ kind: 'markdown', text: before })
    const lang = (m[1] || '').trim().toLowerCase()
    const code = m[2] || ''
    if (lang === 'md' || lang === 'markdown') {
      parts.push({ kind: 'markdown', code, lang: 'markdown' })
    } else if (!lang) {
      // try to infer json or markdown
      const trimmed = code.trim()
      let inferred: 'markdown' | 'code' = 'code'
      if ((trimmed.startsWith('{') || trimmed.startsWith('['))) {
        try { JSON.parse(trimmed); parts.push({ kind: 'code', code: trimmed, lang: 'json' }); } catch { parts.push({ kind: 'code', code, lang: 'plaintext' }) }
      } else if (/^\s{0,3}(#|\*\s|\d+\.\s|>\s)/m.test(code)) {
        inferred = 'markdown'
        parts.push({ kind: 'markdown', code, lang: 'markdown' })
      } else {
        parts.push({ kind: 'code', code, lang: 'plaintext' })
      }
    } else {
      parts.push({ kind: 'code', code, lang })
    }
    lastIndex = fenceRe.lastIndex
  }
  const rest = content.slice(lastIndex)
  if (rest) parts.push({ kind: 'text', text: rest })
  return parts
}

function MessageBody({ content }: { content: string }) {
  const converter = useMemo(() => new showdown.Converter({
    tables: true,
    ghCodeBlocks: true,
    strikethrough: true,
    simpleLineBreaks: true,
  }), [])

  const pieces = useMemo(() => splitContent(content), [content])
  return (
    <div className="space-y-2 text-left max-w-[80ch]">
      {pieces.map((p, i) => {
        if (p.kind === 'text') {
          return <div key={i} className="whitespace-pre-wrap">{p.text}</div>
        }
        if (p.kind === 'markdown' && p.code != null) {
          const html = converter.makeHtml(p.code)
          return <div key={i} className="markdown-body prose prose-sm" dangerouslySetInnerHTML={{ __html: html }} />
        }
        if (p.kind === 'code' && p.code != null) {
          return <CodeBlock key={i} code={p.code} lang={p.lang || 'plaintext'} />
        }
        return null
      })}
    </div>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const extensions = useMemo(() => {
    const ex: any[] = []
    const l = lang.toLowerCase()
    if (l === 'json') ex.push(cmJson())
    else if (l === 'js' || l === 'javascript' || l === 'ts' || l === 'typescript') ex.push(cmJavascript({ typescript: l === 'ts' || l === 'typescript' }))
    else if (l === 'sql') ex.push(cmSql())
  // python support can be added if needed via legacy-modes, omitted to avoid type mismatches
    // add more as needed; unknown -> plaintext
    return ex
  }, [lang])

  return (
    <div className="rounded border border-neutral-200 overflow-hidden">
      <CodeMirror
        value={code}
        theme={oneDark}
        height="auto"
        basicSetup={{ lineNumbers: false }}
        editable={false}
        extensions={extensions}
      />
    </div>
  )
}
