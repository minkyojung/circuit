/**
 * TodoQueue - AI SDK Queue-style component for TodoWrite display
 *
 * Displays Claude's TodoWrite output inline in chat using AI SDK Queue patterns
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Square, Clock, Check, X, AlertCircle, ChevronRight, Play, SkipForward, Edit2, Trash2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Todo } from '@/types/todo'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface TodoQueueProps {
  todos: Todo[]
  defaultExpanded?: boolean
  showProgressBar?: boolean
  onTodoClick?: (todoId: string) => void  // Click handler for executing todos
  onTodoSkip?: (todoId: string) => void   // Skip todo
  onTodoDelete?: (todoId: string) => void // Delete todo
  onTodoCopy?: (todoId: string) => void   // Copy todo content
  onExecuteAll?: () => void               // Execute all pending todos automatically
  onExecute1by1?: () => void              // Execute todos one by one with reporting
  isAutoExecuting?: boolean               // Whether auto-execution is in progress
}

// AI SDK Queue-style primitives
const Queue = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("border border-border rounded-t-lg bg-card my-2", className)}>
    {children}
  </div>
)

const QueueSection = ({
  children,
  defaultOpen,
  isOpen,
  setIsOpen
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? true)
  const open = isOpen ?? internalOpen
  const toggle = setIsOpen ?? setInternalOpen

  return (
    <div>
      {React.Children.map(children, child => {
        // Only pass props to function components (QueueHeader, QueueList), not DOM elements
        if (React.isValidElement(child) && typeof child.type === 'function') {
          return React.cloneElement(child, { isOpen: open, setIsOpen: toggle } as any)
        }
        return child
      })}
    </div>
  )
}

const QueueHeader = ({
  children,
  isOpen,
  setIsOpen
}: {
  children: React.ReactNode;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}) => (
  <div
    className="flex items-center justify-between p-2 cursor-pointer hover:bg-secondary/20 transition-colors"
    onClick={() => setIsOpen?.(!isOpen)}
  >
    <div className="flex items-center gap-1 flex-1">
      <motion.div
        animate={{ rotate: isOpen ? 90 : 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        <ChevronRight size={14} className="text-muted-foreground shrink-0" />
      </motion.div>
      {children}
    </div>
  </div>
)

const QueueList = ({
  children,
  isOpen
}: {
  children: React.ReactNode;
  isOpen?: boolean;
}) => {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.ul
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="space-y-2 px-2 pb-3 max-h-[100px] overflow-y-auto overflow-hidden"
        >
          {children}
        </motion.ul>
      )}
    </AnimatePresence>
  )
}

const QueueItem = ({
  children,
  onClick,
  clickable = false,
  contextMenu
}: {
  children: React.ReactNode
  onClick?: () => void
  clickable?: boolean
  contextMenu?: React.ReactNode
}) => {
  const itemContent = (
    <li
      className={cn(
        "group flex items-start gap-2 text-xs py-2.5 rounded transition-colors hover:bg-secondary/10",
        clickable && "cursor-pointer hover:bg-secondary/20"
      )}
      onClick={clickable ? onClick : undefined}
    >
      {children}
    </li>
  )

  // Wrap with context menu if provided
  if (contextMenu) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {itemContent}
        </ContextMenuTrigger>
        {contextMenu}
      </ContextMenu>
    )
  }

  return itemContent
}

const QueueItemIndicator = ({ status }: { status: Todo['status'] }) => {
  const getIcon = () => {
    switch (status) {
      case 'pending':
        return <div className="w-[13px] h-[13px] border border-muted-foreground group-hover:border-foreground rounded-[4px] shrink-0 transition-colors" />
      case 'in_progress':
        return <Clock size={13} className="text-blue-500 group-hover:text-blue-400 shrink-0 animate-pulse transition-colors" />
      case 'completed':
        return <Check size={13} className="text-green-500 group-hover:text-green-400 shrink-0 transition-colors" />
      case 'failed':
        return <X size={13} className="text-red-500 group-hover:text-red-400 shrink-0 transition-colors" />
      case 'skipped':
        return <AlertCircle size={13} className="text-yellow-500 group-hover:text-yellow-400 shrink-0 transition-colors" />
    }
  }
  return <>{getIcon()}</>
}

const QueueItemContent = ({
  children,
  status
}: {
  children: React.ReactNode;
  status: Todo['status'];
}) => (
  <span className={cn(
    'inline-block text-muted-foreground font-light group-hover:text-foreground transition-colors leading-[14px]',
    status === 'completed' && 'line-through opacity-60'
  )}>
    {children}
  </span>
)

const QueueItemDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-muted-foreground mt-0.5">{children}</p>
)

/**
 * TodoQueue - Main component
 */
export const TodoQueue: React.FC<TodoQueueProps> = ({
  todos,
  defaultExpanded = true,
  showProgressBar = true,
  onTodoClick,
  onTodoSkip,
  onTodoDelete,
  onTodoCopy,
  onExecuteAll,
  onExecute1by1,
  isAutoExecuting = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded)
  const completed = todos.filter(t => t.status === 'completed').length
  const inProgress = todos.filter(t => t.status === 'in_progress').length
  const pending = todos.filter(t => t.status === 'pending').length
  const failed = todos.filter(t => t.status === 'failed').length
  const progress = Math.round((completed / todos.length) * 100)
  const isComplete = completed === todos.length
  const hasPendingTodos = pending > 0

  // Sort todos: pending/in_progress first, completed/failed/skipped last
  const sortedTodos = [...todos].sort((a, b) => {
    const aIsComplete = a.status === 'completed' || a.status === 'skipped'
    const bIsComplete = b.status === 'completed' || b.status === 'skipped'
    if (aIsComplete && !bIsComplete) return 1
    if (!aIsComplete && bIsComplete) return -1
    return 0
  })

  const handleDone = () => {
    setIsOpen(false)
  }

  return (
    <Queue>
      <QueueSection defaultOpen={defaultExpanded} isOpen={isOpen} setIsOpen={setIsOpen}>
        <QueueHeader>
          {/* Summary Text: "n tasks planned" on left, "m/n" on right */}
          <span className="text-xs font-light text-muted-foreground">
            {todos.length} task{todos.length === 1 ? '' : 's'} planned
          </span>
          {isComplete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDone()
              }}
              className="text-xs font-light text-muted-foreground hover:text-foreground transition-colors ml-auto mr-2"
            >
              done
            </button>
          )}
          <span className={cn(
            "text-xs text-muted-foreground font-light",
            !isComplete && "ml-auto"
          )}>
            {completed}/{todos.length}
          </span>
        </QueueHeader>

        {/* Todo List */}
        <QueueList>
          {sortedTodos.map((todo, idx) => {
            const isPending = todo.status === 'pending'
            const isClickable = isPending && onTodoClick !== undefined

            // Build context menu for this todo
            const contextMenu = (
              <ContextMenuContent className="w-48">
                {/* Execute - only for pending todos */}
                {isPending && onTodoClick && (
                  <>
                    <ContextMenuItem onClick={() => onTodoClick(todo.id)}>
                      <Play className="mr-2 h-4 w-4" />
                      Execute
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                )}

                {/* Skip - for pending and in_progress todos */}
                {(isPending || todo.status === 'in_progress') && onTodoSkip && (
                  <ContextMenuItem onClick={() => onTodoSkip(todo.id)}>
                    <SkipForward className="mr-2 h-4 w-4" />
                    Skip
                  </ContextMenuItem>
                )}

                {/* Copy content - always available */}
                {onTodoCopy && (
                  <ContextMenuItem onClick={() => onTodoCopy(todo.id)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </ContextMenuItem>
                )}

                {/* Delete - always available except for in_progress */}
                {todo.status !== 'in_progress' && onTodoDelete && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => onTodoDelete(todo.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            )

            return (
              <QueueItem
                key={todo.id || idx}
                onClick={() => isClickable && onTodoClick(todo.id)}
                clickable={isClickable}
                contextMenu={contextMenu}
              >
                <QueueItemIndicator status={todo.status} />
                <div className="flex-1 min-w-0">
                  <QueueItemContent status={todo.status}>
                    {todo.status === 'in_progress' ? (todo.activeForm || todo.content) : todo.content}
                  </QueueItemContent>
                  {todo.description && (
                    <QueueItemDescription>{todo.description}</QueueItemDescription>
                  )}
                </div>
              </QueueItem>
            )
          })}
        </QueueList>

        {/* Failed tasks footer */}
        {failed > 0 && (
          <div className="px-4 pb-3 pt-2.5 border-t border-border/50">
            <span className="text-xs text-red-500">
              {failed} task{failed > 1 ? 's' : ''} failed
            </span>
          </div>
        )}
      </QueueSection>
    </Queue>
  )
}
