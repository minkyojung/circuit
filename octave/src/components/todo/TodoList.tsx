/**
 * TodoList Component
 *
 * Renders a list of todos with tree structure support
 */

import React, { useState } from 'react'
import { TodoItem } from './TodoItem'
import type { TodoNode, TodoStatus } from '../../types/todo'

interface TodoListProps {
  todos: TodoNode[]
  onStatusChange?: (todoId: string, status: TodoStatus) => void
  onDelete?: (todoId: string) => void
  workspaceId?: string
  onRunAgent?: (todoId: string) => void
}

export const TodoList: React.FC<TodoListProps> = ({
  todos,
  onStatusChange,
  onDelete,
  workspaceId,
  onRunAgent
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const handleToggleExpand = (todoId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(todoId)) {
        next.delete(todoId)
      } else {
        next.add(todoId)
      }
      return next
    })
  }

  if (todos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">No todos yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a conversation to generate todos
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          depth={0}
          isExpanded={expandedIds.has(todo.id)}
          onToggleExpand={handleToggleExpand}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          workspaceId={workspaceId}
          onRunAgent={onRunAgent}
        />
      ))}
    </div>
  )
}
