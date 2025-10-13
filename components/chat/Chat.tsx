"use client"
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Composer } from './Composer'
import type { ChatMessage } from './types'
import CodeMirror from '@uiw/react-codemirror'
import { json as cmJson } from '@codemirror/lang-json'
import { javascript as cmJavascript } from '@codemirror/lang-javascript'
import { sql as cmSql } from '@codemirror/lang-sql'
import showdown from 'showdown'

import { componentRendererRegistry } from '@/vComponents'
import { useSessions } from './useSessions'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreVertical, Plus } from 'lucide-react'

const summarisePrompt = (source: string | undefined, fallback: string) => {
  const text = (source || '').trim()
  if (!text) return fallback
  const words = text.split(/\s+/u).filter(Boolean)
  const desiredCount = Math.min(15, Math.max(10, words.length))
  const summaryWords = words.slice(0, desiredCount)
  const summary = summaryWords.join(' ')
  return words.length > desiredCount ? `${summary}…` : summary
}

const formatTimestamp = (value: string | Date | undefined) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

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
  const activeSession = useMemo(() => sessions.find((s: import('./types').ChatSession) => s.isActive), [sessions])

  // Switch session and reload messages
  useEffect(() => {
    if (!sessions.length) {
      setSessionId('')
      return
    }
    if (activeSession) {
      if (activeSession.sessionId !== sessionId) {
        setSessionId(activeSession.sessionId)
      }
    } else {
      setSessionId('')
    }
  }, [sessions, activeSession, sessionId])

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
      {!activeSession ? (
        <div className="flex-1 w-full overflow-y-auto">
          <div className="flex flex-col items-center gap-4 py-4">
            {sessionsLoading ? <span className="text-sm text-muted-foreground">Loading…</span> : null}
            {!sessionsLoading && sessions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No chat sessions yet. Create one to get started.</div>
            ) : null}
            {sessions.map((s: import('./types').ChatSession) => {
              const sessionTitle = summarisePrompt(s.title, `Session ${s.sessionId.slice(0, 8)}`)
              const summaryText = (s.summary && s.summary.trim()) || 'No summary available yet. Start chatting to generate one.'
              const created = formatTimestamp(s.createdAt)
              return (
                <div
                  key={s.sessionId}
                  className="relative w-[90%] max-w-2xl rounded-lg border border-border bg-white/90 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium leading-snug text-foreground break-words">{sessionTitle}</div>
                      <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {summaryText}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          aria-label="Session actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={6}>
                        <DropdownMenuItem
                          onClick={async () => {
                            await setActiveSession(s.sessionId)
                            setSessionId(s.sessionId)
                          }}
                        >
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={async () => {
                            await deleteSession(s.sessionId)
                            setSessionId('')
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {created ? <div className="mt-2 text-xs text-muted-foreground">Created {created}</div> : null}
                </div>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 flex items-center gap-2"
              onClick={async () => {
                const newId = await createSession()
                if (!newId) return
                await setActiveSession(newId)
                setSessionId(newId)
              }}
            >
              <Plus className="h-4 w-4" />
              New session
            </Button>
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
                await reloadSessions()
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

type MarkdownPiece = { kind: 'markdown'; code: string }
type CodePiece = { kind: 'code'; code: string; lang: string }
type TextPiece = { kind: 'text'; text: string }
type VComponentPiece = { kind: 'vcomponent'; componentName: string; raw: string; payload: unknown; error?: string }
type ContentPiece = MarkdownPiece | CodePiece | TextPiece | VComponentPiece

function splitContent(content: string): ContentPiece[] {
  const parts: ContentPiece[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  fenceRe.lastIndex = 0
  while ((m = fenceRe.exec(content))) {
    const before = content.slice(lastIndex, m.index)
    if (before) parts.push({ kind: 'markdown', code: before })

    const rawLang = (m[1] || '').trim()
    const lang = rawLang.toLowerCase()
    const code = m[2] || ''
    const vComponentMatch = /^vcomponent-(.+)$/i.exec(rawLang)

    if (vComponentMatch) {
      const componentName = vComponentMatch[1].trim()
      let payload: unknown = {}
      let error: string | undefined

      if (!componentName) {
        error = 'Component name is required for vComponent blocks.'
      } else if (code.trim().length === 0) {
        payload = {}
      } else {
        try {
          payload = JSON.parse(code)
        } catch (err) {
          error = err instanceof Error ? err.message : 'Invalid JSON payload.'
        }
      }

      parts.push({ kind: 'vcomponent', componentName, raw: code, payload, error })
    } else if (lang === 'md' || lang === 'markdown') {
      parts.push({ kind: 'markdown', code })
    } else if (!lang) {
      const trimmed = code.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          JSON.parse(trimmed)
          parts.push({ kind: 'code', code: trimmed, lang: 'json' })
        } catch {
          parts.push({ kind: 'code', code, lang: 'plaintext' })
        }
      } else if (/^\s{0,3}(#|\*\s|\d+\.\s|>\s)/m.test(code)) {
        parts.push({ kind: 'markdown', code })
      } else {
        parts.push({ kind: 'code', code, lang: 'plaintext' })
      }
    } else {
      parts.push({ kind: 'code', code, lang })
    }
    lastIndex = fenceRe.lastIndex
  }
  const rest = content.slice(lastIndex)
  if (rest) parts.push({ kind: 'markdown', code: rest })
  return parts
}

function MessageBody({ content }: { content: string }) {
  const converter = useMemo(() => {
    const instance = new showdown.Converter({
      tables: true,
      ghCodeBlocks: true,
      strikethrough: true,
      simpleLineBreaks: true,
      tasklists: true,
      openLinksInNewWindow: true,
    })
    instance.setFlavor('github')
    instance.setOption('emoji', true)
    instance.setOption('smartLists', true)
    instance.setOption('sanitize', true)
    return instance
  }, [])

  const toHtml = useCallback((markdown: string) => {
    if (!markdown) return ''
    try {
      return converter.makeHtml(markdown)
    } catch (error) {
      console.warn('[Chat] Failed to convert markdown', error)
      return markdown
    }
  }, [converter])

  const pieces = useMemo(() => splitContent(content), [content])
  return (
    <div className="space-y-2 text-left">
      {pieces.map((p, i) => {
        if (p.kind === 'text') {
          const html = toHtml(p.text || '')
          return <div key={i} className="markdown-renderer" dangerouslySetInnerHTML={{ __html: html }} />
        }
        if (p.kind === 'markdown' && p.code != null) {
          const html = toHtml(p.code)
          return <div key={i} className="markdown-renderer" dangerouslySetInnerHTML={{ __html: html }} />
        }
        if (p.kind === 'vcomponent') {
          return <VComponentMessage key={i} piece={p} />
        }
        if (p.kind === 'code' && p.code != null) {
          return <CodeBlock key={i} code={p.code} lang={p.lang || 'plaintext'} />
        }
        return null
      })}
    </div>
  )
}

const VComponentMessage: React.FC<{ piece: VComponentPiece }> = ({ piece }) => {
  const renderer = React.useMemo(() => componentRendererRegistry.getRenderer(piece.componentName), [piece.componentName])

  const { Component, loadError } = React.useMemo(() => {
    if (!renderer) {
      return {
        Component: null as React.ComponentType<any> | null,
        loadError: `No renderer registered for "${piece.componentName}".`,
      }
    }
    try {
      const resolved = renderer.getComponent()
      return { Component: resolved, loadError: undefined as string | undefined }
    } catch (err) {
      console.warn(`[Chat] Failed to load renderer for vComponent "${piece.componentName}"`, err)
      const message = err instanceof Error ? err.message : 'Failed to load renderer.'
      return { Component: null as React.ComponentType<any> | null, loadError: message }
    }
  }, [piece.componentName, renderer])

  const resolvedProps = React.useMemo(() => {
    if (piece.payload && typeof piece.payload === 'object' && !Array.isArray(piece.payload)) {
      return piece.payload as Record<string, unknown>
    }
    if (piece.payload === undefined) {
      return {} as Record<string, unknown>
    }
    return { data: piece.payload } as Record<string, unknown>
  }, [piece.payload])

  const errorMessage = piece.error ?? loadError

  if (errorMessage || !Component) {
    return (
      <div className="space-y-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-xs">
        <div className="font-semibold text-destructive">Unable to render vComponent "{piece.componentName}"</div>
        {errorMessage ? <div className="text-muted-foreground">{errorMessage}</div> : null}
        {piece.raw ? (
          <pre className="max-h-48 overflow-auto rounded border border-destructive/20 bg-background p-2 text-[11px]">
            {piece.raw}
          </pre>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded border border-border bg-background p-3">
      <Component {...resolvedProps} />
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
        theme="light"
        height="auto"
        basicSetup={{ lineNumbers: false }}
        editable={false}
        extensions={extensions}
      />
    </div>
  )
}
