"use client"
import { FlowWorkspace } from "@/components/petri/flow-workspace"

export default function Page() {
  return (
    <main className="min-h-screen w-full bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-screen-2xl px-4 py-4 md:py-6">
        <header className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Petri Net Visual Modeller & Simulator</h1>
            <p className="text-sm text-neutral-600">
              Model places, transitions, and arcs. Simulate token flow, and monitor cases, tokens, and workitems.
            </p>
          </div>
        </header>
        <FlowWorkspace />
      </div>
    </main>
  )
}
