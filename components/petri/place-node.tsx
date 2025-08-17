"use client"
import { useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Badge } from "@/components/ui/badge"
import { Coins, Play, Square } from "lucide-react"
import type { PetriNodeData, PlaceData } from "@/lib/petri-types"

export function PlaceNode({ id, data, selected }: NodeProps) {
  const [hoverLeft, setHoverLeft] = useState(false)
  const [hoverRight, setHoverRight] = useState(false)
  const place = data as PlaceData

  const openTokens = () => {
    const evt = new CustomEvent("openPlaceTokens", { detail: { placeId: id } })
    window.dispatchEvent(evt)
  }

  return (
    <div className="group flex select-none flex-col items-center">
      <div
        className={[
          "relative grid h-20 w-20 place-items-center bg-white",
          selected ? "border-emerald-600 ring-2 ring-emerald-200" : "border-neutral-300",
        ].join(" ")}
        style={{ borderRadius: "50%", borderWidth: 2, borderStyle: "solid", borderColor: selected ? "#059669" : "#d1d5db" }}
        role="figure"
        aria-label={`Place ${place.name}`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openTokens()
          }}
          className="absolute -top-2 -right-2"
          aria-label={`Open tokens for ${place.name}`}
          title="View tokens"
          style={{zIndex:2}}
        >
          <Badge variant="outline" className="flex items-center gap-1 bg-white text-xs">
            <Coins className="h-3 w-3 text-amber-600" aria-hidden />
            {place.tokens ?? 0}
          </Badge>
        </button>

        {/* Start/End icons */}
        {place.isStart && (
          <Play size={18} className="absolute left-2 top-2 text-green-600 bg-white rounded-full p-0.5 shadow" style={{zIndex:2}} aria-label="Start" />
        )}
        {place.isEnd && (
          <Square size={18} className="absolute right-2 bottom-2 text-blue-600 bg-white rounded p-0.5 shadow" style={{zIndex:2}} aria-label="End" />
        )}

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
            zIndex:3
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
            zIndex:3
          }}
        />
      </div>
      <div className="mt-1 rounded px-1 text-xs text-neutral-700">{place.name || "Place"}</div>
    </div>
  )
}

PlaceNode.defaultProps = {
  data: { kind: "place", name: "Place", tokens: 0 },
}
