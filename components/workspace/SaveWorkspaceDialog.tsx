'use client'

import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

interface SaveWorkspaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SaveWorkspaceDialog({ open, onOpenChange }: SaveWorkspaceDialogProps) {
  const [commitMessage, setCommitMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const { saveWorkspace } = useWorkspace()
  const { toast } = useToast()
  
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
          <Button onClick={handleSave} disabled={saving || !commitMessage.trim()}>
            {saving ? 'Saving...' : 'Save & Merge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
