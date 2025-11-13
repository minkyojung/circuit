/**
 * Plan Parser Utility
 *
 * Extracts and validates SimpleBranchPlan JSON from assistant messages
 */

import type { SimpleBranchPlan } from '@/types/plan'

export interface ParsedPlan {
  plan: SimpleBranchPlan
  beforeText: string  // Text before the JSON block
  afterText: string   // Text after the JSON block
}

/**
 * Extracts JSON plan from message content
 * Looks for ```json ... ``` code blocks and validates SimpleBranchPlan structure
 */
export function extractPlanFromMessage(content: string): ParsedPlan | null {
  // Match ```json ... ``` blocks
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g

  let match: RegExpExecArray | null
  let lastValidPlan: ParsedPlan | null = null

  // Try to find a valid SimpleBranchPlan JSON block
  while ((match = jsonBlockRegex.exec(content)) !== null) {
    try {
      const jsonContent = match[1]
      const parsed = JSON.parse(jsonContent)

      // Validate that this is a SimpleBranchPlan
      if (isValidSimpleBranchPlan(parsed)) {
        const beforeText = content.substring(0, match.index).trim()
        const afterText = content.substring(match.index + match[0].length).trim()

        lastValidPlan = {
          plan: parsed as SimpleBranchPlan,
          beforeText,
          afterText
        }

        // Use the last valid plan found (in case multiple JSON blocks exist)
      }
    } catch (error) {
      // Invalid JSON, continue searching
      continue
    }
  }

  return lastValidPlan
}

/**
 * Validates that a parsed object matches SimpleBranchPlan structure
 */
function isValidSimpleBranchPlan(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false

  // Required fields
  if (typeof obj.goal !== 'string') return false
  if (!Array.isArray(obj.conversations)) return false
  if (typeof obj.totalConversations !== 'number') return false
  if (typeof obj.totalTodos !== 'number') return false
  if (typeof obj.totalEstimatedDuration !== 'number') return false

  // Validate conversations structure
  for (const conv of obj.conversations) {
    if (!conv || typeof conv !== 'object') return false
    if (typeof conv.id !== 'string') return false
    if (typeof conv.title !== 'string') return false
    if (typeof conv.goal !== 'string') return false
    if (!Array.isArray(conv.todos)) return false
    if (typeof conv.estimatedDuration !== 'number') return false
    if (typeof conv.order !== 'number') return false

    // Validate todos structure
    for (const todo of conv.todos) {
      if (!todo || typeof todo !== 'object') return false
      if (typeof todo.content !== 'string') return false
      if (typeof todo.activeForm !== 'string') return false
      if (typeof todo.estimatedDuration !== 'number') return false
    }
  }

  return true
}

/**
 * Removes the JSON plan block from message content
 * Returns only the text parts (before + after)
 */
export function removePlanFromContent(content: string, plan: ParsedPlan): string {
  return [plan.beforeText, plan.afterText].filter(Boolean).join('\n\n').trim()
}
