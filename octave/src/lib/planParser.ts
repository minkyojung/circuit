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
 * Also supports bare JSON (without code fences) as a fallback
 */
export function extractPlanFromMessage(content: string): ParsedPlan | null {
  console.log('[planParser] Attempting to parse message (length:', content.length, ')')

  // Strategy 1: Try to find ```json ... ``` fenced blocks (preferred)
  const fencedPlan = tryExtractFencedJSON(content)
  if (fencedPlan) {
    console.log('[planParser] ✅ Successfully extracted fenced JSON plan')
    return fencedPlan
  }
  console.log('[planParser] ⚠️  No fenced JSON found, trying bare JSON...')

  // Strategy 2: Fallback to bare JSON detection
  const barePlan = tryExtractBareJSON(content)
  if (barePlan) {
    console.log('[planParser] ✅ Successfully extracted bare JSON plan')
    return barePlan
  }

  console.log('[planParser] ❌ Failed to extract any valid plan')
  return null
}

/**
 * Extract plan from properly fenced JSON blocks
 */
function tryExtractFencedJSON(content: string): ParsedPlan | null {
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
      }
    } catch (error) {
      // Invalid JSON, continue searching
      continue
    }
  }

  return lastValidPlan
}

/**
 * Extract plan from bare JSON (without code fences)
 * Uses brace-balancing algorithm to find complete JSON objects
 */
function tryExtractBareJSON(content: string): ParsedPlan | null {
  console.log('[planParser:bare] Searching for bare JSON...')

  // Find potential JSON start points (looking for { "goal": pattern)
  const startPattern = /\{\s*"goal"\s*:/g
  let match: RegExpExecArray | null
  let attemptCount = 0

  while ((match = startPattern.exec(content)) !== null) {
    attemptCount++
    const startIndex = match.index
    console.log(`[planParser:bare] Attempt ${attemptCount}: Found potential start at index ${startIndex}`)

    // Use brace-balancing to find the complete JSON
    const jsonStr = extractBalancedJSON(content, startIndex)

    if (!jsonStr) {
      console.log(`[planParser:bare] Attempt ${attemptCount}: Failed to extract balanced JSON`)
      continue
    }

    console.log(`[planParser:bare] Attempt ${attemptCount}: Extracted ${jsonStr.length} characters, trying to parse...`)

    try {
      const parsed = JSON.parse(jsonStr)

      if (isValidSimpleBranchPlan(parsed)) {
        console.log(`[planParser:bare] Attempt ${attemptCount}: ✅ Valid SimpleBranchPlan found!`)
        const endIndex = startIndex + jsonStr.length
        return {
          plan: parsed as SimpleBranchPlan,
          beforeText: content.substring(0, startIndex).trim(),
          afterText: content.substring(endIndex).trim()
        }
      } else {
        console.log(`[planParser:bare] Attempt ${attemptCount}: ❌ Validation failed - not a valid SimpleBranchPlan`)
      }
    } catch (error) {
      console.log(`[planParser:bare] Attempt ${attemptCount}: ❌ JSON.parse() failed:`, (error as Error).message)
      console.log(`[planParser:bare] Attempt ${attemptCount}: First 200 chars:`, jsonStr.substring(0, 200))
    }
  }

  console.log(`[planParser:bare] No valid bare JSON found after ${attemptCount} attempts`)
  return null
}

/**
 * Extract balanced JSON object using brace depth tracking
 * Handles nested objects, arrays, and escaped characters in strings
 */
function extractBalancedJSON(content: string, startIndex: number): string | null {
  let depth = 0
  let inString = false
  let escape = false

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i]

    // Handle escape sequences
    if (escape) {
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    // Handle string boundaries
    if (char === '"' && !escape) {
      inString = !inString
      continue
    }

    // Only count braces outside of strings
    if (!inString) {
      if (char === '{' || char === '[') {
        depth++
      } else if (char === '}' || char === ']') {
        depth--

        // Found the matching closing brace
        if (depth === 0) {
          return content.substring(startIndex, i + 1)
        }
      }
    }
  }

  // Reached end without finding closing brace
  return null
}

/**
 * Validates that a parsed object matches SimpleBranchPlan structure
 */
function isValidSimpleBranchPlan(obj: any): boolean {
  if (!obj || typeof obj !== 'object') {
    console.log('[planParser:validate] ❌ Not an object')
    return false
  }

  // Required fields
  if (typeof obj.goal !== 'string') {
    console.log('[planParser:validate] ❌ Missing or invalid "goal" field')
    return false
  }
  if (!Array.isArray(obj.todos)) {
    console.log('[planParser:validate] ❌ Missing or invalid "todos" field')
    return false
  }
  if (typeof obj.totalTodos !== 'number') {
    console.log('[planParser:validate] ❌ Missing or invalid "totalTodos" field')
    return false
  }
  if (typeof obj.totalEstimatedDuration !== 'number') {
    console.log('[planParser:validate] ❌ Missing or invalid "totalEstimatedDuration" field')
    return false
  }

  // Validate todos structure
  for (const [idx, todo] of obj.todos.entries()) {
    if (!todo || typeof todo !== 'object') {
      console.log(`[planParser:validate] ❌ Todo ${idx} is not an object`)
      return false
    }
    if (typeof todo.content !== 'string') {
      console.log(`[planParser:validate] ❌ Todo ${idx} missing "content"`)
      return false
    }
    if (typeof todo.activeForm !== 'string') {
      console.log(`[planParser:validate] ❌ Todo ${idx} missing "activeForm"`)
      return false
    }
    if (typeof todo.order !== 'number') {
      console.log(`[planParser:validate] ❌ Todo ${idx} missing "order"`)
      return false
    }
    // estimatedDuration is optional but if present should be a number
    if (todo.estimatedDuration !== undefined && typeof todo.estimatedDuration !== 'number') {
      console.log(`[planParser:validate] ❌ Todo ${idx} has invalid "estimatedDuration"`)
      return false
    }
  }

  console.log('[planParser:validate] ✅ Valid SimpleBranchPlan structure')
  return true
}

/**
 * Removes the JSON plan block from message content
 * Returns only the text parts (before + after)
 */
export function removePlanFromContent(content: string, plan: ParsedPlan): string {
  return [plan.beforeText, plan.afterText].filter(Boolean).join('\n\n').trim()
}
