"use client"
import React, { useCallback, useMemo, useEffect, useRef } from 'react'
import { ResizableCodeMirror } from '@/components/ui/resizable-codemirror'

export type MsgType = 'system' | 'user' | 'assistant' | 'tool' | 'placeholder'
export interface LlmMessage { type: MsgType; text?: string; key?: string; append?: boolean }
export interface LlmTemplateObj { messages: LlmMessage[] }

// Removed optional Jinja extension to prevent multiple state instances conflicts

const MessageEditor: React.FC<{
  message: LlmMessage
  index: number
  onUpdate: (idx: number, patch: Partial<LlmMessage>) => void
  onMove: (idx: number, dir: -1 | 1) => void
  onRemove: (idx: number) => void
}> = React.memo(({ message, index, onUpdate, onMove, onRemove }) => {
  const handleTextChange = useCallback((v: string) => {
    onUpdate(index, { text: v })
  }, [index, onUpdate])

  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value as MsgType
    if (t === 'placeholder') {
      onUpdate(index, { 
        type: t, 
        text: undefined, 
        key: message.key ?? 'chat_history', 
        append: message.append ?? true 
      })
    } else {
      onUpdate(index, { 
        type: t, 
        key: undefined, 
        append: undefined, 
        text: message.text ?? '' 
      })
    }
  }, [index, message.key, message.append, message.text, onUpdate])

  const handleKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(index, { key: e.target.value })
  }, [index, onUpdate])

  const handleAppendChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(index, { append: e.target.checked })
  }, [index, onUpdate])

  return (
    <div className="border rounded p-2">
      <div className="flex items-center gap-2 mb-2">
        <select
          className="border rounded px-2 py-1 text-xs"
          value={message.type}
          onChange={handleTypeChange}
        >
          <option>system</option>
          <option>user</option>
          <option>assistant</option>
          <option>tool</option>
          <option>placeholder</option>
        </select>
        <div className="ml-auto flex gap-1">
          <button className="px-1 py-0.5 text-[10px] border rounded" onClick={() => onMove(index, -1)}>↑</button>
          <button className="px-1 py-0.5 text-[10px] border rounded" onClick={() => onMove(index, 1)}>↓</button>
          <button className="px-1 py-0.5 text-[10px] border rounded text-red-600" onClick={() => onRemove(index)}>Delete</button>
        </div>
      </div>
      {message.type === 'placeholder' ? (
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            Key
            <input 
              className="border rounded px-2 py-1 text-xs" 
              value={message.key ?? ''} 
              onChange={handleKeyChange}
            />
          </label>
          <label className="flex items-center gap-1">
            Append
            <input 
              type="checkbox" 
              checked={!!message.append} 
              onChange={handleAppendChange}
            />
          </label>
        </div>
      ) : (
        <div className="text-xs">
          <ResizableCodeMirror
            value={message.text ?? ''}
            initialHeight={100}
            minHeight={60}
            maxHeight={400}
            theme="light"
            onChange={handleTextChange}
            storageKey={`llm-message-${index}-${message.type}`}
            className="text-xs"
          />
          <div className="text-[10px] text-neutral-500 mt-1">
            Jinja placeholders supported, e.g. <code>{"{{ role }}"}</code> or <code>{"{{ question }}"}</code>. Each message editor is resizable - drag the bottom border.
          </div>
        </div>
      )}
    </div>
  )
})

export const LlmMessagesEditor: React.FC<{
  value: LlmTemplateObj
  onChange: (v: LlmTemplateObj) => void
}> = ({ value, onChange }) => {
  const msgs = Array.isArray(value?.messages) ? value.messages : []

  // Keep a ref of the latest messages to allow stable callbacks
  const msgsRef = useRef<LlmMessage[]>(msgs)
  useEffect(() => { msgsRef.current = msgs }, [msgs])

  // Stable callbacks to avoid changing function identity on each render
  const updateMsg = useCallback((idx: number, patch: Partial<LlmMessage>) => {
    const cur = msgsRef.current
    const next = cur.slice()
    next[idx] = { ...next[idx], ...patch }
    onChange({ messages: next })
  }, [onChange])

  const addMsg = useCallback((t: MsgType) => {
    const base: LlmMessage = t === 'placeholder' ? { type: t, key: 'chat_history', append: true } : { type: t, text: '' }
    const cur = msgsRef.current
    onChange({ messages: [...cur, base] })
  }, [onChange])

  const removeMsg = useCallback((idx: number) => {
    const cur = msgsRef.current
    onChange({ messages: cur.filter((_, i) => i !== idx) })
  }, [onChange])
  
  const move = useCallback((idx: number, dir: -1 | 1) => {
    const cur = msgsRef.current
    const j = idx + dir
    if (j < 0 || j >= cur.length) return
    const next = cur.slice()
    const [it] = next.splice(idx, 1)
    next.splice(j, 0, it)
    onChange({ messages: next })
  }, [onChange])

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(['system','user','assistant','tool','placeholder'] as MsgType[]).map(t => (
          <button key={t} className="px-2 py-1 text-xs border rounded" onClick={()=>addMsg(t)}>+ {t}</button>
        ))}
      </div>
      <div className="space-y-3">
        {msgs.map((m, idx) => (
          <MessageEditor
            key={`message-${idx}-${m.type}-${m.key || 'default'}`}
            message={m}
            index={idx}
            onUpdate={updateMsg}
            onMove={move}
            onRemove={removeMsg}
          />
        ))}
        {msgs.length === 0 && (
          <div className="text-[11px] text-neutral-500">No messages. Add one above.</div>
        )}
      </div>
    </div>
  )
}
