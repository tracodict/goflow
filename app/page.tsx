import { FlowWorkspace } from "@/components/petri/flow-workspace"
import { SuppressResizeObserverError } from "@/components/util/suppress-ro-error"
import RunMain from "@/components/run/main"

// Server component wrapper (async to support awaited searchParams in newer Next.js versions)
export default async function Page({ searchParams }: { searchParams?: Record<string, any> | Promise<Record<string, any>> }) {
  const resolved = searchParams && typeof (searchParams as any).then === 'function'
    ? await (searchParams as Promise<Record<string, any>>)
    : (searchParams as Record<string, any> | undefined) || {}
  const getFirst = (v: any) => (Array.isArray(v) ? v[0] : v)
  const mode = (getFirst(resolved.mode) as string) || ''
  const workflowId = (getFirst(resolved.workflow) as string) || null
  if (mode === 'run') {
    return (
      <main className="h-screen w-full bg-neutral-50 text-neutral-900">
        <SuppressResizeObserverError />
        <RunMain workflowId={workflowId} />
      </main>
    )
  }
  return (
    <main className="h-screen w-full bg-neutral-50 text-neutral-900">
      <SuppressResizeObserverError />
      <FlowWorkspace />
    </main>
  )
}
