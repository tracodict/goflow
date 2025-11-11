"use client"
import React, { useEffect, useRef, useState } from 'react'
import { Paperclip, Send } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ModelInfo } from './llm'

interface McpPrompt {
  name: string
  description?: string
  baseUrl: string
  serverName?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

interface PromptArgument {
  name: string
  value: string
}

export function Composer({
  onSubmit,
  onUpload,
  model,
  setModel,
  models,
  onCloseSession,
}: {
  onSubmit: (text: string, mcpPrompt?: { name: string; args: Record<string, any> }) => Promise<void> | void
  onUpload: (files: File[]) => Promise<void> | void
  model: string
  setModel: (m: string) => void
  models: ModelInfo[]
  onCloseSession?: () => void
}) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [prompts, setPrompts] = useState<McpPrompt[]>([])
  const [showPrompts, setShowPrompts] = useState(false)
  const [promptFilter, setPromptFilter] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState<McpPrompt | null>(null)
  const [promptArgs, setPromptArgs] = useState<PromptArgument[]>([])
  const [showArgDialog, setShowArgDialog] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLFormElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [width, setWidth] = useState<number>(0)
  const showHint = width >= 400
  const showModel = width >= 250

  // Load MCP prompts on mount
  useEffect(() => {
    async function loadPrompts() {
      try {
        const res = await fetch('/api/mcp-cache?type=prompts')
        const data = await res.json()
        console.log('[Composer] MCP cache response:', data)
        if (data.success && Array.isArray(data.data)) {
          setPrompts(data.data)
          console.log('[Composer] Loaded', data.data.length, 'prompts')
        } else {
          console.log('[Composer] No prompts in response')
        }
      } catch (err) {
        console.error('[Composer] Failed to load prompts:', err)
      }
    }
    loadPrompts()
    
    // Retry after a delay in case cache is being loaded
    const retryTimer = setTimeout(() => {
      loadPrompts()
    }, 2000)
    
    return () => clearTimeout(retryTimer)
  }, [])

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
    
    // Check if this is a prompt command
    const promptMatch = text.match(/^\/(\w+)\s*/)
    if (promptMatch) {
      const promptName = promptMatch[1]
      const prompt = prompts.find(p => p.name === promptName)
      
      if (prompt && prompt.arguments && prompt.arguments.length > 0) {
        // Show argument collection dialog
        setSelectedPrompt(prompt)
        setPromptArgs(prompt.arguments.map(arg => ({ name: arg.name, value: '' })))
        setShowArgDialog(true)
        return
      }
    }
    
    setPending(true)
    try {
      await onSubmit(text)
      setText('')
      setShowPrompts(false)
    } finally {
      setPending(false)
    }
  }

  const submitWithPrompt = async () => {
    if (!selectedPrompt) return
    
    const args: Record<string, any> = {}
    for (const arg of promptArgs) {
      args[arg.name] = arg.value
    }
    
    setPending(true)
    try {
      await onSubmit(text, { name: selectedPrompt.name, args })
      setText('')
      setShowPrompts(false)
      setShowArgDialog(false)
      setSelectedPrompt(null)
      setPromptArgs([])
    } finally {
      setPending(false)
    }
  }

  const cancelPrompt = () => {
    setShowArgDialog(false)
    setSelectedPrompt(null)
    setPromptArgs([])
  }

  const handleTextChange = (value: string) => {
    setText(value)
    
    // Check if user typed '/' at the beginning
    if (value === '/') {
      setShowPrompts(true)
      setPromptFilter('')
    } else if (value.startsWith('/') && !value.includes(' ')) {
      setShowPrompts(true)
      setPromptFilter(value.slice(1))
    } else {
      setShowPrompts(false)
    }
  }

  const selectPrompt = (prompt: McpPrompt) => {
    setText(`/${prompt.name} `)
    setShowPrompts(false)
    textareaRef.current?.focus()
  }

  const filteredPrompts = prompts.filter(p => 
    p.name.toLowerCase().includes(promptFilter.toLowerCase()) ||
    p.description?.toLowerCase().includes(promptFilter.toLowerCase())
  )

  // ...existing code...
  // Add close session button left of attach files
  // Accepts optional onCloseSession prop
  return (
    <>
      {/* Argument Collection Dialog */}
      {showArgDialog && selectedPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Prompt Arguments: {selectedPrompt.name}</h3>
            {selectedPrompt.description && (
              <p className="text-sm text-muted-foreground mb-4">{selectedPrompt.description}</p>
            )}
            
            <div className="space-y-4 mb-6">
              {selectedPrompt.arguments?.map((arg, idx) => (
                <div key={arg.name} className="space-y-2">
                  <Label htmlFor={`arg-${arg.name}`} className="text-sm font-medium">
                    {arg.name}
                    {arg.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {arg.description && (
                    <p className="text-xs text-muted-foreground">{arg.description}</p>
                  )}
                  <Input
                    id={`arg-${arg.name}`}
                    value={promptArgs[idx]?.value || ''}
                    onChange={(e) => {
                      const newArgs = [...promptArgs]
                      newArgs[idx] = { name: arg.name, value: e.target.value }
                      setPromptArgs(newArgs)
                    }}
                    placeholder={`Enter ${arg.name}...`}
                    required={arg.required}
                  />
                </div>
              ))}
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={cancelPrompt}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submitWithPrompt}
                disabled={pending || selectedPrompt.arguments?.some((arg, idx) => 
                  arg.required && !promptArgs[idx]?.value
                )}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <form
        ref={containerRef}
        className="flex flex-col gap-2 rounded border border-neutral-200 p-2 bg-white"
        onSubmit={(e) => {
          e.preventDefault()
          void doSubmit()
        }}
      >
      {/* Row 1: Text area */}
      <div className="w-full relative">
        <textarea
          ref={textareaRef}
          className="w-full rounded p-2 text-sm min-h-[48px] border-0 focus:outline-none focus:ring-0 bg-transparent"
          rows={3}
          placeholder="Type a message… (/ for prompts)"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowPrompts(false)
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void doSubmit()
            }
          }}
        />
        
        {/* Prompt suggestions dropdown */}
        {showPrompts && filteredPrompts.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-full max-w-md bg-white border rounded-lg shadow-lg z-50 max-h-[300px] overflow-auto">
            <Command>
              <CommandList>
                <CommandGroup heading="Available Prompts">
                  {filteredPrompts.map((prompt) => (
                    <CommandItem
                      key={prompt.name}
                      onSelect={() => selectPrompt(prompt)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="font-medium text-sm">/{prompt.name}</div>
                        {prompt.description && (
                          <div className="text-xs text-muted-foreground">{prompt.description}</div>
                        )}
                        {prompt.serverName && (
                          <div className="text-[10px] text-muted-foreground">from {prompt.serverName}</div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {filteredPrompts.length === 0 && (
                  <CommandEmpty>No prompts found.</CommandEmpty>
                )}
              </CommandList>
            </Command>
          </div>
        )}
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
                <option key={m.name} value={m.name}>
                  {m.label}
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
          {/* Close session button, only if onCloseSession prop is provided */}
          {typeof (onCloseSession) === 'function' && (
            <button
              type="button"
              title="Close session"
              className="size-9 rounded-full border flex items-center justify-center hover:bg-yellow-50 text-yellow-700"
              onClick={() => onCloseSession()}
            >
              <span aria-label="close" title="Close">&#x274C;</span>
            </button>
          )}
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
    </>
  )
}
