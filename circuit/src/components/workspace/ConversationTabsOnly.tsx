/**
 * Conversation Tabs Only Component
 *
 * Displays only conversation tabs (without file tabs)
 * Used in split view mode to show tabs inside ChatPanel
 */

import { useState, useEffect } from 'react'
import { Plus, X, Circle, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// @ts-ignore
const { ipcRenderer } = window.require('electron')

interface Conversation {
  id: string
  workspaceId: string
  title: string
  createdAt: number
  updatedAt: number
  lastViewedAt?: number
}

interface ConversationTabsOnlyProps {
  workspaceId: string | null
  workspaceName?: string
  activeConversationId: string | null
  onConversationChange: (conversationId: string) => void
}

export function ConversationTabsOnly({
  workspaceId,
  workspaceName,
  activeConversationId,
  onConversationChange
}: ConversationTabsOnlyProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) {
      setConversations([])
      return
    }

    loadConversations()
  }, [workspaceId])

  const loadConversations = async () => {
    if (!workspaceId) return

    try {
      const result = await ipcRenderer.invoke('conversation:list', workspaceId)
      if (result.success && result.conversations) {
        setConversations(result.conversations)

        // Auto-select oldest conversation if none is active
        if (!activeConversationId && result.conversations.length > 0) {
          const sortedConversations = [...result.conversations].sort(
            (a, b) => a.createdAt - b.createdAt
          )
          const oldestConversation = sortedConversations[0]
          onConversationChange(oldestConversation.id)
        }
      }
    } catch (error) {
      console.error('[ConversationTabsOnly] Error loading conversations:', error)
    }
  }

  const handleCloseConversation = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation()
    setDeletingId(conversationId)
  }

  const confirmDelete = async () => {
    if (!deletingId) return

    try {
      // If this is the last conversation, create a new one first
      if (conversations.length === 1) {
        console.log('[ConversationTabsOnly] Last conversation - creating new one before deleting')
        const createResult = await ipcRenderer.invoke('conversation:create', workspaceId)

        if (createResult.success && createResult.conversation) {
          // Switch to the new conversation
          onConversationChange(createResult.conversation.id)

          // Now delete the old one
          const deleteResult = await ipcRenderer.invoke('conversation:delete', deletingId)
          if (!deleteResult.success) {
            console.error('[ConversationTabsOnly] Failed to delete:', deleteResult.error)
            alert(`Failed to delete conversation: ${deleteResult.error || 'Unknown error'}`)
          }

          await loadConversations()
        } else {
          console.error('[ConversationTabsOnly] Failed to create new conversation:', createResult.error)
          alert(`Cannot delete last conversation: Failed to create replacement conversation`)
        }
      } else {
        // Normal deletion - not the last conversation
        const result = await ipcRenderer.invoke('conversation:delete', deletingId)
        if (result.success) {
          if (deletingId === activeConversationId) {
            const otherConversation = conversations.find(c => c.id !== deletingId)
            if (otherConversation) {
              onConversationChange(otherConversation.id)
            }
          }

          await loadConversations()
        } else {
          console.error('[ConversationTabsOnly] Failed to delete:', result.error)
          alert(`Failed to delete conversation: ${result.error || 'Unknown error'}`)
        }
      }
    } catch (error) {
      console.error('[ConversationTabsOnly] Error deleting conversation:', error)
      alert(`Error deleting conversation: ${error}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreateConversation = async () => {
    if (!workspaceId || !workspaceName) return

    try {
      const result = await ipcRenderer.invoke('conversation:create', workspaceId)

      if (result.success && result.conversation) {
        await loadConversations()
        onConversationChange(result.conversation.id)
      } else {
        console.error('[ConversationTabsOnly] Failed to create:', result.error)
        alert(`Failed to create conversation: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[ConversationTabsOnly] Error creating conversation:', error)
      alert(`Error creating conversation: ${error}`)
    }
  }

  const handleDoubleClick = (conversation: Conversation) => {
    setEditingId(conversation.id)
    setEditingTitle(conversation.title || '')
  }

  const handleRenameSubmit = async () => {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null)
      setEditingTitle('')
      return
    }

    try {
      const result = await ipcRenderer.invoke('conversation:update-title', editingId, editingTitle.trim())

      if (result.success) {
        await loadConversations()
      } else {
        console.error('[ConversationTabsOnly] Failed to rename:', result.error)
        alert(`Failed to rename conversation: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[ConversationTabsOnly] Error renaming conversation:', error)
      alert(`Error renaming conversation: ${error}`)
    } finally {
      setEditingId(null)
      setEditingTitle('')
    }
  }

  const handleRenameCancel = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleRenameCancel()
    }
  }

  if (!workspaceId) {
    return null
  }

  return (
    <>
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin border-b border-border bg-card px-2 py-1">
        {/* Conversation Tabs */}
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId
          const isRead = isActive || (conversation.lastViewedAt && conversation.lastViewedAt >= conversation.updatedAt)
          const isEditing = editingId === conversation.id

          return (
            <div
              key={conversation.id}
              className={cn(
                'group relative flex items-center gap-2 px-2 py-[7px] transition-colors',
                'text-sm font-medium whitespace-nowrap',
                'rounded-md',
                isActive
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground'
              )}
            >
              {/* Icon - read/unread indicator */}
              {isRead ? (
                <CircleCheck size={14} className="opacity-70 shrink-0" />
              ) : (
                <Circle size={14} className="opacity-70 shrink-0" />
              )}

              {/* Conversation title - editable on double click */}
              {isEditing ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={handleRenameKeyDown}
                  autoFocus
                  className={cn(
                    'bg-background border border-primary rounded px-1 py-0',
                    'text-sm font-medium text-foreground',
                    'max-w-[120px] outline-none'
                  )}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => onConversationChange(conversation.id)}
                  onDoubleClick={() => handleDoubleClick(conversation)}
                >
                  {conversation.title || `${workspaceName || 'Chat'} ${conversations.indexOf(conversation) + 1}`}
                </span>
              )}

              {/* Close button - only show on hover */}
              {conversations.length > 1 && !isEditing && (
                <button
                  onClick={(e) => handleCloseConversation(e, conversation.id)}
                  className={cn(
                    'ml-1 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all',
                    'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )
        })}

        {/* New conversation button */}
        <button
          onClick={handleCreateConversation}
          className={cn(
            'flex items-center justify-center px-3 py-[7px] transition-colors rounded-md',
            'text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground'
          )}
          title="New Conversation"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
