/**
 * Design Change Detector Service
 *
 * Analyzes AI responses to detect design-related changes (spacing, colors, typography, etc.)
 * MVP: Focus on Tailwind spacing classes (p-*, m-*, gap-*, space-*)
 *
 * This enables inline design controls for quick visual adjustments without re-prompting
 */

import type { Message, Block, DesignChange, SpacingProperty } from '@/types/conversation'

/**
 * Tailwind spacing scale mapping
 * px/py/pt/pr/pb/pl, mx/my/mt/mr/mb/ml, gap-x/gap-y, space-x/space-y
 */
const TAILWIND_SPACING_MAP: Record<string, number> = {
  '0': 0,
  'px': 1,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '11': 44,
  '12': 48,
  '14': 56,
  '16': 64,
  '20': 80,
  '24': 96,
  '28': 112,
  '32': 128,
}

/**
 * Regex patterns for detecting spacing classes
 */
const SPACING_CLASS_PATTERNS = {
  padding: /\b(p[xytrbl]?)-(\d+\.?\d*)\b/g,
  margin: /\b(m[xytrbl]?)-(\d+\.?\d*)\b/g,
  gap: /\b(gap-[xy]?)-(\d+\.?\d*)\b/g,
  space: /\b(space-[xy])-(\d+\.?\d*)\b/g,
}

export class DesignChangeDetector {
  /**
   * Main detection method
   * Analyzes a message and returns detected design changes
   */
  static detect(message: Message): DesignChange[] {
    if (!message.blocks || message.blocks.length === 0) {
      return []
    }

    const changes: DesignChange[] = []

    // Find file-summary blocks (these contain diff information)
    const fileSummaryBlocks = message.blocks.filter((b) => b.type === 'file-summary')

    for (const block of fileSummaryBlocks) {
      const blockChanges = this.detectFromFileSummary(block)
      changes.push(...blockChanges)
    }

    return this.deduplicateChanges(changes)
  }

  /**
   * Detect design changes from file-summary block
   */
  private static detectFromFileSummary(block: Block): DesignChange[] {
    const changes: DesignChange[] = []
    const files = block.metadata.files || []

    for (const file of files) {
      if (file.changeType !== 'modified') continue

      const diffLines = file.diffLines || []

      // Look for remove/add pairs (modifications)
      for (let i = 0; i < diffLines.length; i++) {
        const line = diffLines[i]

        if (line.type === 'add') {
          const prevLine = diffLines[i - 1]

          // Check if previous line is a removal (indicating a modification)
          if (prevLine && prevLine.type === 'remove') {
            const detectedChanges = this.compareLines(
              prevLine.content,
              line.content,
              file.filePath
            )
            changes.push(...detectedChanges)
          }
        }
      }
    }

    return changes
  }

  /**
   * Compare two lines to detect spacing class changes
   */
  private static compareLines(
    oldLine: string,
    newLine: string,
    filePath: string
  ): DesignChange[] {
    const changes: DesignChange[] = []

    // Extract className attributes from both lines
    const oldClasses = this.extractClassNames(oldLine)
    const newClasses = this.extractClassNames(newLine)

    if (oldClasses.length === 0 || newClasses.length === 0) {
      return []
    }

    // Compare spacing classes
    for (const [property, pattern] of Object.entries(SPACING_CLASS_PATTERNS)) {
      const oldSpacingClasses = this.findSpacingClasses(oldClasses, pattern)
      const newSpacingClasses = this.findSpacingClasses(newClasses, pattern)

      // Find changes (same prefix, different value)
      for (const oldClass of oldSpacingClasses) {
        const oldPrefix = oldClass.match(/^([a-z-]+)-/)?.[1]
        if (!oldPrefix) continue

        for (const newClass of newSpacingClasses) {
          const newPrefix = newClass.match(/^([a-z-]+)-/)?.[1]

          // Same property, different value
          if (oldPrefix === newPrefix && oldClass !== newClass) {
            const change = this.createDesignChange(
              oldClass,
              newClass,
              property as SpacingProperty,
              filePath
            )

            if (change) {
              changes.push(change)
            }
          }
        }
      }
    }

    return changes
  }

  /**
   * Extract className values from a line of code
   */
  private static extractClassNames(line: string): string[] {
    // Match: className="..." or className='...'
    const classNameMatch = line.match(/className=["']([^"']+)["']/)
    if (!classNameMatch) return []

    return classNameMatch[1].split(/\s+/).filter(Boolean)
  }

  /**
   * Find spacing classes matching a pattern
   */
  private static findSpacingClasses(classes: string[], pattern: RegExp): string[] {
    const matches: string[] = []

    for (const cls of classes) {
      // Reset regex lastIndex
      pattern.lastIndex = 0
      if (pattern.test(cls)) {
        matches.push(cls)
      }
    }

    return matches
  }

  /**
   * Create a DesignChange object from old/new class names
   */
  private static createDesignChange(
    oldClass: string,
    newClass: string,
    property: SpacingProperty,
    filePath: string
  ): DesignChange | null {
    const oldPx = this.tailwindToPx(oldClass)
    const newPx = this.tailwindToPx(newClass)

    if (oldPx === null || newPx === null) {
      return null
    }

    return {
      id: this.generateId(),
      type: 'spacing',
      property,
      oldValue: oldClass,
      newValue: newClass,
      filePath,
      oldValuePx: oldPx,
      newValuePx: newPx,
    }
  }

  /**
   * Convert Tailwind spacing class to pixels
   * e.g., "p-4" → 16, "mx-6" → 24
   */
  private static tailwindToPx(className: string): number | null {
    const match = className.match(/-(\d+\.?\d*)$/)
    if (!match) return null

    const value = match[1]
    return TAILWIND_SPACING_MAP[value] || null
  }

  /**
   * Convert pixels to closest Tailwind spacing class
   */
  static pxToTailwind(px: number, prefix: string): string {
    // Find closest Tailwind value
    let closestValue = '0'
    let closestDiff = Infinity

    for (const [key, value] of Object.entries(TAILWIND_SPACING_MAP)) {
      const diff = Math.abs(value - px)
      if (diff < closestDiff) {
        closestDiff = diff
        closestValue = key
      }
    }

    return `${prefix}-${closestValue}`
  }

  /**
   * Deduplicate changes (same file, same property)
   */
  private static deduplicateChanges(changes: DesignChange[]): DesignChange[] {
    const seen = new Set<string>()
    const unique: DesignChange[] = []

    for (const change of changes) {
      const key = `${change.filePath}:${change.property}:${change.oldValue}`

      if (!seen.has(key)) {
        seen.add(key)
        unique.push(change)
      }
    }

    return unique
  }

  /**
   * Generate unique ID for design changes
   */
  private static generateId(): string {
    return `dc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Validate if a pixel value is within reasonable bounds
   */
  static isValidSpacingPx(px: number): boolean {
    return px >= 0 && px <= 128
  }
}
