export type WorkspaceProvider = 'github' | 'fs'

export function getWorkspaceProvider(): WorkspaceProvider {
  const value = (process.env.WORKSPACE_PROVIDER || 'github').toLowerCase()
  if (value === 'fs') {
    return 'fs'
  }
  return 'github'
}
