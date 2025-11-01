/**
 * Todo Analyzer
 *
 * Analyzes user prompts and generates todo drafts based on:
 * - Keywords and action verbs
 * - Complexity indicators
 * - Task breakdown patterns
 */

import type { TodoDraft, TodoGenerationResult, TodoComplexity, TodoPriority } from '../types/todo'

/**
 * Action verbs that indicate tasks
 */
const ACTION_VERBS = {
  create: { priority: 'medium' as TodoPriority, weight: 1 },
  add: { priority: 'medium' as TodoPriority, weight: 1 },
  implement: { priority: 'high' as TodoPriority, weight: 2 },
  build: { priority: 'high' as TodoPriority, weight: 2 },
  develop: { priority: 'high' as TodoPriority, weight: 2 },
  fix: { priority: 'high' as TodoPriority, weight: 1.5 },
  debug: { priority: 'high' as TodoPriority, weight: 1.5 },
  refactor: { priority: 'medium' as TodoPriority, weight: 2 },
  update: { priority: 'medium' as TodoPriority, weight: 1 },
  modify: { priority: 'medium' as TodoPriority, weight: 1 },
  improve: { priority: 'medium' as TodoPriority, weight: 1.5 },
  optimize: { priority: 'medium' as TodoPriority, weight: 1.5 },
  test: { priority: 'medium' as TodoPriority, weight: 1 },
  write: { priority: 'medium' as TodoPriority, weight: 1 },
  delete: { priority: 'low' as TodoPriority, weight: 0.5 },
  remove: { priority: 'low' as TodoPriority, weight: 0.5 },
  cleanup: { priority: 'low' as TodoPriority, weight: 0.5 },
  document: { priority: 'low' as TodoPriority, weight: 0.5 },
  review: { priority: 'low' as TodoPriority, weight: 0.5 },
  check: { priority: 'low' as TodoPriority, weight: 0.5 },
}

/**
 * Complexity indicators
 */
const COMPLEXITY_INDICATORS = {
  trivial: ['typo', 'rename', 'comment', 'simple', 'quick', 'minor'],
  simple: ['add', 'update', 'change', 'modify', 'single', 'one'],
  medium: ['implement', 'create', 'build', 'develop', 'refactor'],
  complex: ['system', 'architecture', 'multiple', 'integrate', 'migration', 'redesign'],
  very_complex: ['entire', 'complete', 'full', 'comprehensive', 'overhaul', 'rebuild'],
}

/**
 * List indicators (bullet points, numbers, etc.)
 */
const LIST_PATTERNS = [
  /^\d+[\.)]\s+(.+)$/gm,           // 1. item, 1) item
  /^[-*+]\s+(.+)$/gm,               // - item, * item, + item
  /^[a-z][\.)]\s+(.+)$/gim,        // a. item, a) item
  /^Step \d+:\s*(.+)$/gim,         // Step 1: item
  /^Task \d+:\s*(.+)$/gim,         // Task 1: item
  /^TODO:\s*(.+)$/gim,             // TODO: item
]

/**
 * Analyze prompt and generate todo drafts
 */
export function analyzeTodoFromPrompt(prompt: string): TodoGenerationResult {
  const normalizedPrompt = prompt.trim()

  // Check if prompt contains an explicit list
  const listItems = extractListItems(normalizedPrompt)

  if (listItems.length > 0) {
    // User provided explicit list of tasks
    return generateFromExplicitList(listItems, normalizedPrompt)
  }

  // Check for multiple sentences/actions
  const sentences = splitIntoSentences(normalizedPrompt)

  if (sentences.length > 1) {
    // Multiple sentences - break down into subtasks
    return generateFromMultipleSentences(sentences, normalizedPrompt)
  }

  // Single task - analyze complexity
  return generateSingleTodo(normalizedPrompt)
}

/**
 * Extract list items from prompt
 */
function extractListItems(prompt: string): string[] {
  for (const pattern of LIST_PATTERNS) {
    const matches = [...prompt.matchAll(pattern)]
    if (matches.length > 0) {
      return matches.map(m => m[1].trim()).filter(Boolean)
    }
  }
  return []
}

/**
 * Split prompt into sentences
 */
function splitIntoSentences(prompt: string): string[] {
  // Split by period, exclamation, question mark, or newline
  const sentences = prompt
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10) // Filter out very short fragments

  return sentences
}

/**
 * Generate todos from explicit list
 */
function generateFromExplicitList(items: string[], _originalPrompt: string): TodoGenerationResult {
  const todos: TodoDraft[] = items.map((item, index) => {
    const complexity = estimateComplexity(item)
    const priority = estimatePriority(item)
    const estimatedDuration = estimateDuration(complexity, item)

    return {
      content: capitalizeFirstLetter(item),
      description: undefined,
      activeForm: toActiveForm(item),
      parentId: undefined,
      order: index,
      depth: 0,
      priority,
      complexity,
      estimatedDuration,
    }
  })

  const totalTime = todos.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0)
  const overallComplexity = getOverallComplexity(todos.map(t => t.complexity!))

  return {
    todos,
    complexity: overallComplexity,
    estimatedTotalTime: totalTime,
    confidence: 0.8, // High confidence for explicit lists
    reasoning: `Detected explicit task list with ${items.length} items`,
  }
}

/**
 * Generate todos from multiple sentences
 */
function generateFromMultipleSentences(sentences: string[], _originalPrompt: string): TodoGenerationResult {
  const todos: TodoDraft[] = sentences.map((sentence, index) => {
    const complexity = estimateComplexity(sentence)
    const priority = estimatePriority(sentence)
    const estimatedDuration = estimateDuration(complexity, sentence)

    return {
      content: capitalizeFirstLetter(sentence),
      description: undefined,
      activeForm: toActiveForm(sentence),
      parentId: undefined,
      order: index,
      depth: 0,
      priority,
      complexity,
      estimatedDuration,
    }
  })

  const totalTime = todos.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0)
  const overallComplexity = getOverallComplexity(todos.map(t => t.complexity!))

  return {
    todos,
    complexity: overallComplexity,
    estimatedTotalTime: totalTime,
    confidence: 0.6, // Medium confidence for sentence breakdown
    reasoning: `Broke down prompt into ${sentences.length} subtasks`,
  }
}

/**
 * Generate single todo
 */
function generateSingleTodo(prompt: string): TodoGenerationResult {
  const complexity = estimateComplexity(prompt)
  const priority = estimatePriority(prompt)
  const estimatedDuration = estimateDuration(complexity, prompt)

  // For complex tasks, suggest breaking down
  const shouldBreakDown = complexity === 'complex' || complexity === 'very_complex'

  const todos: TodoDraft[] = [
    {
      content: capitalizeFirstLetter(prompt),
      description: shouldBreakDown
        ? 'Consider breaking this down into smaller subtasks'
        : undefined,
      activeForm: toActiveForm(prompt),
      parentId: undefined,
      order: 0,
      depth: 0,
      priority,
      complexity,
      estimatedDuration,
    }
  ]

  return {
    todos,
    complexity,
    estimatedTotalTime: estimatedDuration,
    confidence: shouldBreakDown ? 0.4 : 0.7,
    reasoning: shouldBreakDown
      ? 'Single complex task detected - may need breakdown'
      : 'Single straightforward task',
  }
}

/**
 * Estimate task complexity based on keywords and length
 */
function estimateComplexity(text: string): TodoComplexity {
  const lowerText = text.toLowerCase()
  const wordCount = text.split(/\s+/).length

  // Check complexity indicators
  for (const [level, indicators] of Object.entries(COMPLEXITY_INDICATORS)) {
    if (indicators.some(indicator => lowerText.includes(indicator))) {
      return level as TodoComplexity
    }
  }

  // Fallback to word count
  if (wordCount < 5) return 'trivial'
  if (wordCount < 10) return 'simple'
  if (wordCount < 20) return 'medium'
  if (wordCount < 40) return 'complex'
  return 'very_complex'
}

/**
 * Estimate priority based on keywords
 */
function estimatePriority(text: string): TodoPriority {
  const lowerText = text.toLowerCase()

  // Check for explicit priority keywords
  if (/critical|urgent|asap|immediately|blocker/i.test(lowerText)) {
    return 'critical'
  }
  if (/high|important|priority|must/i.test(lowerText)) {
    return 'high'
  }
  if (/low|minor|optional|nice.*to.*have/i.test(lowerText)) {
    return 'low'
  }

  // Check action verbs
  for (const [verb, config] of Object.entries(ACTION_VERBS)) {
    if (lowerText.includes(verb)) {
      return config.priority
    }
  }

  return 'medium' // Default
}

/**
 * Estimate duration in seconds
 */
function estimateDuration(complexity: TodoComplexity, text: string): number {
  const baseTime = {
    trivial: 60,        // 1 minute
    simple: 300,        // 5 minutes
    moderate: 600,      // 10 minutes
    medium: 900,        // 15 minutes
    complex: 1800,      // 30 minutes
    very_complex: 3600, // 60 minutes
  } as Record<TodoComplexity, number>

  let duration = baseTime[complexity]

  // Adjust based on action verbs
  const lowerText = text.toLowerCase()
  for (const [verb, config] of Object.entries(ACTION_VERBS)) {
    if (lowerText.includes(verb)) {
      duration *= config.weight
      break
    }
  }

  return Math.round(duration)
}

/**
 * Get overall complexity from list of complexities
 */
function getOverallComplexity(complexities: TodoComplexity[]): TodoComplexity {
  const weights = {
    trivial: 1,
    simple: 2,
    moderate: 2.5,
    medium: 3,
    complex: 4,
    very_complex: 5,
  } as Record<TodoComplexity, number>

  const avgWeight = complexities.reduce((sum, c) => sum + weights[c], 0) / complexities.length

  if (avgWeight < 1.5) return 'trivial'
  if (avgWeight < 2.5) return 'simple'
  if (avgWeight < 3.5) return 'medium'
  if (avgWeight < 4.5) return 'complex'
  return 'very_complex'
}

/**
 * Convert to active form (present continuous)
 */
function toActiveForm(text: string): string {
  const lowerText = text.toLowerCase()

  // Replace common verbs with -ing form
  const replacements: [RegExp, string][] = [
    [/^create\s+/i, 'Creating '],
    [/^add\s+/i, 'Adding '],
    [/^implement\s+/i, 'Implementing '],
    [/^build\s+/i, 'Building '],
    [/^develop\s+/i, 'Developing '],
    [/^fix\s+/i, 'Fixing '],
    [/^debug\s+/i, 'Debugging '],
    [/^refactor\s+/i, 'Refactoring '],
    [/^update\s+/i, 'Updating '],
    [/^modify\s+/i, 'Modifying '],
    [/^improve\s+/i, 'Improving '],
    [/^optimize\s+/i, 'Optimizing '],
    [/^test\s+/i, 'Testing '],
    [/^write\s+/i, 'Writing '],
    [/^delete\s+/i, 'Deleting '],
    [/^remove\s+/i, 'Removing '],
    [/^cleanup\s+/i, 'Cleaning up '],
    [/^document\s+/i, 'Documenting '],
    [/^review\s+/i, 'Reviewing '],
    [/^check\s+/i, 'Checking '],
  ]

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(text)) {
      return text.replace(pattern, replacement)
    }
  }

  // Default: add "Working on" prefix
  return `Working on ${lowerText}`
}

/**
 * Capitalize first letter
 */
function capitalizeFirstLetter(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Convert TodoDraft to tree structure for hierarchical display
 */
export function buildTodoTree(todos: TodoDraft[]): TodoDraft[] {
  // Sort by order
  const sorted = [...todos].sort((a, b) => a.order - b.order)

  // Build parent-child relationships
  const roots: TodoDraft[] = []
  const childrenMap = new Map<string | undefined, TodoDraft[]>()

  for (const todo of sorted) {
    const parentId = todo.parentId
    if (!parentId) {
      roots.push(todo)
    } else {
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, [])
      }
      childrenMap.get(parentId)!.push(todo)
    }
  }

  // Attach children recursively
  function attachChildren(todo: TodoDraft): TodoDraft {
    const children = childrenMap.get(todo.content) || []
    return {
      ...todo,
      children: children.map(attachChildren),
    }
  }

  return roots.map(attachChildren)
}
