"use client"
import React from 'react'
import type { ChatMessage } from './types'

// Default: render as plain pre-wrapped text; support code blocks later as needed
export function DefaultMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="text-sm whitespace-pre-wrap">
      {msg.content}
    </div>
  )
}

// vComponents-based rendering (schema-driven)
// Expect msg.content to contain JSON that conforms to our vComponent schema
export function VComponentMessage({ msg }: { msg: ChatMessage }) {
  try {
    const json = JSON.parse(msg.content)
    // TODO: map json to actual vComponents registry; for now, show as JSON preview
    return <pre className="text-xs bg-neutral-50 border rounded p-2 overflow-auto">{JSON.stringify(json, null, 2)}</pre>
  } catch {
    return <DefaultMessage msg={msg} />
  }
}
