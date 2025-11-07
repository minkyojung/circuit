/**
 * Todo Context
 *
 * Manages todo state for the current conversation
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type {
  Todo,
  TodoDraft,
  TodoStatus,
  TodoNode,
  TodoStats,
  TodoProgressUpdate
} from '../types/todo'

const ipcRenderer = window.electron.ipcRenderer;

interface TodoContextType {
  // State
  todos: Todo[]
  stats: TodoStats | null
  isLoading: boolean
  error: string | null

  // CRUD operations
  loadTodos: (conversationId: string) => Promise<void>
  createTodosFromDrafts: (
    conversationId: string,
    messageId: string,
    drafts: TodoDraft[]
  ) => Promise<void>
  updateTodoStatus: (todoId: string, status: TodoStatus, progress?: number) => Promise<void>
  updateTodoProgress: (update: TodoProgressUpdate) => void
  deleteTodo: (todoId: string) => Promise<void>

  // Utilities
  getTodoTree: () => TodoNode[]
  getCurrentTodo: () => Todo | null
  getNextTodo: () => Todo | null
  startNextTodo: () => Promise<void>
}

const TodoContext = createContext<TodoContextType | null>(null)

export const useTodos = () => {
  const context = useContext(TodoContext)
  if (!context) {
    throw new Error('useTodos must be used within TodoProvider')
  }
  return context
}

interface TodoProviderProps {
  children: React.ReactNode
  conversationId?: string
}

export const TodoProvider: React.FC<TodoProviderProps> = ({ children, conversationId }) => {
  const [todos, setTodos] = useState<Todo[]>([])
  const [stats, setStats] = useState<TodoStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs to avoid stale closures
  const todosRef = useRef<Todo[]>(todos)
  useEffect(() => {
    todosRef.current = todos
  }, [todos])

  /**
   * Load todos from database
   */
  const loadTodos = useCallback(async (convId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await ipcRenderer.invoke('todos:load', convId)

      if (result.success) {
        setTodos(result.todos || [])

        // Calculate stats
        const todoStats = calculateStats(result.todos || [])
        setStats(todoStats)
      } else {
        setError(result.error || 'Failed to load todos')
      }
    } catch (err) {
      console.error('[TodoContext] Failed to load todos:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Create todos from drafts
   */
  const createTodosFromDrafts = useCallback(
    async (convId: string, msgId: string, drafts: TodoDraft[]) => {
      try {
        const now = Date.now()

        const newTodos: Todo[] = drafts.map((draft, index) => ({
          id: `todo-${msgId}-${index}`,
          conversationId: convId,
          messageId: msgId,
          parentId: draft.parentId,
          order: draft.order,
          depth: draft.depth,
          content: draft.content,
          description: draft.description,
          activeForm: draft.activeForm,
          status: 'pending' as TodoStatus,
          progress: 0,
          priority: draft.priority,
          complexity: draft.complexity,
          thinkingStepIds: [],
          blockIds: [],
          estimatedDuration: draft.estimatedDuration,
          actualDuration: undefined,
          startedAt: undefined,
          completedAt: undefined,
          createdAt: now,
          updatedAt: now,
        }))

        // Save to database
        const result = await ipcRenderer.invoke('todos:save-multiple', newTodos)

        if (result.success) {
          setTodos((prev) => [...prev, ...newTodos])

          // Recalculate stats
          const newStats = calculateStats([...todosRef.current, ...newTodos])
          setStats(newStats)
        } else {
          setError(result.error || 'Failed to create todos')
        }
      } catch (err) {
        console.error('[TodoContext] Failed to create todos:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    },
    []
  )

  /**
   * Update todo status
   */
  const updateTodoStatus = useCallback(
    async (todoId: string, status: TodoStatus, progress?: number) => {
      try {
        const completedAt = status === 'completed' ? Date.now() : undefined

        const result = await ipcRenderer.invoke('todos:update-status', {
          todoId,
          status,
          progress,
          completedAt,
        })

        if (result.success) {
          setTodos((prev) =>
            prev.map((todo) =>
              todo.id === todoId
                ? {
                    ...todo,
                    status,
                    progress: progress ?? todo.progress,
                    completedAt,
                    updatedAt: Date.now(),
                  }
                : todo
            )
          )

          // Recalculate stats
          const newTodos = todosRef.current.map((todo) =>
            todo.id === todoId
              ? { ...todo, status, progress: progress ?? todo.progress }
              : todo
          )
          const newStats = calculateStats(newTodos)
          setStats(newStats)
        } else {
          setError(result.error || 'Failed to update todo')
        }
      } catch (err) {
        console.error('[TodoContext] Failed to update todo status:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    },
    []
  )

  /**
   * Update todo progress from real-time events
   */
  const updateTodoProgress = useCallback((update: TodoProgressUpdate) => {
    setTodos((prev) => {
      const todoIndex = prev.findIndex((t) => t.id === update.todoId)
      if (todoIndex === -1) return prev

      const updated = [...prev]
      const todo = { ...updated[todoIndex] }

      if (update.status) {
        todo.status = update.status
        if (update.status === 'in_progress' && !todo.startedAt) {
          todo.startedAt = update.timestamp
        }
        if (update.status === 'completed' && !todo.completedAt) {
          todo.completedAt = update.timestamp
          if (todo.startedAt) {
            todo.actualDuration = Math.round((update.timestamp - todo.startedAt) / 1000)
          }
        }
      }

      if (update.progress !== undefined) {
        todo.progress = update.progress
      }

      if (update.thinkingStep) {
        // Add thinking step reference
        const stepId = `${update.timestamp}-${update.thinkingStep.type}`
        if (!todo.thinkingStepIds.includes(stepId)) {
          todo.thinkingStepIds = [...todo.thinkingStepIds, stepId]
        }
      }

      if (update.block) {
        // Add block reference
        if (!todo.blockIds.includes(update.block.id)) {
          todo.blockIds = [...todo.blockIds, update.block.id]
        }
      }

      todo.updatedAt = update.timestamp

      updated[todoIndex] = todo
      return updated
    })

    // Recalculate stats
    const newStats = calculateStats(todosRef.current)
    setStats(newStats)
  }, [])

  /**
   * Delete a todo
   */
  const deleteTodo = useCallback(async (todoId: string) => {
    try {
      const result = await ipcRenderer.invoke('todos:delete', todoId)

      if (result.success) {
        setTodos((prev) => prev.filter((t) => t.id !== todoId))

        // Recalculate stats
        const newTodos = todosRef.current.filter((t) => t.id !== todoId)
        const newStats = calculateStats(newTodos)
        setStats(newStats)
      } else {
        setError(result.error || 'Failed to delete todo')
      }
    } catch (err) {
      console.error('[TodoContext] Failed to delete todo:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  /**
   * Get todos as tree structure
   */
  const getTodoTree = useCallback((): TodoNode[] => {
    const roots: TodoNode[] = []
    const childrenMap = new Map<string, TodoNode[]>()

    // Build children map
    for (const todo of todos) {
      const node: TodoNode = { ...todo, children: [] }

      if (!todo.parentId) {
        roots.push(node)
      } else {
        if (!childrenMap.has(todo.parentId)) {
          childrenMap.set(todo.parentId, [])
        }
        childrenMap.get(todo.parentId)!.push(node)
      }
    }

    // Attach children recursively
    function attachChildren(node: TodoNode): TodoNode {
      const children = childrenMap.get(node.id) || []
      return {
        ...node,
        children: children.map(attachChildren),
      }
    }

    return roots.map(attachChildren)
  }, [todos])

  /**
   * Get current in-progress todo
   */
  const getCurrentTodo = useCallback((): Todo | null => {
    return todos.find((t) => t.status === 'in_progress') || null
  }, [todos])

  /**
   * Get next pending todo
   */
  const getNextTodo = useCallback((): Todo | null => {
    return todos.find((t) => t.status === 'pending') || null
  }, [todos])

  /**
   * Start next pending todo
   */
  const startNextTodo = useCallback(async () => {
    const nextTodo = getNextTodo()
    if (nextTodo) {
      await updateTodoStatus(nextTodo.id, 'in_progress', 0)
    }
  }, [getNextTodo, updateTodoStatus])

  // Auto-load todos when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadTodos(conversationId)
    } else {
      setTodos([])
      setStats(null)
    }
  }, [conversationId, loadTodos])

  const value: TodoContextType = {
    todos,
    stats,
    isLoading,
    error,
    loadTodos,
    createTodosFromDrafts,
    updateTodoStatus,
    updateTodoProgress,
    deleteTodo,
    getTodoTree,
    getCurrentTodo,
    getNextTodo,
    startNextTodo,
  }

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}

/**
 * Calculate todo statistics
 */
function calculateStats(todos: Todo[]): TodoStats {
  const total = todos.length
  const pending = todos.filter((t) => t.status === 'pending').length
  const inProgress = todos.filter((t) => t.status === 'in_progress').length
  const completed = todos.filter((t) => t.status === 'completed').length
  const failed = todos.filter((t) => t.status === 'failed').length
  const skipped = todos.filter((t) => t.status === 'skipped').length

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  const estimatedTimeRemaining = todos
    .filter((t) => t.status === 'pending' || t.status === 'in_progress')
    .reduce((sum, t) => sum + (t.estimatedDuration || 0), 0)

  const actualTimeSpent = todos
    .filter((t) => t.actualDuration !== undefined)
    .reduce((sum, t) => sum + (t.actualDuration || 0), 0)

  return {
    total,
    pending,
    inProgress,
    completed,
    failed,
    skipped,
    completionRate,
    estimatedTimeRemaining,
    actualTimeSpent,
  }
}
