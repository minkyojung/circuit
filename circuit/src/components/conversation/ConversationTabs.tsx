/**
 * Conversation Tabs Component
 *
 * Tab-based interface for switching between conversations
 * Replaces the breadcrumb navigation with a more intuitive tab design
 */

import { useState, useEffect } from 'react'
import { Plus, X, Circle, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

// @ts-ignore
const { ipcRenderer } = window.require('electron')

interface Conversation {
  id: string
  workspaceId: string
  title: string
  createdAt: number
  updatedAt: number
  lastViewedAt?: number // Optional: for tracking read/unread state
}

interface ConversationTabsProps {
  workspaceId: string | null
  workspaceName?: string
  activeConversationId: string | null
  onConversationChange: (conversationId: string) => void
}

export function ConversationTabs({
  workspaceId,
  workspaceName,
  activeConversationId,
  onConversationChange
}: ConversationTabsProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])

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
      }
    } catch (error) {
      console.error('[ConversationTabs] Error loading conversations:', error)
    }
  }

  const handleCloseTab = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation()

    // TODO: Add confirmation dialog
    try {
      const result = await ipcRenderer.invoke('conversation:delete', conversationId)
      if (result.success) {
        loadConversations()

        // If closing active conversation, switch to first available
        if (conversationId === activeConversationId && conversations.length > 1) {
          const otherConversation = conversations.find(c => c.id !== conversationId)
          if (otherConversation) {
            onConversationChange(otherConversation.id)
          }
        }
      }
    } catch (error) {
      console.error('[ConversationTabs] Error deleting conversation:', error)
    }
  }

  const handleCreateConversation = async () => {
    if (!workspaceId || !workspaceName) return

    try {
      // Create conversation with auto-generated name
      const result = await ipcRenderer.invoke('conversation:create', workspaceId)

      if (result.success && result.conversation) {
        console.log('[ConversationTabs] Created conversation:', result.conversation.id)

        // Reload conversations
        await loadConversations()

        // Switch to the newly created conversation
        onConversationChange(result.conversation.id)
      } else {
        console.error('[ConversationTabs] Failed to create:', result.error)
        alert(`Failed to create conversation: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[ConversationTabs] Error creating conversation:', error)
      alert(`Error creating conversation: ${error}`)
    }
  }

  if (!workspaceId) {
    return null
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeConversationId

        // Determine read/unread status
        // If lastViewedAt exists and is after updatedAt, or if it's the active conversation, it's read
        const isRead = isActive || (conversation.lastViewedAt && conversation.lastViewedAt >= conversation.updatedAt)

        return (
          <button
            key={conversation.id}
            onClick={() => onConversationChange(conversation.id)}
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

            {/* Conversation title */}
            <span className="max-w-[80px] truncate">
              {workspaceName || 'Chat'} {conversations.indexOf(conversation) + 1}
            </span>

            {/* Close button - only show on hover */}
            {conversations.length > 1 && (
              <button
                onClick={(e) => handleCloseTab(e, conversation.id)}
                className={cn(
                  'ml-1 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all',
                  'opacity-0 group-hover:opacity-100'
                )}
              >
                <X size={14} />
              </button>
            )}
          </button>
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
  )
}
