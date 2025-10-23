# goflow

*Automatically synced with your [v0.dev](https://v0.dev) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/dict-tracos-projects/v0-goflow-ej)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/FR47grX4otJ)

## Overview

GoFlow is a low-code workflow and page builder platform with integrated GitHub workspace management. Build pages, workflows, queries, and data sources with a visual interface, then store everything version-controlled in GitHub.

### Key Features

- 🎨 **Visual Page Builder**: Drag-and-drop interface for building UI components
- 🔄 **Workflow Engine**: Petri net-based workflow modeling and execution
- 🗄️ **Data Integration**: Connect to multiple data sources (MongoDB, PostgreSQL, GCS, etc.)
- 📝 **Query Builder**: Visual and code-based query editors
- 🌐 **GitHub Workspace**: Version-controlled storage of all artifacts
- 🔐 **OAuth Authentication**: Secure GitHub integration
- 📦 **MCP Tools**: Model Context Protocol tool configurations

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- GitHub account
- GitHub OAuth App (for workspace feature)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tracodict/goflow.git
   cd goflow
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your GitHub OAuth credentials
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## GitHub Workspace Integration

GoFlow integrates with GitHub to provide version-controlled storage for all your work. **As of the latest update, the Pages tab now stores all pages directly in your GitHub repository with immediate commit workflow.**

See the [GitHub Workspace Setup Guide](./docs/GITHUB_WORKSPACE_SETUP.md) for detailed instructions.

### What's New: PagesTab GitHub Storage

- ✅ Pages stored in GitHub repository (no more localStorage)
- ✅ Immediate commits to temp branch on every operation
- ✅ File/folder creation via File menu (New Page, New Folder)
- ✅ Full CRUD operations (create, rename, move, delete)
- ✅ Clean history via squash merge on Save Workspace

**Migration Note:** Pages previously stored in localStorage are not automatically migrated. You'll need to recreate them in a GitHub workspace or manually export/import. See [PagesTab Migration Guide](./docs/PAGESTAB_GITHUB_MIGRATION.md) for details.

### Quick Setup

1. Create a GitHub OAuth App at https://github.com/settings/developers
2. Set callback URL to: `http://localhost:3000/api/github/auth/callback`
3. Add credentials to `.env.local`
4. Use "File → Open Workspace" to connect a repository

### Workspace Structure

```
<repository-root>/
├── Pages/              # Page definitions
├── DataSources/        # Data source configurations
├── Queries/            # Query definitions
├── Workflows/          # Workflow (Petri net) definitions
├── Schemas/            # Color/schema definitions
└── MCPTools/           # MCP tool configurations
```

## Documentation

- [GitHub Workspace Setup](./docs/GITHUB_WORKSPACE_SETUP.md) - Complete OAuth setup guide
- [PagesTab GitHub Migration](./docs/PAGESTAB_GITHUB_MIGRATION.md) - Pages storage migration details
- [Implementation Summary](./docs/IMPLEMENTATION_SUMMARY_GITHUB_WORKSPACE.md) - Technical details
- [Dialog System](./docs/DialogSystem.md) - Dialog engine documentation
- [Page Routing](./docs/PAGE_ROUTING.md) - Routing system
- [Script Context API](./docs/SCRIPT_CONTEXT_API.md) - Script execution

## Deployment

Your project is live at:

**[https://vercel.com/dict-tracos-projects/v0-goflow-ej](https://vercel.com/dict-tracos-projects/v0-goflow-ej)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/FR47grX4otJ](https://v0.dev/chat/projects/FR47grX4otJ)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository
