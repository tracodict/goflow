"use client"
import React, { useEffect, useRef, useState } from 'react'
import { Paperclip, Send } from 'lucide-react'

type Model = { id: string; label?: string }

export function Composer({
  onSubmit,
  onUpload,
  model,
  setModel,
  models,
}: {
  onSubmit: (text: string) => Promise<void> | void
  onUpload: (files: File[]) => Promise<void> | void
  model: string
  setModel: (m: string) => void
  models: Model[]
}) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLFormElement | null>(null)
  const [width, setWidth] = useState<number>(0)
  const showHint = width >= 400
  const showModel = width >= 250

  useEffect(() => {
    if (!containerRef.current) return
    let raf = 0
    const el = containerRef.current
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || el.clientWidth
      // throttle layout updates slightly
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setWidth(w))
    })
    ro.observe(el)
    // initialize
    setWidth(el.clientWidth)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  const doSubmit = async () => {
    if (!text.trim() || pending) return
    setPending(true)
    try {
      await onSubmit(text)
      setText('')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      ref={containerRef}
      className="flex flex-col gap-2 rounded border border-neutral-200 p-2 bg-white"
      onSubmit={(e) => {
        e.preventDefault()
        void doSubmit()
      }}
    >
      {/* Row 1: Text area */}
      <div className="w-full">
        <textarea
          className="w-full rounded p-2 text-sm min-h-[48px] border-0 focus:outline-none focus:ring-0 bg-transparent"
          rows={3}
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void doSubmit()
            }
          }}
        />
      </div>

      {/* Row 2: Model selector, hint (center), action buttons */}
      <div className="grid grid-cols-3 items-center">
        {/* Left: Model selector */}
        {showModel ? (
          <div className="flex flex-col gap-1 w-40">
            <label className="text-[10px] uppercase tracking-wide text-neutral-500">Model</label>
            <select
              className="rounded border px-2 py-1 text-xs bg-white"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              title="Select model"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label || m.id}
                </option>
              ))}
            </select>
          </div>
        ) : <div />}

        {/* Center: hint */}
        {showHint ? (
          <div className="text-[10px] text-neutral-500 text-center">Enter to send • Shift+Enter for newline</div>
        ) : <div />}

        {/* Right: Action buttons */}
        <div className="flex items-center gap-1 justify-self-end">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length) onUpload(files)
              if (fileRef.current) fileRef.current.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Attach files"
            className="size-9 rounded-full border flex items-center justify-center hover:bg-neutral-50"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={pending}
            title="Send message"
            className="size-9 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  )
}
