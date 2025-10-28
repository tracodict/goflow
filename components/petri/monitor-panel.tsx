import { useCallback, useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Coins, StepForward, Play, RefreshCcw, Trash2, RotateCcw } from 'lucide-react'
import type { TransitionType } from '@/lib/petri-types'
import { TransitionIcon } from './transition-icon'

export interface MonitorPanelProps {
  open: boolean
  loading: boolean
  running?: boolean
  enabledTransitions: any[]
  marking: any
  currentStep?: number
  stepLimit: number
  onChangeStepLimit: (n: number) => void
  onStep: () => Promise<void> | void
  onRun: () => Promise<void> | void
  onRefresh: () => Promise<void> | void
  onDelete: () => Promise<void> | void
  onReset?: () => Promise<void> | void
  onFireTransition?: (transitionId: string, bindingIndex: number) => Promise<void> | void
}

export function MonitorPanel({ open, loading, running, enabledTransitions, marking, currentStep, stepLimit, onChangeStepLimit, onStep, onRun, onRefresh, onDelete, onReset, onFireTransition }: MonitorPanelProps) {
  const enabled = enabledTransitions // still list enabled transitions for manual firing if present
  const serverMarking = marking
  const [localLimit, setLocalLimit] = useState(stepLimit)
  useEffect(()=> { setLocalLimit(stepLimit) }, [stepLimit])
  const applyLimit = () => { if (localLimit>0) onChangeStepLimit(localLimit) }

  return (
    <div className="flex h-full flex-col">
      {/* Clock / Step row */}
      <div className="flex items-center gap-4 border-b px-3 py-1 text-xs bg-neutral-50">
        <span className="font-medium" title="Current Step">Step: <span className="font-mono">{currentStep ?? 0}</span></span>
      </div>
      {/* Controls row */}
      <div className="flex items-center gap-2 border-b px-2 py-1 text-xs flex-wrap">
        <input type="number" className="h-6 w-16 rounded border px-1 text-xs" title="Step limit" value={localLimit} min={1} max={10000} onChange={e=> setLocalLimit(Math.max(1, Math.min(10000, Number(e.target.value)||1)))} onBlur={applyLimit} />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onStep} disabled={loading || running} title="Single Step">
          <StepForward className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRun} disabled={loading || running} title="Run (auto until quiescent or limit)">
          <Play className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh} disabled={loading} title="Refresh">
          <RefreshCcw className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onReset} disabled={loading || running} title="Reset to Initial Marking">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={onDelete} disabled={loading || running} title="Delete Simulation">
          <Trash2 className="h-4 w-4" />
        </Button>
        {(loading || running) && <span className="ml-2 text-[10px] text-emerald-600">{running ? 'Running…' : 'Loading…'}</span>}
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
                  <button
                    key={t.id || t.transitionId}
                    className="flex items-center justify-between rounded-md border px-2 py-1.5 hover:bg-neutral-50 cursor-pointer text-left"
                    onClick={() => onFireTransition?.(t.id || t.transitionId, 0)}
                    disabled={loading || running}
                    title={`Click to fire transition: ${t.data ? t.data.name : t.name}`}
                  >
                    <div className="flex items-center gap-2">
                      <TransitionIcon tType={((t.data ? t.data.tType : t.tType) || 'manual') as TransitionType} className="h-3.5 w-3.5" />
                      <span className="text-xs">{t.data ? t.data.name : t.name}</span>
                    </div>
                  </button>
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
