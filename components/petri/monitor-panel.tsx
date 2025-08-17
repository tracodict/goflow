"use client"
import { useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Activity, Coins, Play, RotateCcw } from 'lucide-react'
import type { TransitionType } from '@/lib/petri-types'
import { TransitionIcon } from './transition-icon'

export interface MonitorPanelProps {
  open: boolean
  loading: boolean
  enabledTransitions: any[]
  marking: any
  onFire: (transitionId: string) => Promise<void> | void
  onStep: () => Promise<void> | void
  onReset: () => Promise<void> | void
  onRefresh: () => Promise<void> | void
}

export function MonitorPanel({ open, loading, enabledTransitions, marking, onFire, onStep, onReset, onRefresh }: MonitorPanelProps) {
  if (!open) return null
  const enabled = enabledTransitions
  const serverMarking = marking

  const handleFire = useCallback(async (t: any) => {
    await onFire(t.transitionId || t.id)
  }, [onFire])

  return (
    <div className="flex h-full flex-col p-3">
      <ScrollArea className="h-full">
        <div className="space-y-4 pr-2">
          <section>
            <div className="mb-2 text-xs font-semibold text-neutral-600">Enabled Transitions</div>
            {loading ? (
              <div className="text-xs text-neutral-500">Loading...</div>
            ) : enabled.length === 0 ? (
              <div className="text-xs text-neutral-500">No transitions enabled</div>
            ) : (
              <div className="grid gap-2">
                {enabled.map((t) => (
                  <div key={t.id || t.transitionId} className="flex items-center justify-between rounded-md border px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <TransitionIcon tType={((t.data ? t.data.tType : t.tType) || 'manual') as TransitionType} className="h-3.5 w-3.5" />
                      <span className="text-xs">{t.data ? t.data.name : t.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleFire(t)}
                    >
                      Fire
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <div className="mb-2 text-xs font-semibold text-neutral-600">Tokens by Place</div>
            <div className="grid gap-2">
              {serverMarking && typeof serverMarking === 'object'
                ? Object.entries(serverMarking).map(([place, tokens]: [string, unknown]) => {
                    const tokenArr = Array.isArray(tokens) ? (tokens as any[]) : []
                    return (
                      <div key={place} className="rounded-md bg-neutral-50 px-2 py-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{place}</span>
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Coins className="h-3 w-3 text-amber-600" aria-hidden />
                            {tokenArr.length}
                          </Badge>
                        </div>
                        {tokenArr.length > 0 && (
                          <ul className="ml-2 mt-1 space-y-0.5">
                            {tokenArr.map((tok, idx) => (
                              <li key={idx} className="flex items-center gap-2 text-xs text-neutral-700">
                                <span className="font-mono">{JSON.stringify(tok.value)}</span>
                                <span className="text-[10px] text-neutral-400">{
                                  (() => {
                                    const d = new Date(tok.timestamp)
                                    const pad = (n: number) => n.toString().padStart(2, '0')
                                    return `${d.getFullYear().toString().slice(2)}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
                                  })()
                                }</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })
                : <div className="text-xs text-neutral-500">No marking data</div>
              }
            </div>
          </section>
        </div>
      </ScrollArea>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button size="sm" variant="secondary" onClick={onStep} disabled={loading}>
          <Play className="mr-1.5 h-4 w-4" aria-hidden /> Step
        </Button>
        <Button size="sm" variant="outline" onClick={onReset} disabled={loading}>
          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden /> Reset
        </Button>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
      </div>
    </div>
  )
}
