/**
 * IPC Handlers for Design Control Operations
 *
 * Handles file updates when users adjust design values via inline design controls
 * MVP: Tailwind spacing class replacements only
 */

import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

interface ApplySpacingChangeParams {
  filePath: string
  oldClass: string
  newClass: string
}

/**
 * Register all design control IPC handlers
 */
export function registerDesignHandlers(): void {
  /**
   * Apply a spacing class change to a file
   * Replaces oldClass with newClass in className attributes
   */
  ipcMain.handle(
    'design:apply-spacing-change',
    async (event, params: ApplySpacingChangeParams): Promise<void> => {
      const { filePath, oldClass, newClass } = params

      try {
        // Read file content
        const content = await fs.readFile(filePath, 'utf-8')

        // Replace spacing class in className attributes
        // Pattern: className="... oldClass ..." → className="... newClass ..."
        const updatedContent = replaceSpacingClass(content, oldClass, newClass)

        // Write back to file
        await fs.writeFile(filePath, updatedContent, 'utf-8')

        console.log(
          `[DesignHandlers] Applied spacing change: ${oldClass} → ${newClass} in ${filePath}`
        )
      } catch (error: any) {
        console.error(
          `[DesignHandlers] Error applying spacing change in ${filePath}:`,
          error
        )
        throw new Error(`Failed to apply spacing change: ${error.message}`)
      }
    }
  )
}

/**
 * Replace spacing class in file content
 * Handles both single and multi-line className attributes
 *
 * Examples:
 * - className="p-3 text-base" → className="p-4 text-base"
 * - className='p-3 text-base' → className='p-4 text-base'
 * - className={cn("p-3", "text-base")} → className={cn("p-4", "text-base")}
 */
function replaceSpacingClass(
  content: string,
  oldClass: string,
  newClass: string
): string {
  // Escape special regex characters
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedOldClass = escapeRegex(oldClass)

  // Pattern 1: className="... oldClass ..."
  // Use word boundaries to avoid partial matches
  const pattern1 = new RegExp(
    `(className\\s*=\\s*["'\`][^"'\`]*\\b)${escapedOldClass}(\\b[^"'\`]*["'\`])`,
    'g'
  )
  content = content.replace(pattern1, `$1${newClass}$2`)

  // Pattern 2: className={cn("... oldClass ...", ...)}
  // Handle template literals and function calls
  const pattern2 = new RegExp(
    `(className\\s*=\\s*\\{[^}]*["'\`][^"'\`]*\\b)${escapedOldClass}(\\b[^"'\`]*["'\`][^}]*\\})`,
    'g'
  )
  content = content.replace(pattern2, `$1${newClass}$2`)

  // Pattern 3: className={`... oldClass ...`}
  // Template literals
  const pattern3 = new RegExp(
    `(className\\s*=\\s*\\{\`[^\`]*\\b)${escapedOldClass}(\\b[^\`]*\`\\})`,
    'g'
  )
  content = content.replace(pattern3, `$1${newClass}$2`)

  return content
}
