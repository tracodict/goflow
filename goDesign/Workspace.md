# Workspace Provider Architecture

## Overview
GoFlow workspaces now integrate with a provider abstraction that defaults to GitHub but can be extended to other backends. Use the `WORKSPACE_PROVIDER` environment variable to select the backing service while keeping the client API stable. When `WORKSPACE_PROVIDER=github`, the system uses Octokit.js to interact with GitHub repositories for version-controlled storage of all GoFlow artifacts (pages, datasources, queries, workflows, schemas, and MCP tools). When set to `fs`, the façade exposes placeholder file system APIs that will be implemented in the future.

## Architecture

### Technology Stack
- **GitHub Integration**: `@octokit/rest` (Octokit.js)
- **Authentication**: OAuth 2.0 (GitHub Apps or OAuth Apps)
- **Client-side**: React components for file explorer and dialogs
- **Server-side**: Next.js API routes behind provider-specific implementations

### Provider Abstraction
- **Environment Flag**: `WORKSPACE_PROVIDER` (`github` | `fs`, default: `github`). Expose the same value to the browser via `NEXT_PUBLIC_WORKSPACE_PROVIDER` so client stores can stay in sync with the server configuration.
- **Public API Base**: `/api/ws` delegates requests to the active provider.
- **Provider Routing**:

| Provider | Internal Handler | Notes |
| --- | --- | --- |
| `github` | `/api/github/workspace/[workspaceId]/…` | Backed by Octokit and Git repositories. |
| `fs` | `/api/fs/workspace/[workspaceId]/…` (placeholder) | Stub endpoints return `501` until implemented. |

- **Workspace Identifier (`workspaceId`)**: For GitHub, compose `workspaceId = encodeURIComponent(`${owner}/${repo}@${branch}`)` so the value can safely live inside a URL segment. The branch portion represents the active working branch (e.g., an ephemeral temp branch). Future providers can define their own canonical formats while satisfying the same contract.

### API Facade (`/api/ws`)
- Create dynamic Next.js route handlers in `app/api/ws/[workspaceId]/…` that dispatch to the active provider based on `process.env.WORKSPACE_PROVIDER`.
- Providers expose the same sub-route contract: `open`, `init-folders`, `tree`, `file`, and `save`.
- Example dispatcher for the `open` endpoint:

```typescript
// app/api/ws/[workspaceId]/open/route.ts
import { POST as githubOpen } from '@/app/api/github/workspace/[workspaceId]/open/route'
import { POST as fsOpen } from '@/app/api/fs/workspace/[workspaceId]/open/route'

const provider = (process.env.WORKSPACE_PROVIDER || 'github') as 'github' | 'fs'

export async function POST(request: Request, context: { params: { workspaceId: string } }) {
  if (provider === 'github') return githubOpen(request, context)
  return fsOpen(request, context)
}
```

- Placeholder FS implementations should live in `app/api/fs/workspace/[workspaceId]/…` and return `Response.json({ error: 'Not implemented' }, { status: 501 })` until the file-system backend ships.

### File Structure Conventions
```
<repository-root>/
├── .goflow/
│   ├── config.json          # Workspace configuration
│   └── temp-branch.txt      # Current temp branch name
├── Pages/                   # Page definitions
│   ├── home.page            # Page builder definition
│   ├── dashboard/
│   │   └── index.page       # Nested page (route: /dashboard)
│   └── products/
│       └── [id].page        # Dynamic route page
├── DataSources/             # Data source definitions
│   ├── mongodb-prod.ds
│   └── gcs-bucket.ds
├── Queries/                 # Query definitions
│   ├── user-list.qry
│   └── product-search.qry
├── Workflows/               # Workflow (Petri net) definitions
│   └── order-processing.cpn
├── Schemas/                 # Color/schema definitions
│   ├── user.color
│   └── order.color
└── MCPTools/                # MCP tool configurations
    └── code-analyzer.mcp
```

## 1. GitHub Authentication

### OAuth 2.0 Flow

#### Server-side API Routes (`/api/github/`)

**`/api/github/auth/login`** - Initiate OAuth flow
```typescript
// GET /api/github/auth/login
// Redirects to GitHub OAuth authorization page
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/github/auth/callback`
  
  const authUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${process.env.GITHUB_CLIENT_ID}&` +
    `redirect_uri=${redirectUri}&` +
    `scope=repo,user:email&` +
    `state=${generateStateToken()}`
  
  return Response.redirect(authUrl)
}
```

**`/api/github/auth/callback`** - Handle OAuth callback
```typescript
// GET /api/github/auth/callback?code=xxx&state=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  // Verify state token
  if (!verifyStateToken(state)) {
    return Response.json({ error: 'Invalid state' }, { status: 400 })
  }
  
  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    })
  })
  
  const { access_token } = await tokenResponse.json()
  
  // Store token in session/cookie (encrypted)
  const session = await encryptAndStoreToken(access_token)
  
  // Redirect back to app
  return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?github_auth=success`)
}
```

**`/api/github/auth/status`** - Check authentication status
```typescript
// GET /api/github/auth/status
export async function GET(request: Request) {
  const token = await getTokenFromSession(request)
  
  if (!token) {
    return Response.json({ authenticated: false })
  }
  
  // Verify token with GitHub
  const octokit = new Octokit({ auth: token })
  try {
    const { data: user } = await octokit.rest.users.getAuthenticated()
    return Response.json({ authenticated: true, user })
  } catch (error) {
    return Response.json({ authenticated: false, error: 'Invalid token' })
  }
}
```

**`/api/github/auth/logout`** - Logout and clear session
```typescript
// POST /api/github/auth/logout
export async function POST(request: Request) {
  await clearSession(request)
  return Response.json({ success: true })
}
```

### Client-side Authentication Hook

**`hooks/use-github-auth.ts`**
```typescript
export function useGitHubAuth() {
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    checkAuthStatus()
  }, [])
  
  const checkAuthStatus = async () => {
    const res = await fetch('/api/github/auth/status')
    const data = await res.json()
    setUser(data.authenticated ? data.user : null)
    setLoading(false)
  }
  
  const login = () => {
    window.location.href = '/api/github/auth/login'
  }
  
  const logout = async () => {
    await fetch('/api/github/auth/logout', { method: 'POST' })
    setUser(null)
  }
  
  return { user, loading, authenticated: !!user, login, logout }
}
```

## 2. File Menu Integration

### Menu Structure
```typescript
// components/builder/FileMenu.tsx
const fileMenuItems = [
  { id: 'open-workspace', label: 'Open Workspace...', icon: FolderOpen, shortcut: 'Ctrl+K Ctrl+O' },
  { id: 'save-workspace', label: 'Save Workspace', icon: Save, shortcut: 'Ctrl+S', disabled: !hasWorkspace },
  { id: 'close-workspace', label: 'Close Workspace', icon: FolderX, disabled: !hasWorkspace },
  { type: 'separator' },
  { id: 'open-file', label: 'Open File...', icon: FileOpen, shortcut: 'Ctrl+O' },
  { id: 'save-file', label: 'Save File', icon: FileSave, shortcut: 'Ctrl+S', disabled: !hasActiveFile },
  { id: 'save-file-as', label: 'Save File As...', icon: FilePlus, disabled: !hasActiveFile },
  { type: 'separator' },
  { id: 'new-page', label: 'New Page', icon: FilePlus, folder: 'Pages' },
  { id: 'new-datasource', label: 'New Data Source', icon: Database, folder: 'DataSources' },
  { id: 'new-query', label: 'New Query', icon: Search, folder: 'Queries' },
  { id: 'new-workflow', label: 'New Workflow', icon: Workflow, folder: 'Workflows' },
  { id: 'new-schema', label: 'New Schema', icon: BookText, folder: 'Schemas' },
  { id: 'new-mcp-tool', label: 'New MCP Tool', icon: Wrench, folder: 'MCPTools' },
]
```

### File Menu Component
```typescript
export function FileMenu() {
  const { workspace, openWorkspace, saveWorkspace, closeWorkspace } = useWorkspace()
  const { githubAuth } = useGitHubAuth()
  
  const handleMenuAction = async (action: string) => {
    switch (action) {
      case 'open-workspace':
        await handleOpenWorkspace()
        break
      case 'save-workspace':
        await handleSaveWorkspace()
        break
      case 'close-workspace':
        await handleCloseWorkspace()
        break
      case 'open-file':
        await handleOpenFile()
        break
      case 'save-file':
        await handleSaveFile()
        break
      default:
        if (action.startsWith('new-')) {
          const folder = fileMenuItems.find(i => i.id === action)?.folder
          await handleNewFile(folder)
        }
    }
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">File</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {fileMenuItems.map(item => (
          item.type === 'separator' ? (
            <DropdownMenuSeparator key={item.id} />
          ) : (
            <DropdownMenuItem
              key={item.id}
              onClick={() => handleMenuAction(item.id)}
              disabled={item.disabled}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
              {item.shortcut && <span className="ml-auto text-xs">{item.shortcut}</span>}
            </DropdownMenuItem>
          )
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

## 3. Open Workspace Flow

### Workspace Dialog Component

**`components/workspace/OpenWorkspaceDialog.tsx`**
```typescript
export function OpenWorkspaceDialog({ open, onOpenChange }: DialogProps) {
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const { authenticated, login } = useGitHubAuth()
  const { openWorkspace } = useWorkspace()
  
  const handleOpen = async () => {
    if (!authenticated) {
      // Redirect to OAuth flow
      login()
      return
    }
    
    setLoading(true)
    try {
      // Parse repo URL: https://github.com/owner/repo
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
      if (!match) {
        throw new Error('Invalid GitHub repository URL')
      }
      
      const [, owner, repo] = match
      await openWorkspace({ owner, repo: repo.replace('.git', '') })
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: 'Failed to open workspace',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open GitHub Workspace</DialogTitle>
          <DialogDescription>
            Enter a GitHub repository URL to open as workspace
          </DialogDescription>
        </DialogHeader>
        
        {!authenticated ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need to authenticate with GitHub to access repositories
              </AlertDescription>
            </Alert>
            <Button onClick={login} className="w-full">
              <Github className="mr-2 h-4 w-4" />
              Sign in with GitHub
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Repository URL</Label>
              <Input
                placeholder="https://github.com/username/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleOpen} disabled={!repoUrl || loading}>
                {loading ? 'Opening...' : 'Open Workspace'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

## 4. Workspace State Management

### Workspace Store (Zustand)

**`stores/workspace-store.ts`**
```typescript
interface WorkspaceFile {
  path: string
  type: 'page' | 'datasource' | 'query' | 'workflow' | 'schema' | 'mcp'
  content: string
  sha: string // Git blob SHA for updates
  dirty: boolean // Has unsaved changes
}

type WorkspaceProvider = 'github' | 'fs'

interface WorkspaceState {
  provider: WorkspaceProvider
  workspaceId: string | null
  owner: string | null
  repo: string | null
  branch: string | null // Current temp branch
  baseBranch: string // Usually 'main'
  files: Map<string, WorkspaceFile>
  tree: FileTreeNode[]
  activeFile: string | null
  
  // Actions
  openWorkspace: (params: { owner: string; repo: string }) => Promise<void>
  closeWorkspace: () => void
  loadFileTree: () => Promise<void>
  openFile: (path: string) => Promise<void>
  saveFile: (path: string, content: string) => Promise<void>
  saveWorkspace: (commitMessage: string) => Promise<void>
  createFile: (folder: string, name: string) => Promise<void>
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  provider: (process.env.NEXT_PUBLIC_WORKSPACE_PROVIDER as WorkspaceProvider) || 'github',
  workspaceId: null,
  owner: null,
  repo: null,
  branch: null,
  baseBranch: 'main',
  files: new Map(),
  tree: [],
  activeFile: null,
  
  openWorkspace: async ({ owner, repo }) => {
    const tempBranch = `goflow-${Date.now()}`
    const workspaceId = buildGitHubWorkspaceId({ owner, repo, branch: tempBranch })
    const encodedId = encodeWorkspaceId(workspaceId)
    const basePath = `/api/ws/${encodedId}` // Delegates to the active workspace provider

    await fetch(`${basePath}/open`, {
      method: 'POST',
      body: JSON.stringify({ baseBranch: 'main' })
    })

    await fetch(`${basePath}/init-folders`, {
      method: 'POST'
    })

    const tree = await get().loadFileTree()

    set({ owner, repo, branch: tempBranch, workspaceId, baseBranch: 'main', tree })
  },
  
  closeWorkspace: () => {
    set({
      workspaceId: null,
      owner: null,
      repo: null,
      branch: null,
      files: new Map(),
      tree: [],
      activeFile: null
    })
  },
  
  loadFileTree: async () => {
    const { workspaceId } = get()
    if (!workspaceId) return []
  const basePath = `/api/ws/${encodeWorkspaceId(workspaceId)}`
  const res = await fetch(`${basePath}/tree`)
    const tree = await res.json()
    set({ tree })
    return tree
  },
  
  openFile: async (path: string) => {
    const { workspaceId, files } = get()
    if (!workspaceId) return
    const basePath = `/api/ws/${encodeWorkspaceId(workspaceId)}`
    
    if (files.has(path)) {
      set({ activeFile: path })
      return
    }
    
    const res = await fetch(`${basePath}/file?path=${encodeURIComponent(path)}`)
    const { content, sha } = await res.json()
    
    const type = getFileTypeFromPath(path)
    files.set(path, { path, type, content, sha, dirty: false })
    set({ files: new Map(files), activeFile: path })
  },
  
  saveFile: async (path: string, content: string) => {
    const { workspaceId, files } = get()
    if (!workspaceId) return
    const file = files.get(path)
    if (!file) return
    const basePath = `/api/ws/${encodeWorkspaceId(workspaceId)}`
    
    const res = await fetch(`${basePath}/file`, {
      method: 'PUT',
      body: JSON.stringify({ path, content, sha: file.sha })
    })
    
    const { sha: newSha } = await res.json()
    
    file.content = content
    file.sha = newSha
    file.dirty = false
    
    set({ files: new Map(files) })
  },
  
  saveWorkspace: async (commitMessage: string) => {
    const { workspaceId, baseBranch } = get()
    if (!workspaceId) return
    const basePath = `/api/ws/${encodeWorkspaceId(workspaceId)}`
    
    await fetch(`${basePath}/save`, {
      method: 'POST',
      body: JSON.stringify({ commitMessage, baseBranch })
    })
    
    toast({ title: 'Workspace saved', description: 'Changes merged to main branch' })
  },
  
  createFile: async (folder: string, name: string) => {
    const { workspaceId } = get()
    if (!workspaceId) return
    const extension = getFolderExtension(folder)
    const path = `${folder}/${name}.${extension}`
    const template = getFileTemplate(extension)
    const basePath = `/api/ws/${encodeWorkspaceId(workspaceId)}`
    
    await fetch(`${basePath}/file`, {
      method: 'POST',
      body: JSON.stringify({ path, content: template })
    })
    
    await get().loadFileTree()
    await get().openFile(path)
  }
}))

// Shared helper imported on both client and server modules
function buildWorkspaceId(params: { owner: string; repo: string; branch: string }) {
  return `${params.owner}/${params.repo}@${params.branch}`
}

function encodeWorkspaceId(id: string) {
  return encodeURIComponent(id)
}

function parseGitHubWorkspaceId(id: string) {
  const decoded = decodeURIComponent(id)
  const [repoPart, branch] = decoded.split('@')
  if (!branch) throw new Error(`Invalid workspace id: ${id}`)
  const [owner, repo] = repoPart.split('/')
  if (!owner || !repo) throw new Error(`Invalid workspace id: ${id}`)
  return { owner, repo, branch }
}

function getFileTypeFromPath(path: string): WorkspaceFile['type'] {
  if (path.endsWith('.page')) return 'page'
  if (path.endsWith('.ds')) return 'datasource'
  if (path.endsWith('.qry')) return 'query'
  if (path.endsWith('.cpn')) return 'workflow'
  if (path.endsWith('.color')) return 'schema'
  if (path.endsWith('.mcp')) return 'mcp'
  return 'page' // default
}

function getFolderExtension(folder: string): string {
  const map: Record<string, string> = {
    'Pages': 'page',
    'DataSources': 'ds',
    'Queries': 'qry',
    'Workflows': 'cpn',
    'Schemas': 'color',
    'MCPTools': 'mcp'
  }
  return map[folder] || 'page'
}

function getFileTemplate(extension: string): string {
  const templates: Record<string, string> = {
    'page': JSON.stringify({ components: [], layout: 'default' }, null, 2),
    'ds': JSON.stringify({ type: 'mongodb', config: {} }, null, 2),
    'qry': JSON.stringify({ query_type: 'sql', query: 'SELECT 1' }, null, 2),
    'cpn': JSON.stringify({ places: [], transitions: [], arcs: [] }, null, 2),
    'color': JSON.stringify({ name: '', fields: [] }, null, 2),
    'mcp': JSON.stringify({ command: '', args: [] }, null, 2),
  }
  return templates[extension] || '{}'
}
```

The façade-specific `workspaceId` ensures every API call carries enough context for the provider to locate repository and branch data. Client requests only need to pass file-relative information such as `path` or `commitMessage`; provider routes reconstruct `owner`, `repo`, and `branch` from the encoded identifier.

## 5. Server-side Workspace Providers

### GitHub Provider Routes

All GitHub routes now live under `/api/github/workspace/[workspaceId]/…` where `workspaceId` reflects the `owner/repo@branch` of the active session.

**`/api/github/workspace/[workspaceId]/open`**
```typescript
export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const token = await getTokenFromSession(request)
  const octokit = new Octokit({ auth: token })
  
  const workspaceId = params.workspaceId
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)
  const { baseBranch } = await request.json()
  const tempBranch = branch
  
  try {
    // Get base branch reference
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    })
    
    // Create temp branch from base
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${tempBranch}`,
      sha: ref.object.sha
    })
    
    return Response.json({ success: true, branch: tempBranch })
  } catch (error: any) {
    if (error.status === 404) {
      return Response.json({ error: 'Repository not found or access denied' }, { status: 404 })
    }
    throw error
  }
}
```

### API Route: Initialize Folder Structure

**`/api/github/workspace/[workspaceId]/init-folders`**
```typescript
export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const token = await getTokenFromSession(request)
  const octokit = new Octokit({ auth: token })
  
  const workspaceId = params.workspaceId
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)
  
  const folders = ['Pages', 'DataSources', 'Queries', 'Workflows', 'Schemas', 'MCPTools']
  
  for (const folder of folders) {
    try {
      // Check if folder exists
      await octokit.rest.repos.getContent({
        owner,
        repo,
        path: folder,
        ref: branch
      })
    } catch (error: any) {
      if (error.status === 404) {
        // Create folder with .gitkeep file
        await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: `${folder}/.gitkeep`,
          message: `Initialize ${folder} folder`,
          content: Buffer.from('').toString('base64'),
          branch
        })
      }
    }
  }
  
  return Response.json({ success: true })
}
```

### API Route: Get File Tree

**`/api/github/workspace/[workspaceId]/tree`**
```typescript
export async function GET(request: Request, { params }: { params: { workspaceId: string } }) {
  const token = await getTokenFromSession(request)
  const octokit = new Octokit({ auth: token })
  
  const workspaceId = params.workspaceId
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)
  
  // Get tree recursively
  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: '1'
  })
  
  // Filter to only GoFlow folders and build tree structure
  const goflowFolders = ['Pages', 'DataSources', 'Queries', 'Workflows', 'Schemas', 'MCPTools']
  const filteredTree = tree.tree
    .filter(item => 
      goflowFolders.some(folder => item.path?.startsWith(folder)) &&
      !item.path?.endsWith('.gitkeep')
    )
    .map(item => ({
      path: item.path,
      type: item.type,
      sha: item.sha,
      size: item.size
    }))
  
  // Build hierarchical tree
  const hierarchical = buildFileTree(filteredTree)
  
  return Response.json(hierarchical)
}

function buildFileTree(files: any[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  const folders = ['Pages', 'DataSources', 'Queries', 'Workflows', 'Schemas', 'MCPTools']
  
  folders.forEach(folder => {
    const folderFiles = files.filter(f => f.path.startsWith(folder + '/'))
    if (folderFiles.length > 0 || true) { // Always show folders
      root.push({
        name: folder,
        path: folder,
        type: 'directory',
        children: buildTreeRecursive(folderFiles, folder)
      })
    }
  })
  
  return root
}

function buildTreeRecursive(files: any[], basePath: string): FileTreeNode[] {
  const children: FileTreeNode[] = []
  const prefix = basePath + '/'
  
  // Group by immediate child
  const groups = new Map<string, any[]>()
  
  files.forEach(file => {
    const relativePath = file.path.slice(prefix.length)
    const parts = relativePath.split('/')
    const immediate = parts[0]
    
    if (!groups.has(immediate)) {
      groups.set(immediate, [])
    }
    groups.get(immediate)!.push(file)
  })
  
  groups.forEach((groupFiles, name) => {
    if (groupFiles.length === 1 && groupFiles[0].type === 'blob') {
      // Leaf file - strip extension for display
      const displayName = name.replace(/\.(page|ds|qry|cpn|color|mcp)$/, '')
      children.push({
        name: displayName,
        path: groupFiles[0].path,
        type: 'file',
        extension: name.split('.').pop()!,
        sha: groupFiles[0].sha
      })
    } else {
      // Directory
      children.push({
        name,
        path: basePath + '/' + name,
        type: 'directory',
        children: buildTreeRecursive(groupFiles, basePath + '/' + name)
      })
    }
  })
  
  return children.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'directory' ? -1 : 1
  })
}
```

### API Route: Read/Write File

**`/api/github/workspace/[workspaceId]/file`**
```typescript
// GET - Read file
export async function GET(request: Request, { params }: { params: { workspaceId: string } }) {
  const token = await getTokenFromSession(request)
  const octokit = new Octokit({ auth: token })
  
  const workspaceId = params.workspaceId
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')!
  
  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref: branch
  })
  
  if ('content' in data) {
    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    return Response.json({ content, sha: data.sha })
  }
  
  return Response.json({ error: 'Not a file' }, { status: 400 })
}

// PUT - Update file
export async function PUT(request: Request, { params }: { params: { workspaceId: string } }) {
  const token = await getTokenFromSession(request)
  const octokit = new Octokit({ auth: token })
  
  const workspaceId = params.workspaceId
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)
  const { path, content, sha } = await request.json()
  
  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `Update ${path}`,
    content: Buffer.from(content).toString('base64'),
    sha,
    branch
  })
  
  return Response.json({ sha: data.content?.sha })
}

// POST - Create file
export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const token = await getTokenFromSession(request)
  const octokit = new Octokit({ auth: token })
  
  const workspaceId = params.workspaceId
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)
  const { path, content } = await request.json()
  
  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `Create ${path}`,
    content: Buffer.from(content).toString('base64'),
    branch
  })
  
  return Response.json({ sha: data.content?.sha })
}
```

### API Route: Save Workspace (Squash and Merge)

**`/api/github/workspace/[workspaceId]/save`**
```typescript
export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  const token = await getTokenFromSession(request)
  const octokit = new Octokit({ auth: token })
  
  const workspaceId = params.workspaceId
  const { owner, repo, branch } = parseGitHubWorkspaceId(workspaceId)
  const { baseBranch, commitMessage } = await request.json()
  
  try {
    // 1. Get all commits from temp branch
    const { data: comparison } = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: baseBranch,
      head: branch
    })
    
    if (comparison.commits.length === 0) {
      return Response.json({ message: 'No changes to save' })
    }
    
    // 2. Get the tree of the temp branch
    const { data: tempBranchRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })
    
    const { data: tempCommit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: tempBranchRef.object.sha
    })
    
    // 3. Get base branch reference
    const { data: baseRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    })
    
    // 4. Create squashed commit on base branch
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage || 'Save workspace changes',
      tree: tempCommit.tree.sha,
      parents: [baseRef.object.sha]
    })
    
    // 5. Update base branch to point to new commit
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
      sha: newCommit.sha
    })
    
    // 6. Delete temp branch
    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })
    
    return Response.json({ success: true, sha: newCommit.sha })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

### File System Provider Placeholders

Until the on-disk workspace persistence layer lands, stub each `fs` route inside `app/api/fs/workspace/[workspaceId]/…`:

```typescript
// app/api/fs/workspace/[workspaceId]/tree/route.ts
export async function GET() {
  return Response.json({ error: 'Local workspace provider not implemented yet' }, { status: 501 })
}
```

These placeholders keep the API façade shape consistent and allow the client to rely on `/api/ws` regardless of provider choice.

## 6. Workspace Explorer UI

### File Tree Component

**`components/workspace/FileExplorer.tsx`**
```typescript
interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  extension?: string
  sha?: string
  children?: FileTreeNode[]
}

export function FileExplorer() {
  const { tree, openFile, activeFile, createFile } = useWorkspace()
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['Pages']))
  
  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }
  
  const handleFileClick = async (node: FileTreeNode) => {
    if (node.type === 'directory') {
      toggleExpand(node.path)
    } else {
      await openFile(node.path)
      // Dispatch event to open appropriate editor
      window.dispatchEvent(new CustomEvent('goflow-open-file', {
        detail: { path: node.path, extension: node.extension }
      }))
    }
  }
  
  const renderNode = (node: FileTreeNode, level: number = 0) => {
    const isExpanded = expanded.has(node.path)
    const isActive = activeFile === node.path
    const Icon = node.type === 'directory' 
      ? (isExpanded ? ChevronDown : ChevronRight)
      : getFileIcon(node.extension)
    
    return (
      <div key={node.path}>
        <button
          onClick={() => handleFileClick(node)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1 text-sm hover:bg-accent",
            isActive && "bg-accent text-accent-foreground",
            "transition-colors"
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        
        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-sm font-semibold">Explorer</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleNewFile('Pages')}>
              <FileText className="mr-2 h-4 w-4" />
              New Page
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNewFile('DataSources')}>
              <Database className="mr-2 h-4 w-4" />
              New Data Source
            </DropdownMenuItem>
            {/* ... more menu items */}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="flex-1 overflow-auto">
        {tree.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No workspace open
          </div>
        ) : (
          <div>
            {tree.map(node => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  )
}

function getFileIcon(extension?: string) {
  const icons: Record<string, any> = {
    'page': FileText,
    'ds': Database,
    'qry': Search,
    'cpn': Workflow,
    'color': BookText,
    'mcp': Wrench
  }
  return icons[extension || ''] || FileText
}
```

## 7. Save Workspace Dialog

**`components/workspace/SaveWorkspaceDialog.tsx`**
```typescript
export function SaveWorkspaceDialog({ open, onOpenChange }: DialogProps) {
  const [commitMessage, setCommitMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const { saveWorkspace } = useWorkspace()
  
  const handleSave = async () => {
    if (!commitMessage.trim()) {
      toast({
        title: 'Commit message required',
        description: 'Please provide a description of your changes',
        variant: 'destructive'
      })
      return
    }
    
    setSaving(true)
    try {
      await saveWorkspace(commitMessage)
      onOpenChange(false)
      setCommitMessage('')
    } catch (error: any) {
      toast({
        title: 'Failed to save workspace',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Workspace</DialogTitle>
          <DialogDescription>
            Describe the changes you've made. All commits will be squashed and merged to the main branch.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Commit Message</Label>
            <Textarea
              placeholder="Updated page layouts and added new data sources..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              rows={4}
            />
          </div>
          
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This will merge all changes from your temp branch into the main branch.
            </AlertDescription>
          </Alert>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save & Merge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## 8. File Type Handlers

### File Action Dispatcher

When a file is clicked in the explorer, dispatch appropriate action based on extension:

```typescript
// components/workspace/file-handler.ts
export function handleFileOpen(path: string, extension: string) {
  const handlers: Record<string, (path: string) => void> = {
    'page': openPageBuilder,
    'ds': openDataSourceEditor,
    'qry': openQueryEditor,
    'cpn': openWorkflowEditor,
    'color': openSchemaEditor,
    'mcp': openMCPToolEditor
  }
  
  const handler = handlers[extension]
  if (handler) {
    handler(path)
  } else {
    console.warn(`No handler for file type: ${extension}`)
  }
}

function openPageBuilder(path: string) {
  // Load page definition and open in page builder
  const { files } = useWorkspace.getState()
  const file = files.get(path)
  
  if (file) {
    const pageData = JSON.parse(file.content)
    // Dispatch to page builder
    window.dispatchEvent(new CustomEvent('goflow-load-page', {
      detail: { path, data: pageData }
    }))
  }
}

function openDataSourceEditor(path: string) {
  // Open data source in data tab
  window.dispatchEvent(new CustomEvent('goflow-switch-tab', {
    detail: { tab: 'data', file: path }
  }))
}

// Similar handlers for other file types...
```

## 9. Route Mapping for Pages

### Route Generator

Map Page folder structure to Next.js routes for preview:

```typescript
// lib/workspace-routes.ts
export function generateRoutesFromPages(tree: FileTreeNode[]): RouteConfig[] {
  const pagesFolder = tree.find(node => node.name === 'Pages')
  if (!pagesFolder) return []
  
  return buildRoutes(pagesFolder.children || [], '/')
}

function buildRoutes(nodes: FileTreeNode[], basePath: string): RouteConfig[] {
  const routes: RouteConfig[] = []
  
  for (const node of nodes) {
    if (node.type === 'file') {
      // File name becomes route segment
      const name = node.name // Extension already stripped
      let routePath = basePath
      
      if (name === 'index') {
        // index.page -> /basePath
        routePath = basePath
      } else if (name.startsWith('[') && name.endsWith(']')) {
        // [id].page -> /basePath/:id (dynamic route)
        const param = name.slice(1, -1)
        routePath = `${basePath}:${param}`
      } else {
        // name.page -> /basePath/name
        routePath = `${basePath}${name}`
      }
      
      routes.push({
        path: routePath,
        filePath: node.path,
        isDynamic: name.startsWith('[')
      })
    } else if (node.type === 'directory') {
      // Recurse into subdirectory
      const subPath = `${basePath}${node.name}/`
      routes.push(...buildRoutes(node.children || [], subPath))
    }
  }
  
  return routes
}

interface RouteConfig {
  path: string
  filePath: string
  isDynamic: boolean
}
```

### Preview Mode Integration

```typescript
// components/preview/PreviewRouter.tsx
export function PreviewRouter() {
  const { tree } = useWorkspace()
  const routes = useMemo(() => generateRoutesFromPages(tree), [tree])
  
  return (
    <div>
      <h3>Available Routes</h3>
      <ul>
        {routes.map(route => (
          <li key={route.path}>
            <Link href={`/preview${route.path}`}>
              {route.path}
              {route.isDynamic && <Badge>Dynamic</Badge>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## 10. Environment Configuration

### Required Environment Variables

```bash
# .env.local

# GitHub OAuth App credentials
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# App URL for OAuth callback
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Session encryption key (generate with: openssl rand -base64 32)
SESSION_SECRET=your_session_secret_key
```

### GitHub OAuth App Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App:
   - **Application name**: GoFlow Workspace
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/github/auth/callback`
3. Copy Client ID and Client Secret to `.env.local`

## 11. Security Considerations

### Token Storage
- Store GitHub access tokens encrypted in HTTP-only cookies
- Use `iron-session` or similar for secure session management
- Set appropriate cookie flags (HttpOnly, Secure, SameSite)

### Permissions
- Request minimal GitHub scopes: `repo` (for private repos) and `user:email`
- Validate all repository access on server-side
- Implement rate limiting for GitHub API calls

### Branch Protection
- Never allow direct commits to `main` branch
- Always use temp branches for editing
- Implement merge conflict detection before squashing

## 12. Implementation Checklist

- [ ] Install dependencies: `@octokit/rest`, `iron-session`
- [ ] Set up GitHub OAuth App and configure environment variables
- [ ] Implement authentication flow (login, callback, logout)
- [ ] Create workspace store with Zustand
- [ ] Build File Menu component with workspace actions
- [ ] Implement GitHub API routes (open, save, file operations)
- [ ] Create File Explorer component with tree view
- [ ] Build Open/Save Workspace dialogs
- [ ] Implement file type handlers and dispatchers
- [ ] Add route mapping for Pages folder
- [ ] Test full workflow: open → edit → save → merge
- [ ] Add error handling and user feedback
- [ ] Implement auto-save and dirty file tracking
- [ ] Add conflict resolution UI

## 13. Future Enhancements

### Phase 2
- **Collaboration**: Real-time collaboration with multiple users editing same workspace
- **Branch Management**: Allow users to work on feature branches, not just temp branches
- **Conflict Resolution**: Visual merge conflict resolver
- **File History**: View commit history for each file
- **Diff View**: Show changes before committing

### Phase 3
- **GitLab/Bitbucket Support**: Extend to other Git providers
- **Offline Mode**: Work locally with sync when online
- **Import/Export**: Import from other sources, export to local filesystem
- **Templates**: Repository templates for quick project setup
