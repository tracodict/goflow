'use client'

import { useState } from 'react'
import { useGitHubAuth } from '@/hooks/use-github-auth'
import { useWorkspace } from '@/stores/workspace-store'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Github } from 'lucide-react'

interface OpenWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OpenWorkspaceDialog({ open, onOpenChange }: OpenWorkspaceDialogProps) {
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const { authenticated, login } = useGitHubAuth()
  const { openWorkspace } = useWorkspace()
  const { toast } = useToast()
  
  const handleOpen = async () => {
    if (!authenticated) {
      login()
      return
    }
    
    setLoading(true)
    try {
      // Parse repo URL: https://github.com/owner/repo
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/)
      if (!match) {
        throw new Error('Invalid GitHub repository URL')
      }
      
      const [, owner, repo] = match
      await openWorkspace({ owner, repo: repo.replace('.git', '') })
      onOpenChange(false)
      setRepoUrl('')
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && repoUrl) {
                    handleOpen()
                  }
                }}
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
