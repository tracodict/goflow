"use client"
import { useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Coins, StepForward, FastForward, ChevronsRight, Undo2, RotateCcw, RefreshCcw } from 'lucide-react'
import type { TransitionType } from '@/lib/petri-types'
import { TransitionIcon } from './transition-icon'

export interface MonitorPanelProps {
  open: boolean
  loading: boolean
  fastForwarding?: boolean
  enabledTransitions: any[]
  marking: any
  globalClock?: number
  currentStep?: number
  onFire: (transitionId: string) => Promise<void> | void
  onStep: () => Promise<void> | void
  onFastForward: (steps: number) => Promise<void> | void
  onForwardToEnd: () => Promise<void> | void
  onRollback: () => Promise<void> | void
  onReset: () => Promise<void> | void
  onRefresh: () => Promise<void> | void
}

export function MonitorPanel({ open, loading, fastForwarding, enabledTransitions, marking, globalClock, currentStep, onFire, onStep, onFastForward, onForwardToEnd, onRollback, onReset, onRefresh }: MonitorPanelProps) {
  if (!open) return null
  const enabled = enabledTransitions
  const serverMarking = marking
  const [ffSteps, setFfSteps] = useState(10)

  const handleFire = useCallback(async (t: any) => {
    await onFire(t.transitionId || t.id)
  }, [onFire])

  return (
    <div className="flex h-full flex-col">
      {/* Clock / Step row */}
      <div className="flex items-center gap-4 border-b px-3 py-1 text-xs bg-neutral-50">
        <span className="font-medium" title="Global Clock">Global Clock: <span className="font-mono">{globalClock ?? 0}</span></span>
        <span className="font-medium" title="Current Step">Current Step: <span className="font-mono">{currentStep ?? 0}</span></span>
      </div>
      {/* Controls row */}
      <div className="flex items-center gap-2 border-b px-2 py-1 text-xs flex-wrap">
        <input
          type="number"
          className="h-6 w-16 rounded border px-1 text-xs"
          title="Fast forward steps"
          value={ffSteps}
          min={1}
          max={1000}
          onChange={e => setFfSteps(Math.max(1, Math.min(1000, Number(e.target.value)||1)))}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onStep} disabled={loading} title="Step">
          <StepForward className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onFastForward(ffSteps)} disabled={loading || fastForwarding} title="Fast Forward">
          <FastForward className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onForwardToEnd} disabled={loading || fastForwarding} title="Forward To End">
          <ChevronsRight className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRollback} title="Rollback (not supported)">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onReset} disabled={loading} title="Reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh} disabled={loading} title="Refresh">
          <RefreshCcw className="h-4 w-4" />
        </Button>
        {(loading || fastForwarding) && <span className="ml-2 text-[10px] text-emerald-600">{fastForwarding ? 'Fast forwarding…' : 'Loading…'}</span>}
      </div>
      <ScrollArea className="h-full p-3">
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
                            {tokenArr.map((tok, idx) => {
                              let full = ''
                              try { full = JSON.stringify(tok.value) } catch { full = String(tok.value) }
                              if (full == null) full = ''
                              const truncated = full.length > 20 ? full.slice(0,20) + '...' : full
                              return (
                                <li key={idx} className="flex items-center gap-2 text-xs text-neutral-700">
                                  <span className="font-mono" title={full}>{truncated}</span>
                                  <span className="text-[10px] text-neutral-400">Timed {typeof tok.timestamp === 'number' ? tok.timestamp : 0}</span>
                                </li>
                              )
                            })}
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
    </div>
  )
}
