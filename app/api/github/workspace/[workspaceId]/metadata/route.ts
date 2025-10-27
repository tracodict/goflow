import { parseGitHubWorkspaceId } from "@/lib/workspace/id"

export async function GET(request: Request, { params }: { params: { workspaceId: string } }) {
  const workspaceId = params.workspaceId
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