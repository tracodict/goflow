"use client"

import type React from "react"
import { useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Hand, Bot, MessageSquare, Timer, Brain, Code, Wrench } from "lucide-react"
import type { PetriNodeData, TransitionType } from "@/lib/petri-types"
import { Badge } from "@/components/ui/badge"

const typeIconMap: Record<TransitionType, React.ReactNode> = {
  Manual: <Hand className="h-4 w-4 text-emerald-700" aria-label="manual" />,
  Auto: <Bot className="h-4 w-4 text-emerald-700" aria-label="auto" />,
  Message: <MessageSquare className="h-4 w-4 text-emerald-700" aria-label="message" />,
  LLM: <Brain className="h-4 w-4 text-emerald-700" aria-label="llm" />,
  Tools: <Wrench className="h-4 w-4 text-emerald-700" aria-label="tools" />,
}

export function TransitionNode({ id, data, selected }: NodeProps<any>) {
  const [hoverLeft, setHoverLeft] = useState(false)
  const [hoverRight, setHoverRight] = useState(false)
  const tData = data as any
  const guardExpression: string = tData.guardExpression ?? ""
  const time = (tData.time || {}) as { cron?: string; delaySec?: number }
  const hasTime = (time.cron && time.cron.trim().length > 0) || (typeof time.delaySec === 'number' && time.delaySec > 0)
  const trimmed = guardExpression.trim()
  const hasGuard = trimmed.length > 0
  const displayGuard = trimmed.length > 20 ? `${trimmed.slice(0, 20)}...` : trimmed

  const openGuard = () => {
    const evt = new CustomEvent("openTransitionGuard", { detail: { transitionId: id } })
    window.dispatchEvent(evt)
  }

  return (
    <div
      className={[
        "group relative w-48 rounded-md border-2 bg-white px-3 py-2 text-sm",
        selected ? "border-emerald-600 ring-2 ring-emerald-200" : "border-neutral-300",
      ].join(" ")}
      role="group"
      aria-label={`Transition ${tData.name}`}
    >
      {/* Type icon inside the card */}
      <div className="pointer-events-none absolute left-1 top-1">
        {typeIconMap[(tData.tType as TransitionType) || "manual"]}
      </div>

      {hasGuard && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openGuard()
          }}
          className="absolute -top-6 -left-2"
          aria-label={`Edit guard for ${tData.name || "Transition"}`}
          title="Edit guard expression"
        >
          <Badge variant="outline" className="flex max-w-[180px] items-center gap-1 bg-white text-xs">
            <Code className="h-3 w-3 text-emerald-700" aria-hidden />
            <span className="truncate">{displayGuard}</span>
          </Badge>
        </button>
      )}
      {hasTime && (
        <div className="pointer-events-none absolute -bottom-6 -left-2" aria-label="timer trigger" title="Time trigger active">
          <Badge variant="outline" className="flex items-center gap-1 bg-white text-xs">
            <Timer className="h-3 w-3 text-emerald-700" aria-hidden />
          </Badge>
        </div>
      )}

      <div className="flex items-center justify-center">
        <div className="truncate text-neutral-800">{tData.name || "Transition"}</div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!bg-neutral-400 rounded-full border border-white cursor-crosshair"
        onMouseEnter={() => setHoverLeft(true)}
        onMouseLeave={() => setHoverLeft(false)}
        style={{
          width: hoverLeft ? 14 : 8,
          height: hoverLeft ? 14 : 8,
          transition: "width 120ms ease, height 120ms ease, box-shadow 120ms ease",
          boxShadow: hoverLeft ? "0 0 0 3px rgba(16,185,129,0.25)" : "none",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-neutral-400 rounded-full border border-white cursor-crosshair"
        onMouseEnter={() => setHoverRight(true)}
        onMouseLeave={() => setHoverRight(false)}
        style={{
          width: hoverRight ? 14 : 8,
          height: hoverRight ? 14 : 8,
          transition: "width 120ms ease, height 120ms ease, box-shadow 120ms ease",
          boxShadow: hoverRight ? "0 0 0 3px rgba(16,185,129,0.25)" : "none",
        }}
      />
    </div>
  )
}

TransitionNode.defaultProps = {
  data: { kind: "transition", name: "Transition", tType: "manual"},
}
