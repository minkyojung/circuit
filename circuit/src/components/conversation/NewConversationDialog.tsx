/**
 * New Conversation Dialog
 *
 * Simple dialog for creating new conversations
 */

import { useState } from 'react'
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

// @ts-ignore
const { ipcRenderer } = window.require('electron')

interface NewConversationDialogProps {
  workspaceId: string
  workspaceName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConversationCreated: (conversationId: string) => void
}

export function NewConversationDialog({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
  onConversationCreated
}: NewConversationDialogProps) {
  const [title, setTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)

    try {
      const result = await ipcRenderer.invoke('conversation:create', {
        workspaceId,
        title: title.trim() || undefined // Use workspace-number naming if empty
      })

      if (result.success && result.conversation) {
        console.log('[NewConversationDialog] Created conversation:', result.conversation.id)

        // Close dialog
        onOpenChange(false)

        // Reset form
        setTitle('')

        // Notify parent to switch to new conversation
        onConversationCreated(result.conversation.id)
      } else {
        console.error('[NewConversationDialog] Failed to create:', result.error)
        alert(`Failed to create conversation: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[NewConversationDialog] Error:', error)
      alert(`Error creating conversation: ${error}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCreate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Create a new conversation in <span className="font-medium">{workspaceName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title" className="text-sm text-muted-foreground">
              Name (optional)
            </Label>
            <Input
              id="title"
              placeholder={`${workspaceName} [number]`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use default naming: {workspaceName} 1, {workspaceName} 2, etc.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
