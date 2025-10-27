export interface GitHubWorkspaceId {
  owner: string
  repo: string
  branch: string
}

export function buildGitHubWorkspaceId(params: GitHubWorkspaceId): string {
  // Format: github:owner|repo@branch
  return `github:${params.owner}|${params.repo}@${params.branch}`
}

export function encodeWorkspaceId(id: string): string {
  return encodeURIComponent(id)
}

export function decodeWorkspaceId(id: string): string {
  return decodeURIComponent(id)
}

export function parseGitHubWorkspaceId(workspaceId: string): GitHubWorkspaceId {
  const decoded = decodeWorkspaceId(workspaceId)
  if (!decoded.startsWith("github:")) {
    throw new Error(`Invalid workspace id: ${workspaceId}`)
  }
  const withoutPrefix = decoded.slice("github:".length)
  const branchSeparatorIndex = withoutPrefix.lastIndexOf('@')
  if (branchSeparatorIndex === -1) {
    throw new Error(`Invalid workspace id: ${workspaceId}`)
  }
  const repoPart = withoutPrefix.slice(0, branchSeparatorIndex)
  const branch = withoutPrefix.slice(branchSeparatorIndex + 1)
  const [owner, repo] = repoPart.split('|')
  if (!owner || !repo || !branch) {
    throw new Error(`Invalid workspace id: ${workspaceId}`)
  }
  return { owner, repo, branch }
}