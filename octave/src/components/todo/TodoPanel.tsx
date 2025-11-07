/**
 * TodoPanel Component
 *
 * Main panel for displaying and managing todos in a conversation
 */

import React from 'react'
import { motion } from 'framer-motion'
import { ListTodo, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useTodos } from '../../contexts/TodoContext'
import { useAgent } from '../../contexts/AgentContext'
import { TodoList } from './TodoList'
import { TodoStats } from './TodoStats'
import type { Workspace } from '../../types/workspace'

interface TodoPanelProps {
  conversationId?: string
  workspace?: Workspace | null
  className?: string
  onClose?: () => void
  onCommit?: () => void
}

export const TodoPanel: React.FC<TodoPanelProps> = ({
  conversationId: _conversationId,
  workspace,
  className,
  onClose,
}) => {
  const { todos, stats, isLoading, error, getTodoTree, updateTodoStatus, deleteTodo } = useTodos()
  const { startAgent } = useAgent()

  const todoTree = getTodoTree()

  // Handle agent execution
  const handleRunAgent = async (todoId: string) => {
    if (!workspace) {
      console.warn('[TodoPanel] No workspace selected, cannot run agent')
      return
    }

    try {
      console.log('[TodoPanel] Starting agent for todo:', todoId, 'workspace:', workspace.id)
      await startAgent(todoId, workspace.id)
    } catch (error) {
      console.error('[TodoPanel] Failed to start agent:', error)
      // TODO: Show error toast
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex flex-col h-full bg-background border-l border-border',
        className
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Tasks</h2>
            {todos.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-muted text-muted-foreground">
                {todos.length}
              </span>
            )}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                'p-1 rounded hover:bg-muted',
                'text-muted-foreground hover:text-foreground',
                'transition-colors'
              )}
              aria-label="Close todo panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {error && (
          <div className="p-4 m-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <div className="p-4 space-y-4">
            {/* Stats */}
            {stats && stats.total > 0 && <TodoStats stats={stats} />}

            {/* Todo List */}
            <div>
              <TodoList
                todos={todoTree}
                onStatusChange={updateTodoStatus}
                onDelete={deleteTodo}
                workspaceId={workspace?.id}
                onRunAgent={handleRunAgent}
              />
            </div>

            {/* Empty state hint */}
            {todos.length === 0 && (
              <div className="text-center py-12 px-4">
                <ListTodo className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground mb-1">No tasks yet</p>
                <p className="text-xs text-muted-foreground">
                  Tasks will appear here when you start a conversation
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </motion.div>
  )
}
