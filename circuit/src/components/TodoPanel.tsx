import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check, Circle, Clock, Zap, MessageSquare, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/types/conversation'
import type { TodoSession, TodoDraft, ExecutionMode } from '@/types/todo'
import type { Workspace } from '@/types/workspace'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SettingsDialog } from '@/components/SettingsDialog'

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron')

interface TodoPanelProps {
  conversationId: string | null
  refreshTrigger?: number
  workspace?: Workspace | null
  onCommit?: () => void
}

type FilterType = 'active' | 'archived'

export function TodoPanel({ conversationId, refreshTrigger, workspace, onCommit }: TodoPanelProps) {
  const [sessions, setSessions] = useState<TodoSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('active')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

  // Load sessions from messages with planResult
  useEffect(() => {
    if (conversationId) {
      loadSessions()
    } else {
      setSessions([])
    }
  }, [conversationId, refreshTrigger])

  const loadSessions = async () => {
    if (!conversationId) return

    setIsLoading(true)
    try {
      const result = await ipcRenderer.invoke('message:load', conversationId)

      if (result.success && result.messages) {
        // Extract sessions from messages with planResult
        const extractedSessions: TodoSession[] = []

        result.messages.forEach((message: Message) => {
          if (message.role === 'assistant' && message.metadata?.planResult) {
            // Determine session status based on planConfirmed flag
            // Don't mark as 'completed' - that's for individual todos
            const session: TodoSession = {
              id: `session-${message.id}`,
              conversationId,
              messageId: message.id,
              planResult: message.metadata.planResult,
              status: message.metadata.planConfirmed ? 'active' : 'pending',
              createdAt: message.timestamp,
            }
            extractedSessions.push(session)
          }
        })

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

  const handleStartTasks = async (session: TodoSession, mode: ExecutionMode) => {
    try {
      // Mark plan as confirmed and save execution mode
      const result = await ipcRenderer.invoke('message:load', session.conversationId)
      if (result.success && result.messages) {
        const message = result.messages.find((m: Message) => m.id === session.messageId)
        if (message) {
          // Update message with planConfirmed and executionMode
          const updatedMessage = {
            ...message,
            metadata: {
              ...message.metadata,
              planConfirmed: true,
              hasPendingPlan: false,
              executionMode: mode, // Store mode for later use
            }
          }

          // Save updated message
          await ipcRenderer.invoke('message:save', updatedMessage)

          // Trigger execution via IPC
          await ipcRenderer.invoke('todos:trigger-execution', {
            conversationId: session.conversationId,
            messageId: session.messageId,
            mode,
            todos: session.planResult.todos
          })

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
      {/* Top bar with icons and Commit & PR button */}
      <div className="h-[44px] shrink-0 flex items-center gap-1 px-2 pt-2" style={{ WebkitAppRegion: 'drag' } as any}>
        {/* Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center justify-center p-2 rounded-md h-7 w-7 transition-colors hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-sidebar-foreground"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          title="Settings"
        >
          <Settings size={16} strokeWidth={1.5} />
        </button>

        {/* Theme Toggle */}
        <div style={{ WebkitAppRegion: 'no-drag' } as any}>
          <ThemeToggle className="hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-sidebar-foreground" />
        </div>

        {/* Feedback Button */}
        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="flex items-center justify-center p-2 rounded-md h-7 w-7 transition-colors hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-sidebar-foreground"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          title="Send Feedback"
        >
          <MessageSquare size={16} strokeWidth={1.5} />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Commit & PR button */}
        {workspace && onCommit && (
          <button
            onClick={onCommit}
            className="px-4 py-[7px] bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-md transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            Commit & PR
          </button>
        )}
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Feedback Dialog - Placeholder for now */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsFeedbackOpen(false)}>
          <div className="bg-card p-6 rounded-lg shadow-xl max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Send Feedback</h3>
            <p className="text-sm text-muted-foreground mb-4">Feedback functionality coming soon!</p>
            <button
              onClick={() => setIsFeedbackOpen(false)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}


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
  onStartTasks: (session: TodoSession, mode: ExecutionMode) => void
}

function TodoSessionItem({ session, onNavigate, onStartTasks }: TodoSessionItemProps) {
  const [isExpanded, setIsExpanded] = useState(session.status !== 'archived')

  // Smart default: auto for simple plans, manual for complex ones
  const suggestedMode = session.planResult.todos.length <= 5 &&
    session.planResult.complexity !== 'complex' &&
    session.planResult.complexity !== 'very_complex' ? 'auto' : 'manual'
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(suggestedMode)

  const totalTasks = session.planResult.todos.length
  // For now, show 0 completed for pending/active sessions
  // TODO: Load actual todo status from DB for real-time progress
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
              isCompleted={false}  // TODO: Load actual status from DB
              depth={0}
            />
          ))}

          {/* Execution Mode Selection (show for pending and active plans) */}
          {(session.status === 'pending' || session.status === 'active') && (
            <div className="pt-2 space-y-2">
              {/* Mode toggle buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setExecutionMode('auto')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md',
                    'border transition-all text-[10px] font-medium',
                    executionMode === 'auto'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-sidebar-border hover:border-primary/50 text-sidebar-foreground-muted hover:text-sidebar-foreground'
                  )}
                >
                  <Zap className="w-3 h-3" />
                  Auto
                </button>

                <button
                  type="button"
                  onClick={() => setExecutionMode('manual')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md',
                    'border transition-all text-[10px] font-medium',
                    executionMode === 'manual'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-sidebar-border hover:border-primary/50 text-sidebar-foreground-muted hover:text-sidebar-foreground'
                  )}
                >
                  <MessageSquare className="w-3 h-3" />
                  Manual
                </button>
              </div>

              {/* Start Tasks button */}
              <button
                onClick={() => onStartTasks(session, executionMode)}
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
