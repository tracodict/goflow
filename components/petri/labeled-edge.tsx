"use client"
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react"

export function LabeledEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd } = props as any
  const selected = (props as any).selected
  const style: any = (props as any).style || {}
  const data: any = (props as any).data || {}

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

    let displayExpr = data?.expression?.trim() || ''
    // Basic sanitation: disallow lone assignments like `x.a = 33;` which server rejects; hint user to return value
    if (/^[A-Za-z_][\w\.]*\s*=\s*[^=].*;?$/.test(displayExpr) && !/return\s+/i.test(displayExpr)) {
      displayExpr = '(invalid expr)'
    }
    const rawLabel: string = displayExpr ? displayExpr : (data?.label || 'arc')
  const finalLabel = rawLabel.length > 15 ? rawLabel.slice(0, 12) + '...' : rawLabel

  return (
    <>
      <BaseEdge id={id as string} path={edgePath} style={{ ...(style || {}), strokeWidth: selected ? 2.5 : 1.5, stroke: selected ? "#059669" : "#64748b" }} markerEnd={markerEnd} />
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
          title={rawLabel}
        >
          {finalLabel}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

LabeledEdge.defaultProps = {
  data: { label: "arc" },
}
