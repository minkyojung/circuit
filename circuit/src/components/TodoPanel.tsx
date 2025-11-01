import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check, Circle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/types/conversation'
import type { TodoSession, TodoDraft } from '@/types/todo'

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron')

interface TodoPanelProps {
  conversationId: string | null
}

type FilterType = 'active' | 'archived'

export function TodoPanel({ conversationId }: TodoPanelProps) {
  const [sessions, setSessions] = useState<TodoSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('active')

  // Load sessions from messages with planResult
  useEffect(() => {
    if (conversationId) {
      loadSessions()
    } else {
      setSessions([])
    }
  }, [conversationId])

  const loadSessions = async () => {
    if (!conversationId) return

    setIsLoading(true)
    try {
      const result = await ipcRenderer.invoke('message:load', conversationId)

      if (result.success && result.messages) {
        console.log('[TodoPanel] 📊 Loaded', result.messages.length, 'messages for conversation:', conversationId);

        // Extract sessions from messages with planResult
        const extractedSessions: TodoSession[] = []

        result.messages.forEach((message: Message) => {
          console.log('[TodoPanel] 📊 Message:', message.id, 'role:', message.role, 'has metadata:', !!message.metadata, 'has planResult:', !!message.metadata?.planResult);

          if (message.role === 'assistant' && message.metadata?.planResult) {
            console.log('[TodoPanel] ✅ Found plan in message:', message.id, 'with', message.metadata.planResult.todos.length, 'todos');
            const session: TodoSession = {
              id: `session-${message.id}`,
              conversationId,
              messageId: message.id,
              planResult: message.metadata.planResult,
              status: message.metadata.planConfirmed ? 'completed' : 'pending',
              createdAt: message.timestamp,
            }
            extractedSessions.push(session)
          }
        })

        console.log('[TodoPanel] 📊 Extracted', extractedSessions.length, 'sessions');

        // Sort by creation time (newest first)
        extractedSessions.sort((a, b) => b.createdAt - a.createdAt)
        setSessions(extractedSessions)
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSessions = sessions.filter(s =>
    selectedFilter === 'active'
      ? ['pending', 'active', 'completed'].includes(s.status)
      : s.status === 'archived'
  )

  const handleScrollToMessage = (messageId: string) => {
    const element = document.querySelector(`[data-message-id="${messageId}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Add highlight effect
      element.classList.add('message-highlight')
      setTimeout(() => {
        element.classList.remove('message-highlight')
      }, 2000)
    }
  }

  const handleStartTasks = async (session: TodoSession) => {
    try {
      // Mark plan as confirmed by updating message
      const result = await ipcRenderer.invoke('message:load', session.conversationId)
      if (result.success && result.messages) {
        const message = result.messages.find((m: Message) => m.id === session.messageId)
        if (message) {
          // Update message with planConfirmed
          const updatedMessage = {
            ...message,
            metadata: {
              ...message.metadata,
              planConfirmed: true,
              hasPendingPlan: false,
            }
          }

          // Save updated message
          await ipcRenderer.invoke('message:save', updatedMessage)

          // Reload sessions to reflect changes
          loadSessions()
        }
      }
    } catch (error) {
      console.error('Error starting tasks:', error)
    }
  }

  return (
    <div className="h-full w-[20rem] flex flex-col flex-shrink-0">
      {/* Top spacer to align with main header */}
      <div className="h-[44px] shrink-0" style={{ WebkitAppRegion: 'drag' } as any} />

      {/* Header with filter buttons */}
      <div
        className="flex h-[44px] shrink-0 items-center px-3 justify-between"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <span className="text-sm font-medium text-sidebar-foreground">Plans</span>

        {/* Filter buttons */}
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => setSelectedFilter('active')}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              selectedFilter === 'active'
                ? "bg-secondary text-secondary-foreground"
                : "text-sidebar-foreground-muted hover:bg-sidebar-accent"
            )}
          >
            Active
          </button>
          <button
            onClick={() => setSelectedFilter('archived')}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              selectedFilter === 'archived'
                ? "bg-secondary text-secondary-foreground"
                : "text-sidebar-foreground-muted hover:bg-sidebar-accent"
            )}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-sidebar-foreground-muted">Loading plans...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <Clock className="h-12 w-12 mx-auto mb-3 text-sidebar-foreground-muted opacity-20" />
            <p className="text-sm text-sidebar-foreground-muted mb-1">
              {selectedFilter === 'active' ? 'No active plans' : 'No archived plans'}
            </p>
            <p className="text-xs text-sidebar-foreground-muted opacity-70">
              {selectedFilter === 'active'
                ? 'Use Plan Mode to create detailed task plans'
                : 'Completed plans will appear here'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredSessions.map((session) => (
              <TodoSessionItem
                key={session.id}
                session={session}
                onNavigate={handleScrollToMessage}
                onStartTasks={handleStartTasks}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface TodoSessionItemProps {
  session: TodoSession
  onNavigate: (messageId: string) => void
  onStartTasks: (session: TodoSession) => void
}

function TodoSessionItem({ session, onNavigate, onStartTasks }: TodoSessionItemProps) {
  const [isExpanded, setIsExpanded] = useState(session.status !== 'archived')

  const totalTasks = session.planResult.todos.length
  const completedTasks = session.status === 'completed' ? totalTasks : 0

  const formatTime = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60 * 1000) return 'just now'
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`

    const date = new Date(timestamp)
    return date.toLocaleDateString()
  }

  return (
    <div className={cn(
      "border border-sidebar-border/50 rounded-md overflow-hidden",
      "bg-sidebar-accent/30"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 gap-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left hover:text-sidebar-foreground transition-colors"
        >
          {isExpanded ? (
            <ChevronDown size={14} className="flex-shrink-0 text-sidebar-foreground-muted" />
          ) : (
            <ChevronRight size={14} className="flex-shrink-0 text-sidebar-foreground-muted" />
          )}
          <span className="text-xs font-medium text-sidebar-foreground truncate">
            Plan ({completedTasks}/{totalTasks})
          </span>
        </button>

        <button
          onClick={() => onNavigate(session.messageId)}
          className="flex-shrink-0 text-[10px] text-sidebar-foreground-muted hover:text-sidebar-foreground transition-colors"
          title="Go to message"
        >
          {formatTime(session.createdAt)}
        </button>
      </div>

      {/* Todo list */}
      {isExpanded && (
        <div className="px-2 pb-2 space-y-1">
          {session.planResult.todos.map((todo, index) => (
            <TodoItemRow
              key={index}
              todo={todo}
              isCompleted={session.status === 'completed'}
              depth={0}
            />
          ))}

          {/* Start Tasks button (only for pending plans) */}
          {session.status === 'pending' && (
            <div className="pt-1">
              <button
                onClick={() => onStartTasks(session)}
                className={cn(
                  'w-full h-7 px-3 rounded-md text-xs font-medium',
                  'bg-primary text-primary-foreground shadow-sm',
                  'hover:bg-primary/90 transition-colors',
                  'flex items-center justify-center gap-1.5'
                )}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4 2v12l8-6z" />
                </svg>
                Start Tasks
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface TodoItemRowProps {
  todo: TodoDraft
  isCompleted: boolean
  depth: number
}

function TodoItemRow({ todo, isCompleted, depth }: TodoItemRowProps) {
  const hasChildren = todo.children && todo.children.length > 0

  return (
    <div className={cn(depth > 0 && 'ml-4')}>
      <div className="flex items-start gap-2 py-0.5">
        {/* Checkbox */}
        <div className="flex-shrink-0 mt-0.5">
          {isCompleted ? (
            <div className="w-3 h-3 rounded-sm border border-primary/70 bg-primary/70 flex items-center justify-center">
              <Check className="w-2 h-2 text-primary-foreground" strokeWidth={3} />
            </div>
          ) : (
            <Circle size={12} className="text-sidebar-foreground-muted/40" />
          )}
        </div>

        {/* Content */}
        <p className={cn(
          "flex-1 text-[11px] leading-relaxed",
          isCompleted
            ? "line-through text-sidebar-foreground-muted/60"
            : "text-sidebar-foreground-muted/90"
        )}>
          {todo.content}
        </p>
      </div>

      {/* Nested children */}
      {hasChildren && (
        <div className="mt-0.5">
          {todo.children!.map((child, childIndex) => (
            <TodoItemRow
              key={childIndex}
              todo={child}
              isCompleted={isCompleted}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
