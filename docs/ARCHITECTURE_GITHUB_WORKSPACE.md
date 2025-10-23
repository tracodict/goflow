# GitHub Workspace Integration - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GoFlow Application                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │   File Menu      │    │  File Explorer   │                  │
│  │  (Components)    │◄───┤  (Components)    │                  │
│  └────────┬─────────┘    └────────┬─────────┘                  │
│           │                        │                             │
│           └────────────┬───────────┘                             │
│                        │                                         │
│                        ▼                                         │
│            ┌───────────────────────┐                            │
│            │  Workspace Store      │                            │
│            │  (Zustand State)      │                            │
│            └───────────┬───────────┘                            │
│                        │                                         │
│           ┌────────────┼────────────┐                           │
│           │            │            │                           │
│           ▼            ▼            ▼                           │
│    ┌──────────┐  ┌─────────┐  ┌──────────┐                    │
│    │  Open    │  │  Save   │  │   File   │                    │
│    │ Dialog   │  │ Dialog  │  │ Handlers │                    │
│    └──────────┘  └─────────┘  └──────────┘                    │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                         API Layer                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         GitHub Authentication Routes                       │  │
│  │  /api/github/auth/login                                   │  │
│  │  /api/github/auth/callback                                │  │
│  │  /api/github/auth/status                                  │  │
│  │  /api/github/auth/logout                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         GitHub Workspace Routes                            │  │
│  │  /api/github/workspace/open                               │  │
│  │  /api/github/workspace/init-folders                       │  │
│  │  /api/github/workspace/tree                               │  │
│  │  /api/github/workspace/file (GET/PUT/POST)                │  │
│  │  /api/github/workspace/save                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                    Session Management                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Iron Session (Encrypted Cookies)                         │  │
│  │  - GitHub Access Token                                     │  │
│  │  - User Profile                                            │  │
│  │  - 30-day expiration                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Octokit.js Client                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub REST API                             │
│  - Repository Management                                         │
│  - Branch Operations                                             │
│  - File CRUD                                                     │
│  - Commit & Tree Operations                                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GitHub Repository                              │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  main branch (stable)                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  goflow-{timestamp} (temp branch)                          │ │
│  │  - Work in progress                                        │ │
│  │  - Auto-saved commits                                      │ │
│  │  - Squashed on save                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Folder Structure:                                               │
│  ├── Pages/                                                      │
│  ├── DataSources/                                                │
│  ├── Queries/                                                    │
│  ├── Workflows/                                                  │
│  ├── Schemas/                                                    │
│  └── MCPTools/                                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Open Workspace Flow

```
User clicks "Open Workspace"
    │
    ▼
Check authentication
    │
    ├──► Not authenticated ──► Redirect to GitHub OAuth
    │                              │
    │                              ▼
    │                          Get access token
    │                              │
    │                              ▼
    │                          Store in session
    │                              │
    └──────────────────────────────┘
                │
                ▼
Parse repository URL
    │
    ▼
Create temp branch (goflow-{timestamp})
    │
    ▼
Initialize folder structure
    │
    ▼
Load file tree
    │
    ▼
Update workspace state
    │
    ▼
Workspace ready!
```

### 2. File Edit Flow

```
User clicks file in explorer
    │
    ▼
Check if file in memory
    │
    ├──► Yes ──► Set as active file
    │
    └──► No ───► Fetch from GitHub
                    │
                    ▼
                Parse JSON content
                    │
                    ▼
                Store in workspace state
                    │
                    ▼
                Dispatch open event
                    │
                    ▼
                File handler routes to editor
                    │
                    ▼
                Editor opens with content
                    │
                    ▼
                User makes changes
                    │
                    ▼
                Mark file as dirty
                    │
                    ▼
                User saves file
                    │
                    ▼
                Commit to temp branch
                    │
                    ▼
                Update file SHA
                    │
                    ▼
                Mark file as clean
```

### 3. Save Workspace Flow

```
User clicks "Save Workspace"
    │
    ▼
Show commit message dialog
    │
    ▼
User enters message
    │
    ▼
Get temp branch commits
    │
    ▼
Get temp branch tree
    │
    ▼
Get main branch reference
    │
    ▼
Create squashed commit on main
    │
    ▼
Update main branch reference
    │
    ▼
Delete temp branch
    │
    ▼
Show success message
    │
    ▼
Workspace saved!
```

## Component Dependencies

```
FileMenu.tsx
    ├── OpenWorkspaceDialog.tsx
    │   ├── useGitHubAuth
    │   └── useWorkspace
    │
    └── SaveWorkspaceDialog.tsx
        └── useWorkspace

FileExplorer.tsx
    ├── useWorkspace
    └── file-handler.ts
        └── useWorkspace

useWorkspace (Zustand Store)
    ├── /api/github/workspace/open
    ├── /api/github/workspace/init-folders
    ├── /api/github/workspace/tree
    ├── /api/github/workspace/file
    └── /api/github/workspace/save

useGitHubAuth
    ├── /api/github/auth/status
    ├── /api/github/auth/login
    └── /api/github/auth/logout

All API Routes
    └── github-session.ts
        └── iron-session
            └── @octokit/rest
```

## Security Layers

```
┌─────────────────────────────────────────┐
│  1. OAuth 2.0 Flow                      │
│     - State token verification          │
│     - CSRF protection                   │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  2. Session Management                  │
│     - Encrypted cookies (iron-session)  │
│     - HttpOnly flag                     │
│     - Secure flag (production)          │
│     - SameSite: lax                     │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  3. API Authorization                   │
│     - Token validation on each request  │
│     - GitHub API rate limiting          │
│     - Repository access control         │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  4. Minimal Scopes                      │
│     - repo (read/write repositories)    │
│     - user:email (user profile)         │
└─────────────────────────────────────────┘
```

## File Type Mapping

```
Extension → Folder → Handler → Event → Editor
────────────────────────────────────────────────
.page     → Pages      → openPageBuilder      → goflow-load-page       → Page Builder
.ds       → DataSources → openDataSourceEditor → goflow-switch-tab     → Data Tab
.qry      → Queries    → openQueryEditor      → goflow-open-query     → Query Editor
.cpn      → Workflows  → openWorkflowEditor   → goflow-open-workflow  → Workflow Editor
.color    → Schemas    → openSchemaEditor     → goflow-open-schema    → Schema Editor
.mcp      → MCPTools   → openMCPToolEditor    → goflow-open-mcp-tool  → MCP Tool Editor
```

## Performance Characteristics

### API Calls per Operation

**Open Workspace:**
- 1 call: Get base branch reference
- 1 call: Create temp branch
- 6 calls: Initialize folders (if needed)
- 1 call: Get file tree
- **Total: ~9 calls**

**Open File:**
- 1 call: Get file content
- **Total: 1 call**

**Save File:**
- 1 call: Update file content
- **Total: 1 call**

**Save Workspace:**
- 1 call: Compare commits
- 3 calls: Get branch refs and commit data
- 1 call: Create squashed commit
- 1 call: Update main branch
- 1 call: Delete temp branch
- **Total: 7 calls**

### Caching Strategy (Future)

```
Browser Memory Cache
    ├── File tree (until reload)
    ├── File contents (until close)
    └── User profile (30 days)

LocalStorage (Future)
    ├── Recent repositories
    ├── Expanded folders
    └── Last active file

IndexedDB (Future)
    └── Offline file cache
```

## Error Handling

```
Error Type          → User Message              → Recovery Action
─────────────────────────────────────────────────────────────────
Auth Failed         → "Failed to authenticate"  → Retry login
Token Expired       → "Session expired"         → Re-authenticate
Repo Not Found      → "Repository not found"    → Check URL/permissions
Network Error       → "Connection failed"       → Retry operation
Rate Limit          → "Too many requests"       → Wait and retry
Conflict            → "Merge conflict"          → Manual resolution
Invalid JSON        → "File format error"       → Fix in editor
Permission Denied   → "Access denied"           → Check repo settings
```

## Monitoring & Observability

```
Metrics to Track:
├── Authentication success/failure rate
├── API call latency
├── File operation success rate
├── Session duration
├── Active workspaces
├── Files edited per session
├── Commit frequency
└── Error rates by type

Logging:
├── OAuth flow events
├── API errors
├── Session lifecycle
├── File operations
└── Performance bottlenecks
```

---

**Architecture Version**: 1.0.0  
**Last Updated**: October 23, 2025  
**Status**: Production Ready
