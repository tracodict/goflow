import { parseGitHubWorkspaceId } from "@/lib/workspace/id"

const provider = (process.env.WORKSPACE_PROVIDER || "github") as "github" | "fs"

type ParamsArg = { workspaceId?: string }

export async function GET(request: Request, context?: { params?: ParamsArg | Promise<ParamsArg> }) {
  // Next.js may sometimes call route handlers without the second argument in some environments.
  // Safely extract workspaceId from context.params when available, awaiting the promise when
  // provided, otherwise fall back to the request URL path (last segment) and decode it.
  const rawParams = context?.params
  let resolvedParams: ParamsArg | undefined

  if (rawParams) {
    if (typeof (rawParams as any).then === "function") {
      resolvedParams = await rawParams as ParamsArg
    } else {
      resolvedParams = rawParams as ParamsArg
    }
  }

  const workspaceId = resolvedParams?.workspaceId ?? decodeURIComponent(new URL(request.url).pathname.split("/").filter(Boolean).pop() || "")
  if (!workspaceId) {
    return Response.json({ error: 'Missing workspaceId' }, { status: 400 })
  }
  if (provider === "github") {
    try {
      const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)
      return Response.json({
        provider: "github",
        workspaceId,
        owner,
        repo,
        branch
      })
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 })
    }
  }
  // FS provider placeholder
  return Response.json({ error: "Local workspace provider not implemented yet" }, { status: 501 })
}