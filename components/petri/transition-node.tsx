"use client"

import type React from "react"
import { useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Hand, Bot, MessageSquare, Timer, Brain, Sparkles } from "lucide-react"
import type { PetriNodeData, TransitionType } from "@/lib/petri-sim"

const typeIconMap: Record<TransitionType, React.ReactNode> = {
  manual: <Hand className="h-4 w-4 text-emerald-700" aria-label="manual" />,
  auto: <Bot className="h-4 w-4 text-emerald-700" aria-label="auto" />,
  message: <MessageSquare className="h-4 w-4 text-emerald-700" aria-label="message" />,
  timer: <Timer className="h-4 w-4 text-emerald-700" aria-label="timer" />,
  dmn: <Brain className="h-4 w-4 text-emerald-700" aria-label="dmn" />,
  llm: <Sparkles className="h-4 w-4 text-emerald-700" aria-label="llm" />,
}

export function TransitionNode({ data, selected }: NodeProps<PetriNodeData>) {
  const [hoverLeft, setHoverLeft] = useState(false)
  const [hoverRight, setHoverRight] = useState(false)

  return (
    <div
      className={[
        "group relative w-48 rounded-md border-2 bg-white px-3 py-2 text-sm",
        selected ? "border-emerald-600 ring-2 ring-emerald-200" : "border-neutral-300",
      ].join(" ")}
      role="group"
      aria-label={`Transition ${data.name}`}
    >
      <div className="pointer-events-none absolute left-1 top-1">
        {typeIconMap[(data.tType as TransitionType) || "manual"]}
      </div>
      <div className="flex items-center justify-center">
        <div className="truncate text-neutral-800">{data.name || "Transition"}</div>
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
  data: { kind: "transition", name: "Transition", tType: "manual" },
}
