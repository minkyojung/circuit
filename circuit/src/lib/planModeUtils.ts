/**
 * Plan Mode Utilities
 *
 * Functions for extracting and converting Claude's TodoWrite output
 * into Circuit's todo system format.
 */

import type { Message, Block } from '@/types/conversation'
import type { TodoDraft, TodoComplexity, TodoPriority } from '@/types/todo'

/**
 * Claude TodoWrite structure (as defined in main.cjs)
 */
interface ClaudeTodo {
  content: string
  activeForm: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  complexity?: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  estimatedDuration?: number
  description?: string
  dependencies?: string[]
  tags?: string[]
}

interface TodoWriteArgs {
  todos: ClaudeTodo[]
}

/**
 * Extract plan JSON from code blocks in Claude's response
 */
export function extractPlanFromCodeBlocks(blocks: Block[]): TodoWriteArgs | null {
  if (!blocks || blocks.length === 0) return null

  // Find JSON code blocks
  const codeBlocks = blocks.filter(
    block => block.type === 'code' && block.metadata?.language === 'json'
  )

  for (const codeBlock of codeBlocks) {
    try {
      const parsed = JSON.parse(codeBlock.content)

      // Check if it has the todos structure
      if (parsed.todos && Array.isArray(parsed.todos) && parsed.todos.length > 0) {
        return parsed as TodoWriteArgs
      }
    } catch (e) {
      // Not valid JSON or wrong structure, continue
      continue
    }
  }

  return null
}

/**
 * Extract plan from message content (fallback for text parsing)
 */
export function extractPlanFromText(content: string): TodoWriteArgs | null {
  if (!content) return null

  // Match ```json ... ``` blocks
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g
  const matches = content.matchAll(jsonBlockRegex)

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1])

      if (parsed.todos && Array.isArray(parsed.todos) && parsed.todos.length > 0) {
        return parsed as TodoWriteArgs
      }
    } catch (e) {
      continue
    }
  }

  return null
}

/**
 * Extract TodoWrite data from Claude's response blocks (legacy - tool blocks)
 */
export function extractTodoWriteFromBlocks(blocks: Block[]): TodoWriteArgs | null {
  if (!blocks || blocks.length === 0) return null

  // First try: Check for JSON code blocks (new Plan Mode format)
  const planFromCode = extractPlanFromCodeBlocks(blocks)
  if (planFromCode) return planFromCode

  // Second try: Check for TodoWrite tool blocks (if Claude Code's TodoWrite was used)
  const todoWriteBlock = blocks.find(
    block => block.type === 'tool' && block.metadata?.toolName === 'TodoWrite'
  )

  if (!todoWriteBlock || !todoWriteBlock.metadata?.args) {
    return null
  }

  const args = todoWriteBlock.metadata.args as unknown as TodoWriteArgs

  // Validate structure
  if (!args.todos || !Array.isArray(args.todos) || args.todos.length === 0) {
    return null
  }

  return args
}

/**
 * Extract TodoWrite data from a message
 */
export function extractTodoWriteFromMessage(message: Message): TodoWriteArgs | null {
  if (!message.blocks) return null
  return extractTodoWriteFromBlocks(message.blocks)
}

/**
 * Convert Claude's TodoWrite format to Circuit's TodoDraft format
 */
export function convertClaudeTodosToDrafts(claudeTodos: ClaudeTodo[]): TodoDraft[] {
  return claudeTodos.map((claudeTodo, index) => {
    const draft: TodoDraft = {
      content: claudeTodo.content,
      activeForm: claudeTodo.activeForm,
      description: claudeTodo.description,
      parentId: undefined,
      order: index,
      depth: 0,
      priority: mapPriority(claudeTodo.priority),
      complexity: mapComplexity(claudeTodo.complexity),
      estimatedDuration: claudeTodo.estimatedDuration || estimateDurationFromComplexity(claudeTodo.complexity),
    }

    return draft
  })
}

/**
 * Map Claude priority to Circuit priority
 */
function mapPriority(priority?: string): TodoPriority {
  if (!priority) return 'medium'

  const validPriorities: TodoPriority[] = ['low', 'medium', 'high', 'critical']
  if (validPriorities.includes(priority as TodoPriority)) {
    return priority as TodoPriority
  }

  return 'medium'
}

/**
 * Map Claude complexity to Circuit complexity
 */
function mapComplexity(complexity?: string): TodoComplexity {
  if (!complexity) return 'medium'

  const validComplexities: TodoComplexity[] = ['trivial', 'simple', 'medium', 'complex', 'very_complex']
  if (validComplexities.includes(complexity as TodoComplexity)) {
    return complexity as TodoComplexity
  }

  return 'medium'
}

/**
 * Estimate duration based on complexity if not provided
 */
function estimateDurationFromComplexity(complexity?: string): number {
  const baseTime = {
    trivial: 60,        // 1 minute
    simple: 300,        // 5 minutes
    medium: 900,        // 15 minutes
    complex: 1800,      // 30 minutes
    very_complex: 3600, // 60 minutes
  }

  return baseTime[complexity as keyof typeof baseTime] || baseTime.medium
}

/**
 * Calculate overall complexity from a list of todos
 */
export function calculateOverallComplexity(todos: TodoDraft[]): TodoComplexity {
  if (todos.length === 0) return 'medium'

  const weights = {
    trivial: 1,
    simple: 2,
    medium: 3,
    complex: 4,
    very_complex: 5,
  }

  const totalWeight = todos.reduce((sum, todo) => {
    const complexity = todo.complexity || 'medium'
    return sum + weights[complexity]
  }, 0)

  const avgWeight = totalWeight / todos.length

  if (avgWeight < 1.5) return 'trivial'
  if (avgWeight < 2.5) return 'simple'
  if (avgWeight < 3.5) return 'medium'
  if (avgWeight < 4.5) return 'complex'
  return 'very_complex'
}

/**
 * Calculate total estimated time from todos
 */
export function calculateTotalTime(todos: TodoDraft[]): number {
  return todos.reduce((sum, todo) => sum + (todo.estimatedDuration || 0), 0)
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)

  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
