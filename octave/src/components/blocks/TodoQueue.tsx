/**
 * TodoQueue - AI SDK Queue-style component for TodoWrite display
 *
 * Displays Claude's TodoWrite output inline in chat using AI SDK Queue patterns
 */

import React, { useState } from 'react'
import { Circle, Clock, Check, X, AlertCircle, ChevronDown, ChevronRight, Play, SkipForward, Edit2, Trash2, Copy, PlayCircle, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Todo } from '@/types/todo'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'

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
  <div className={cn("border border-border rounded-lg bg-sidebar/50 my-2", className)}>
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
        if (React.isValidElement(child)) {
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
    className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/20 transition-colors"
    onClick={() => setIsOpen?.(!isOpen)}
  >
    <div className="flex items-center gap-2 flex-1">
      {isOpen ? (
        <ChevronDown size={16} className="text-muted-foreground shrink-0" />
      ) : (
        <ChevronRight size={16} className="text-muted-foreground shrink-0" />
      )}
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
  if (!isOpen) return null
  return <ul className="space-y-1.5 px-4 pb-4">{children}</ul>
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
        "flex items-start gap-2 text-sm p-2 rounded transition-colors",
        clickable && "hover:bg-sidebar/80 cursor-pointer",
        !clickable && "hover:bg-sidebar/50"
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
        return <Circle size={14} className="text-muted-foreground mt-0.5 shrink-0" />
      case 'in_progress':
        return <Clock size={14} className="text-blue-500 mt-0.5 animate-pulse shrink-0" />
      case 'completed':
        return <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
      case 'failed':
        return <X size={14} className="text-red-500 mt-0.5 shrink-0" />
      case 'skipped':
        return <AlertCircle size={14} className="text-yellow-500 mt-0.5 shrink-0" />
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
    'text-foreground',
    status === 'completed' && 'line-through text-muted-foreground',
    status === 'in_progress' && 'font-medium'
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
  const completed = todos.filter(t => t.status === 'completed').length
  const inProgress = todos.filter(t => t.status === 'in_progress').length
  const pending = todos.filter(t => t.status === 'pending').length
  const failed = todos.filter(t => t.status === 'failed').length
  const progress = Math.round((completed / todos.length) * 100)
  const isComplete = completed === todos.length
  const hasPendingTodos = pending > 0

  return (
    <Queue>
      <QueueSection defaultOpen={defaultExpanded}>
        <QueueHeader>
          {/* Status Icon */}
          {isComplete ? (
            <Check size={16} className="text-green-500 shrink-0" />
          ) : inProgress > 0 ? (
            <Clock size={16} className="text-blue-500 shrink-0 animate-pulse" />
          ) : (
            <Circle size={16} className="text-muted-foreground shrink-0" />
          )}

          {/* Summary Text */}
          <span className="text-sm font-medium text-foreground">
            {isComplete
              ? `✓ Completed ${todos.length} task${todos.length > 1 ? 's' : ''}`
              : inProgress > 0
              ? `Working... (${completed}/${todos.length})`
              : `${todos.length} task${todos.length > 1 ? 's' : ''} planned`}
          </span>

          {/* Auto-Execution Buttons */}
          {hasPendingTodos && !isAutoExecuting && (onExecuteAll || onExecute1by1) && (
            <div className="flex items-center gap-1 ml-auto mr-2" onClick={(e) => e.stopPropagation()}>
              {onExecute1by1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onExecute1by1}
                  className="h-6 px-2 text-xs gap-1"
                  title="Execute todos one by one with reporting"
                >
                  <ListChecks size={14} />
                  <span className="hidden sm:inline">1 by 1</span>
                </Button>
              )}
              {onExecuteAll && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onExecuteAll}
                  className="h-6 px-2 text-xs gap-1"
                  title="Execute all pending todos automatically"
                >
                  <PlayCircle size={14} />
                  <span className="hidden sm:inline">Execute All</span>
                </Button>
              )}
            </div>
          )}

          {/* Auto-executing indicator */}
          {isAutoExecuting && (
            <span className="text-xs text-blue-500 ml-auto mr-2 animate-pulse">
              Auto-executing...
            </span>
          )}

          {/* Progress percentage */}
          {showProgressBar && (
            <span className="text-xs text-muted-foreground font-mono">
              {progress}%
            </span>
          )}
        </QueueHeader>

        {/* Progress Bar */}
        {showProgressBar && (
          <div className="px-4 pb-3">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-500',
                  isComplete ? 'bg-green-500' : 'bg-primary'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Todo List */}
        <QueueList>
          {todos.map((todo, idx) => {
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
          <div className="px-4 pb-3 pt-2 border-t border-border/50">
            <span className="text-xs text-red-500">
              {failed} task{failed > 1 ? 's' : ''} failed
            </span>
          </div>
        )}
      </QueueSection>
    </Queue>
  )
}
