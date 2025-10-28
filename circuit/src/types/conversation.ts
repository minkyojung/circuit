/**
 * Type definitions for conversations and messages
 */

export interface Conversation {
  id: string
  workspaceId: string
  title: string
  createdAt: string
  updatedAt: string
  isActive: boolean
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  metadata?: {
    files?: string[]
    toolCalls?: string[]
    tokens?: number
  }
}

export interface WorkspaceMetadata {
  workspaceId: string
  lastActiveConversationId: string | null
  settings?: Record<string, any>
}
