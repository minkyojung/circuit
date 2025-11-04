/**
 * ChecklistBlock - Renders checklist/todo items
 *
 * Displays markdown-style checklist with completion tracking
 * Format: - [ ] unchecked item or - [x] checked item
 */

import React from 'react'
import type { Block } from '@/types/conversation'
import { Check, Square, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChecklistBlockProps {
  block: Block
}

interface ChecklistItem {
  checked: boolean
  text: string
  line: number
}

/**
 * Parse checklist markdown into structured items
 */
const parseChecklistItems = (content: string): ChecklistItem[] => {
  const lines = content.split('\n')
  const items: ChecklistItem[] = []

  lines.forEach((line, index) => {
    const match = line.match(/^- \[([ x])\] (.+)$/)
    if (match) {
      items.push({
        checked: match[1] === 'x',
        text: match[2].trim(),
        line: index,
      })
    }
  })

  return items
}

export const ChecklistBlock: React.FC<ChecklistBlockProps> = ({ block }) => {
  const items = parseChecklistItems(block.content)
  const completedCount = items.filter(item => item.checked).length
  const totalCount = items.length

  // Calculate completion percentage
  const completionPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-sidebar/50 p-4">
        <p className="text-sm text-muted-foreground">No checklist items found</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-sidebar/50 p-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <CheckSquare size={16} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Checklist</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {completedCount} / {totalCount} completed
          </span>
          {/* Progress bar */}
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                completionPercentage === 100 ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist items */}
      <ul className="space-y-2.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3 group">
            {/* Checkbox icon */}
            <div className="shrink-0 mt-0.5">
              {item.checked ? (
                <CheckSquare size={18} className="text-green-500" />
              ) : (
                <Square size={18} className="text-muted-foreground" />
              )}
            </div>

            {/* Item text */}
            <span
              className={cn(
                'text-sm leading-relaxed',
                item.checked
                  ? 'text-muted-foreground line-through'
                  : 'text-foreground'
              )}
            >
              {item.text}
            </span>
          </li>
        ))}
      </ul>

      {/* Completion message */}
      {completionPercentage === 100 && (
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-2">
          <Check size={14} className="text-green-500" />
          <span className="text-xs text-green-500 font-medium">All tasks completed!</span>
        </div>
      )}
    </div>
  )
}
