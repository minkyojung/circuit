/**
 * TodoPanel Component
 *
 * Main panel for displaying and managing todos in a conversation
 * Features collapsible todo list with progress tracking
 */

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, X } from 'lucide-react'
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
  goal?: string // Goal/title for the todo section
}

export const TodoPanel: React.FC<TodoPanelProps> = ({
  conversationId,
  workspace,
  className,
  onClose,
  goal = 'Tasks',
}) => {
  const { todos, stats, isLoading, error, getTodoTree, updateTodoStatus, deleteTodo } = useTodos()
  const { startAgent } = useAgent()

  // Collapsible state with localStorage persistence
  const [isExpanded, setIsExpanded] = useState(true)

  // Load saved expansion state from localStorage
  useEffect(() => {
    if (conversationId) {
      const saved = localStorage.getItem(`todo_expanded_${conversationId}`)
      if (saved !== null) {
        setIsExpanded(saved === 'true')
      }
    }
  }, [conversationId])

  // Save expansion state to localStorage
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(`todo_expanded_${conversationId}`, String(isExpanded))
    }
  }, [isExpanded, conversationId])

  const todoTree = getTodoTree()

  // Calculate completion stats
  const completedCount = useMemo(
    () => todos.filter((t) => t.status === 'completed').length,
    [todos]
  )
  const totalCount = todos.length

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
      {/* Collapsible Header */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="flex items-center justify-between">
          {/* Clickable header section */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'flex-1 flex items-center justify-between px-5 py-3',
              'hover:bg-muted/50 transition-colors',
              'text-left'
            )}
          >
            <div className="flex items-center gap-2">
              {/* Chevron icon */}
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </motion.div>
              {/* Goal title */}
              <h2 className="text-sm font-semibold">{goal}</h2>
            </div>

            {/* Stats: "n tasks planned • m/n completed" */}
            <div className="text-xs text-muted-foreground font-normal">
              {totalCount > 0 ? (
                <>
                  {totalCount} {totalCount === 1 ? 'task' : 'tasks'} planned • {completedCount}/{totalCount} completed
                </>
              ) : (
                'No tasks'
              )}
            </div>
          </button>

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                'p-3 hover:bg-muted',
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

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 overflow-hidden"
          >
            <div className="overflow-y-auto h-full">
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
                <div className="px-5 py-4 space-y-4">
                  {/* Stats - Only show when expanded */}
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
        )}
      </AnimatePresence>

    </motion.div>
  )
}
