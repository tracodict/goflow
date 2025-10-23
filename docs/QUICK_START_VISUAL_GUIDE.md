# GitHub Workspace - Quick Visual Guide

## Where to Find the File Menu

The GitHub Workspace integration is accessible from the **top menu bar** in the GoFlow application.

```
┌─────────────────────────────────────────────────────────────────┐
│  File  View  Help                    Guest (role)  [Logout]     │  ← Top Menu Bar
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Application Content]                                           │
│                                                                   │
```

## File Menu Options

Click **File** in the top menu bar to access:

### Workspace Operations
- **Open Workspace...** - Connect to a GitHub repository
- **Save Workspace** - Commit and merge changes to main branch  
- **Close Workspace** - Close the current workspace

### File Operations
- **Open File...** - Browse and open files (coming soon)
- **Save File** - Save the currently active file
- **Save File As...** - Save file with a new name (coming soon)

### Create New Files
- **New Page** - Create a new page definition
- **New Data Source** - Create a new data source configuration
- **New Query** - Create a new query definition
- **New Workflow** - Create a new Petri net workflow
- **New Schema** - Create a new color/schema definition
- **New MCP Tool** - Create a new MCP tool configuration

## Step-by-Step: Opening Your First Workspace

### Step 1: Click File Menu
```
┌─────────────────────────┐
│ ► File  View  Help      │
│ ┌─────────────────────┐ │
│ │ Open Workspace...   │ │  ← Click this
│ │ Save Workspace      │ │
│ │ Close Workspace     │ │
│ ├─────────────────────┤ │
│ │ Open File...        │ │
│ │ Save File           │ │
│ │ Save File As...     │ │
│ ├─────────────────────┤ │
│ │ New Page            │ │
│ │ New Data Source     │ │
│ │ ...                 │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### Step 2: Authenticate with GitHub
If not already signed in, you'll see:

```
┌────────────────────────────────────┐
│  Open GitHub Workspace             │
├────────────────────────────────────┤
│                                    │
│  ⚠ You need to authenticate with   │
│     GitHub to access repositories  │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ 🐙 Sign in with GitHub       │ │  ← Click this
│  └──────────────────────────────┘ │
│                                    │
└────────────────────────────────────┘
```

### Step 3: Enter Repository URL
After authentication:

```
┌────────────────────────────────────┐
│  Open GitHub Workspace             │
├────────────────────────────────────┤
│                                    │
│  Repository URL                    │
│  ┌──────────────────────────────┐ │
│  │ https://github.com/user/repo │ │  ← Enter your repo URL
│  └──────────────────────────────┘ │
│                                    │
│  [Cancel]  [Open Workspace]        │
│                                    │
└────────────────────────────────────┘
```

### Step 4: Workspace Opens
Once opened, you'll see the File Explorer on the left:

```
┌──────────────┬────────────────────────────────────────────────┐
│ Explorer  [+]│                                                │
├──────────────┤                                                │
│ ▼ Pages      │                                                │
│   └ home     │                                                │
│ ▼ DataSources│         [Main Content Area]                   │
│ ▼ Queries    │                                                │
│ ▼ Workflows  │                                                │
│ ▼ Schemas    │                                                │
│ ▼ MCPTools   │                                                │
│              │                                                │
│              │                                                │
└──────────────┴────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K Ctrl+O` | Open Workspace |
| `Ctrl+S` | Save Workspace / Save File |
| `Ctrl+O` | Open File (coming soon) |

## Troubleshooting: "I Don't See the File Menu"

### 1. Check if you're in Preview Mode
The menu bar is hidden in preview mode. Look for a toggle or exit preview mode.

### 2. Check Browser Window Size
On very small screens, the menu might be collapsed. Try maximizing your browser window.

### 3. Verify Application Loaded
Make sure the application has fully loaded. Look for the "Guest" user indicator in the top right.

### 4. Clear Browser Cache
Sometimes cached files can cause issues:
```bash
# In browser DevTools (F12):
# - Right-click refresh button
# - Select "Empty Cache and Hard Reload"
```

### 5. Check Console for Errors
Open browser DevTools (F12) and check the Console tab for any error messages.

## What Happens When You Open a Workspace?

1. **Authentication Check**: Verifies you're logged into GitHub
2. **Repository Validation**: Checks if you have access to the repository
3. **Temp Branch Creation**: Creates a `goflow-{timestamp}` branch from main
4. **Folder Initialization**: Creates the standard folder structure if needed:
   - Pages/
   - DataSources/
   - Queries/
   - Workflows/
   - Schemas/
   - MCPTools/
5. **File Tree Loading**: Loads all files from the repository
6. **Explorer Update**: Updates the File Explorer with your files

## Working with Files

### Creating a New File
1. Click the **[+]** button in the Explorer header, OR
2. Use the **File** menu → **New [File Type]**
3. Enter a name for the file
4. The file will be created and opened in the appropriate editor

### Editing Files
1. Click any file in the Explorer
2. The file opens in its appropriate editor:
   - `.page` files → Page Builder
   - `.ds` files → Data Source Editor
   - `.qry` files → Query Editor
   - `.cpn` files → Workflow Editor
   - `.color` files → Schema Editor
   - `.mcp` files → MCP Tool Editor
3. Make your changes
4. Changes are auto-saved to the temp branch

### Saving Your Work
1. Click **File** → **Save Workspace**
2. Enter a commit message describing your changes
3. Click **Save & Merge**
4. Your changes are squashed into a single commit and merged to main
5. The temp branch is automatically deleted

## Common Workflows

### Daily Work Pattern
```
1. Open Workspace (morning)
2. Create/Edit Files (throughout day)
   - Changes auto-saved to temp branch
3. Save Workspace (end of day)
   - Enter meaningful commit message
   - Merge to main
```

### Collaborative Work
```
1. Pull latest changes (in GitHub)
2. Open Workspace in GoFlow
3. Make your changes
4. Save Workspace frequently
5. Teammates can see changes in main branch
```

### Project Setup
```
1. Create repository on GitHub
2. Open Workspace in GoFlow
3. Create initial Pages, DataSources, Queries
4. Save Workspace with message: "Initial project setup"
5. Share repository URL with team
```

---

**Need More Help?**
- [Full Setup Guide](./GITHUB_WORKSPACE_SETUP.md)
- [Architecture Documentation](./ARCHITECTURE_GITHUB_WORKSPACE.md)
- [Implementation Details](./IMPLEMENTATION_SUMMARY_GITHUB_WORKSPACE.md)
- [Deployment Checklist](./CHECKLIST_GITHUB_WORKSPACE.md)
