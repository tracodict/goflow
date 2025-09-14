"use client"
import React from 'react'
import dynamic from 'next/dynamic'
// Use a single dynamic instance of CodeMirror to avoid multiple @codemirror/state copies
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CodeMirror: any = dynamic(() => import('@uiw/react-codemirror'), { ssr: false })

export type MsgType = 'system' | 'user' | 'assistant' | 'tool' | 'placeholder'
export interface LlmMessage { type: MsgType; text?: string; key?: string; append?: boolean }
export interface LlmTemplateObj { messages: LlmMessage[] }

// Removed optional Jinja extension to prevent multiple state instances conflicts

export const LlmMessagesEditor: React.FC<{
  value: LlmTemplateObj
  onChange: (v: LlmTemplateObj) => void
}> = ({ value, onChange }) => {
  const msgs = Array.isArray(value?.messages) ? value.messages : []

  const updateMsg = (idx: number, patch: Partial<LlmMessage>) => {
    const next = msgs.slice()
    next[idx] = { ...next[idx], ...patch }
    onChange({ messages: next })
  }
  const addMsg = (t: MsgType) => {
    const base: LlmMessage = t === 'placeholder' ? { type: t, key: 'chat_history', append: true } : { type: t, text: '' }
    onChange({ messages: [...msgs, base] })
  }
  const removeMsg = (idx: number) => onChange({ messages: msgs.filter((_, i) => i !== idx) })
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= msgs.length) return
    const next = msgs.slice()
    const [it] = next.splice(idx, 1)
    next.splice(j, 0, it)
    onChange({ messages: next })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(['system','user','assistant','tool','placeholder'] as MsgType[]).map(t => (
          <button key={t} className="px-2 py-1 text-xs border rounded" onClick={()=>addMsg(t)}>+ {t}</button>
        ))}
      </div>
      <div className="space-y-3">
        {msgs.map((m, idx) => (
          <div key={`${idx}-${m.type}`} className="border rounded p-2">
            <div className="flex items-center gap-2 mb-2">
              <select
                className="border rounded px-2 py-1 text-xs"
                value={m.type}
                onChange={e=>{
                  const t = e.target.value as MsgType
                  if (t === 'placeholder') updateMsg(idx, { type: t, text: undefined, key: m.key ?? 'chat_history', append: m.append ?? true })
                  else updateMsg(idx, { type: t, key: undefined, append: undefined, text: m.text ?? '' })
                }}
              >
                <option>system</option>
                <option>user</option>
                <option>assistant</option>
                <option>tool</option>
                <option>placeholder</option>
              </select>
              <div className="ml-auto flex gap-1">
                <button className="px-1 py-0.5 text-[10px] border rounded" onClick={()=>move(idx,-1)}>↑</button>
                <button className="px-1 py-0.5 text-[10px] border rounded" onClick={()=>move(idx, 1)}>↓</button>
                <button className="px-1 py-0.5 text-[10px] border rounded text-red-600" onClick={()=>removeMsg(idx)}>Delete</button>
              </div>
            </div>
            {m.type === 'placeholder' ? (
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1">
                  Key
                  <input className="border rounded px-2 py-1 text-xs" value={m.key ?? ''} onChange={e=>updateMsg(idx, { key: e.target.value })}/>
                </label>
                <label className="flex items-center gap-1">
                  Append
                  <input type="checkbox" checked={!!m.append} onChange={e=>updateMsg(idx, { append: e.target.checked })}/>
                </label>
              </div>
            ) : (
              <div className="text-xs">
                <CodeMirror
                  value={m.text ?? ''}
                  height="100px"
                  theme="light"
                  basicSetup={{ lineNumbers: false, highlightActiveLine: false, foldGutter: false }}
                  onChange={(v: string)=>updateMsg(idx, { text: v })}
                />
                <div className="text-[10px] text-neutral-500 mt-1">Jinja placeholders supported, e.g. <code>{"{{ role }}"}</code> or <code>{"{{ question }}"}</code>. Syntax highlighting disabled to avoid runtime conflicts.</div>
              </div>
            )}
          </div>
        ))}
        {msgs.length === 0 && (
          <div className="text-[11px] text-neutral-500">No messages. Add one above.</div>
        )}
      </div>
    </div>
  )
}
