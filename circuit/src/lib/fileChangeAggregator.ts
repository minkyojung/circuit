/**
 * FileChangeAggregator - Tracks file changes across tool calls and generates summary blocks
 */

import type { Block, BlockMetadata } from '../types/conversation'

export interface FileChange {
  filePath: string
  changeType: 'created' | 'modified' | 'deleted'
  additions: number
  deletions: number
  toolCallId?: string
}

export class FileChangeAggregator {
  private changes: Map<string, FileChange> = new Map()

  /**
   * Track file changes from Edit tool calls
   */
  trackFromEdit(args: any, result?: any, toolCallId?: string) {
    const filePath = args.file_path
    if (!filePath) return

    const oldString = args.old_string || ''
    const newString = args.new_string || ''

    const stats = this.calculateSimpleDiff(oldString, newString)

    this.changes.set(filePath, {
      filePath,
      changeType: 'modified',
      additions: stats.additions,
      deletions: stats.deletions,
      toolCallId,
    })
  }

  /**
   * Track file changes from Write tool calls
   */
  trackFromWrite(args: any, result?: any, toolCallId?: string) {
    const filePath = args.file_path
    const content = args.content || ''

    if (!filePath) return

    // Determine if this is a new file or modification
    // If we have previous tracking, it's a modification
    const existing = this.changes.get(filePath)
    const isModification = existing !== undefined

    const lines = content.split('\n').length

    this.changes.set(filePath, {
      filePath,
      changeType: isModification ? 'modified' : 'created',
      additions: lines,
      deletions: 0,
      toolCallId,
    })
  }

  /**
   * Track file changes from Bash tool calls (git diff output)
   */
  trackFromGitDiff(diffOutput: string) {
    const files = this.parseGitDiff(diffOutput)
    files.forEach(file => {
      this.changes.set(file.filePath, file)
    })
  }

  /**
   * Track changes from diff blocks
   */
  trackFromDiffBlock(block: Block) {
    const filePath = block.metadata.fileName || block.metadata.filePath
    if (!filePath) return

    const additions = block.metadata.additions || 0
    const deletions = block.metadata.deletions || 0

    this.changes.set(filePath, {
      filePath,
      changeType: 'modified',
      additions,
      deletions,
    })
  }

  /**
   * Calculate simple line-based diff statistics
   */
  private calculateSimpleDiff(oldContent: string, newContent: string): { additions: number; deletions: number } {
    const oldLines = oldContent.split('\n').filter(l => l.trim())
    const newLines = newContent.split('\n').filter(l => l.trim())

    // Simple heuristic: count unique lines
    const oldSet = new Set(oldLines)
    const newSet = new Set(newLines)

    const additions = newLines.filter(line => !oldSet.has(line)).length
    const deletions = oldLines.filter(line => !newSet.has(line)).length

    return { additions, deletions }
  }

  /**
   * Parse git diff output to extract file changes
   */
  private parseGitDiff(diffOutput: string): FileChange[] {
    const files: FileChange[] = []
    const lines = diffOutput.split('\n')

    let currentFile: FileChange | null = null
    let additions = 0
    let deletions = 0

    for (const line of lines) {
      // New file header: diff --git a/path b/path
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          currentFile.additions = additions
          currentFile.deletions = deletions
          files.push(currentFile)
        }

        // Extract file path
        const match = line.match(/diff --git a\/(.+) b\/(.+)/)
        if (match) {
          currentFile = {
            filePath: match[2],
            changeType: 'modified',
            additions: 0,
            deletions: 0,
          }
          additions = 0
          deletions = 0
        }
      }
      // New file
      else if (line.startsWith('new file mode')) {
        if (currentFile) {
          currentFile.changeType = 'created'
        }
      }
      // Deleted file
      else if (line.startsWith('deleted file mode')) {
        if (currentFile) {
          currentFile.changeType = 'deleted'
        }
      }
      // Addition
      else if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++
      }
      // Deletion
      else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++
      }
    }

    // Add last file
    if (currentFile) {
      currentFile.additions = additions
      currentFile.deletions = deletions
      files.push(currentFile)
    }

    return files
  }

  /**
   * Get aggregated summary of all tracked changes
   */
  getSummary(): BlockMetadata {
    const files = Array.from(this.changes.values())
    return {
      files,
      totalFiles: files.length,
      totalAdditions: files.reduce((sum, f) => sum + f.additions, 0),
      totalDeletions: files.reduce((sum, f) => sum + f.deletions, 0),
    }
  }

  /**
   * Create a file-summary block from aggregated changes
   */
  createFileSummaryBlock(messageId: string): Block | null {
    if (this.changes.size === 0) return null

    const summary = this.getSummary()

    return {
      id: `file-summary-${messageId}-${Date.now()}`,
      messageId,
      type: 'file-summary',
      content: `${summary.totalFiles} ${summary.totalFiles === 1 ? 'file' : 'files'} changed`,
      metadata: summary,
      order: 9999, // Always at the end
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Check if there are any tracked changes
   */
  hasChanges(): boolean {
    return this.changes.size > 0
  }

  /**
   * Clear all tracked changes
   */
  clear() {
    this.changes.clear()
  }

  /**
   * Get number of files tracked
   */
  getFileCount(): number {
    return this.changes.size
  }
}
