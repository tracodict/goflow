"use client"
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react"
import type { PetriEdgeData } from "@/lib/petri-sim"

export function LabeledEdge(props: EdgeProps<PetriEdgeData>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style = {},
    selected,
    data,
  } = props

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...style, strokeWidth: selected ? 2.5 : 1.5, stroke: selected ? "#059669" : "#64748b" }}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className={[
            "rounded border bg-white px-1.5 py-0.5 text-xs",
            selected ? "border-emerald-600 text-emerald-700" : "border-neutral-300 text-neutral-700",
          ].join(" ")}
        >
          {data?.label || "arc"}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

LabeledEdge.defaultProps = {
  data: { label: "arc" },
}
