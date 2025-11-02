import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check, Circle, Clock, Zap, MessageSquare, Settings, Terminal as TerminalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/types/conversation'
import type { TodoSession, TodoDraft, ExecutionMode } from '@/types/todo'
import type { Workspace } from '@/types/workspace'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SettingsDialog } from '@/components/SettingsDialog'
import { Terminal } from '@/components/Terminal'
import { motion, AnimatePresence } from 'framer-motion'
import { listItemVariants } from '@/lib/motion-tokens'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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

  const activeCount = sessions.filter(s => ['pending', 'active', 'completed'].includes(s.status)).length
  const archivedCount = sessions.filter(s => s.status === 'archived').length

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
    <div className="h-full w-full flex flex-col flex-shrink-0">
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
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
              selectedFilter === 'active'
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-sidebar-foreground-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
            )}
          >
            Active
            {activeCount > 0 && (
              <span className={cn(
                "px-1 py-0.5 rounded text-[10px] font-semibold",
                selectedFilter === 'active'
                  ? "bg-primary/20"
                  : "bg-sidebar-accent"
              )}>
                {activeCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedFilter('archived')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
              selectedFilter === 'archived'
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-sidebar-foreground-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
            )}
          >
            Archived
            {archivedCount > 0 && (
              <span className={cn(
                "px-1 py-0.5 rounded text-[10px] font-semibold",
                selectedFilter === 'archived'
                  ? "bg-primary/20"
                  : "bg-sidebar-accent"
              )}>
                {archivedCount}
              </span>
            )}
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
                  <AnimatePresence mode="popLayout">
                    {filteredSessions.map((session, index) => (
                      <TodoSessionItem
                        key={session.id}
                        session={session}
                        index={index}
                        onNavigate={handleScrollToMessage}
                        onStartTasks={handleStartTasks}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

      {/* Terminal Section */}
      {workspace && (
        <div className="shrink-0 border-t border-sidebar-border">
          {/* Terminal Header */}
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-sidebar-foreground">
            <TerminalIcon size={14} />
            <span>Terminal</span>
            <span className="text-[10px] text-sidebar-foreground-muted">
              {workspace.displayName}
            </span>
          </div>

          {/* Terminal Content */}
          <div className="h-[400px] overflow-hidden">
            <Terminal workspace={workspace} />
          </div>
        </div>
      )}
    </div>
  )
}

interface TodoSessionItemProps {
  session: TodoSession
  index: number
  onNavigate: (messageId: string) => void
  onStartTasks: (session: TodoSession, mode: ExecutionMode) => void
}

function TodoSessionItem({ session, index, onNavigate, onStartTasks }: TodoSessionItemProps) {
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

  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <motion.div
        custom={index}
        variants={listItemVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
        className={cn(
          "rounded-lg overflow-hidden transition-all duration-200",
          session.status === 'active' && "bg-primary/5 shadow-sm",
          session.status === 'pending' && "bg-sidebar-accent/30",
          session.status === 'completed' && "bg-green-500/5 opacity-90"
        )}
      >
        {/* Header */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-2 gap-2">
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-sidebar-foreground transition-colors"
              >
                <ChevronRight
                  size={12}
                  className={cn(
                    "flex-shrink-0 text-sidebar-foreground-muted transition-transform duration-150",
                    isExpanded && "rotate-90"
                  )}
                />
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-sidebar-foreground truncate">
                    Plan
                  </span>
                  <span className="text-[10px] text-sidebar-foreground-muted">
                    {completedTasks}/{totalTasks}
                  </span>
                </div>
              </button>
            </CollapsibleTrigger>

            <button
              onClick={() => onNavigate(session.messageId)}
              className="flex-shrink-0 text-[10px] text-sidebar-foreground-muted hover:text-sidebar-foreground transition-colors"
              title="Go to message"
            >
              {formatTime(session.createdAt)}
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-sidebar-border/30">
            <motion.div
              className={cn(
                "h-full",
                session.status === 'completed' ? "bg-green-500" : "bg-primary"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Todo list */}
        <CollapsibleContent className="overflow-hidden transition-all duration-150 ease-out">
          <div className="px-2 pb-2 space-y-1">
          {session.planResult.todos.map((todo, index) => (
            <TodoItemRow
              key={index}
              todo={todo}
              isCompleted={false}  // TODO: Load actual status from DB
              depth={0}
            />
          ))}

          {/* Start Tasks Split Button (show for pending and active plans) */}
          {(session.status === 'pending' || session.status === 'active') && (
            <div className="pt-2">
              <DropdownMenu>
                <div className="flex items-stretch">
                  {/* Main action button */}
                  <button
                    onClick={() => onStartTasks(session, executionMode)}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-l-md text-xs font-medium',
                      'bg-secondary text-secondary-foreground',
                      'hover:bg-secondary/80 transition-colors',
                      'flex items-center justify-center'
                    )}
                  >
                    {executionMode === 'auto' ? 'Start Tasks' : 'Start Tasks Manually'}
                  </button>

                  {/* Dropdown trigger */}
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        'py-2 px-2 rounded-r-md text-xs font-medium',
                        'bg-secondary text-secondary-foreground',
                        'hover:bg-secondary/80 transition-colors',
                        'border-l border-secondary-foreground/10',
                        'flex items-center justify-center'
                      )}
                    >
                      <ChevronDown size={12} />
                    </button>
                  </DropdownMenuTrigger>
                </div>

                {/* Dropdown menu */}
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={() => setExecutionMode('auto')}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Zap size={14} />
                    <span className="flex-1">Auto</span>
                    {executionMode === 'auto' && <Check size={14} className="text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setExecutionMode('manual')}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    <span className="flex-1">Manual</span>
                    {executionMode === 'manual' && <Check size={14} className="text-primary" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          </div>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
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
      <div className={cn(
        "flex items-center gap-2 py-1 px-2 -mx-2 rounded-md",
        "hover:bg-sidebar-hover/50 transition-colors duration-200",
        "cursor-pointer group"
      )}>
        {/* Checkbox */}
        <div className="flex-shrink-0">
          {isCompleted ? (
            <div className="w-3 h-3 rounded-sm border border-primary/70 bg-primary/70 flex items-center justify-center">
              <Check className="w-2 h-2 text-primary-foreground" strokeWidth={3} />
            </div>
          ) : (
            <Circle size={12} className="text-sidebar-foreground-muted/40 group-hover:text-sidebar-foreground-muted/60 transition-colors duration-200" />
          )}
        </div>

        {/* Content */}
        <p className={cn(
          "flex-1 text-[11px] leading-snug",
          isCompleted
            ? "line-through text-sidebar-foreground-muted/60"
            : "text-sidebar-foreground-muted/90 group-hover:text-sidebar-foreground transition-colors duration-200"
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
