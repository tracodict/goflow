# GitHub Workspace Integration Setup

This guide will help you set up GitHub OAuth for the workspace integration feature.

## Prerequisites

- A GitHub account
- Admin access to your GitHub repository (or ability to create OAuth Apps)

## Step 1: Create a GitHub OAuth App

1. Go to [GitHub Settings → Developer settings → OAuth Apps](flow)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: `GoFlow Workspace` (or your preferred name)
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorization callback URL**: `http://localhost:3000/api/github/auth/callback`
   - **Description**: (optional) "GoFlow workspace integration"
4. Click "Register application"
5. You'll be taken to the app settings page
6. Copy the **Client ID** 
7. Click "Generate a new client secret" and copy the **Client Secret**

⚠️ **Important**: Save the client secret immediately - you won't be able to see it again!

## Step 2: Configure Environment Variables

1. Copy the `.env.example` file to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your GitHub OAuth credentials:
   ```env
   GITHUB_CLIENT_ID=your_actual_client_id
   GITHUB_CLIENT_SECRET=your_actual_client_secret
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. Generate a secure session secret:
   ```bash
   openssl rand -base64 32
   ```
   
4. Add the generated secret to `.env.local`:
   ```env
   SESSION_SECRET=your_generated_secret_here
   ```

## Step 3: Test the Integration

1. Start your development server:
   ```bash
   pnpm dev
   ```

2. Open the application in your browser: `http://localhost:3000`

3. In the top menu bar, click **File → Open Workspace...**

4. Click "Sign in with GitHub" - you'll be redirected to GitHub

5. Authorize the application

6. You'll be redirected back to GoFlow - you're now authenticated!

7. Enter a repository URL (e.g., `https://github.com/username/repository`)

8. Click "Open Workspace" - the repository will be opened in GoFlow

## Production Deployment

When deploying to production:

1. Create a new OAuth App in GitHub with production URLs:
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-domain.com/api/github/auth/callback`

2. Update your environment variables:
   ```env
   GITHUB_CLIENT_ID=production_client_id
   GITHUB_CLIENT_SECRET=production_client_secret
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   SESSION_SECRET=production_session_secret
   ```

3. Ensure `.env.local` is in your `.gitignore` file

4. Set environment variables in your hosting platform (Vercel, Netlify, etc.)

## Security Notes

- Never commit `.env.local` or any file containing secrets to version control
- Use different OAuth apps for development and production
- Rotate your session secret periodically
- Keep your client secret secure - it provides full access to your GitHub repositories
- The app requests `repo` scope which grants read/write access to all repositories

## Troubleshooting

### "Invalid state" error
- Clear your browser cookies and try again
- Check that your `SESSION_SECRET` is set correctly

### "Unauthorized" errors
- Verify your GitHub OAuth credentials are correct
- Check that the authorization callback URL matches exactly
- Ensure the OAuth app has the correct scopes (`repo`, `user:email`)

### Repository not found
- Ensure you have access to the repository
- Check the repository URL format: `https://github.com/owner/repo`
- Verify the OAuth app has permission to access the repository (may need organization approval)

## File Structure

The workspace integration creates the following folder structure in your GitHub repository:

```
<repository-root>/
├── Pages/              # Page definitions
├── DataSources/        # Data source configurations
├── Queries/           # Query definitions
├── Workflows/         # Workflow (Petri net) definitions
├── Schemas/           # Color/schema definitions
└── MCPTools/          # MCP tool configurations
```

## Usage

1. **Open Workspace**: File → Open Workspace... → Enter repository URL
2. **Edit Files**: Click files in the explorer to open them in appropriate editors
3. **Create Files**: Click the "+" button in the explorer or use File menu
4. **Save Changes**: Changes are automatically committed to a temp branch
5. **Save Workspace**: File → Save Workspace → Enter commit message → Changes are merged to main branch

## Next Steps

- Explore the File Explorer to navigate your workspace
- Create new pages, data sources, queries, and workflows
- Use the File menu to manage your workspace
- Commit and push changes to GitHub

For more information, see the main documentation in `goDesign/Workspace.md`.
