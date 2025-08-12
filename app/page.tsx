"use client"
import { FlowWorkspace } from "@/components/petri/flow-workspace"
import { SuppressResizeObserverError } from "@/components/util/suppress-ro-error"

export default function Page() {
  return (
    <main className="h-screen w-full bg-neutral-50 text-neutral-900">
      <SuppressResizeObserverError />
      <FlowWorkspace />
    </main>
  )
}
