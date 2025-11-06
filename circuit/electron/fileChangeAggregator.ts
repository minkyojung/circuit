/**
 * FileChangeAggregator - Tracks file changes across tool calls and generates summary blocks
 */

// Local type definitions to avoid cross-folder imports
interface Block {
  id: string
  messageId: string
  type: string
  content: string
  metadata: any
  order?: number
  createdAt?: string
}

interface BlockMetadata {
  fileName?: string
  filePath?: string
  additions?: number
  deletions?: number
  files?: FileChange[]
  totalFiles?: number
  totalAdditions?: number
  totalDeletions?: number
}

export interface FileChange {
  filePath: string
  changeType: 'created' | 'modified' | 'deleted'
  additions: number
  deletions: number
  toolCallId?: string
  // Diff content for detailed view
  oldContent?: string
  newContent?: string
  diffLines?: Array<{ type: 'add' | 'remove' | 'unchanged'; content: string }>
}

export class FileChangeAggregator {
  private changes: Map<string, FileChange> = new Map()
  private projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  /**
   * Normalize file path to workspace-relative path
   * Ensures consistent path format across all file operations
   */
  private normalizeFilePath(filePath: string): string | null {
    if (!filePath) return null

    let normalized = filePath

    // Convert absolute path to relative path
    if (normalized.startsWith('/') || normalized.match(/^[A-Z]:\\/)) {
      // Absolute path
      if (normalized.startsWith(this.projectRoot)) {
        // Remove project root prefix
        normalized = normalized.slice(this.projectRoot.length)
        // Remove leading slash
        if (normalized.startsWith('/') || normalized.startsWith('\\')) {
          normalized = normalized.slice(1)
        }
      } else {
        // File outside project root - ignore it
        console.warn('[FileChangeAggregator] File outside project root, ignoring:', filePath)
        return null
      }
    }

    // Remove "./" prefix
    normalized = normalized.replace(/^\.\//, '')
    normalized = normalized.replace(/^\.\\/, '')

    // Normalize path separators (convert backslashes to forward slashes)
    normalized = normalized.replace(/\\/g, '/')

    return normalized
  }

  /**
   * Track file changes from Edit tool calls
   */
  trackFromEdit(args: any, result?: any, toolCallId?: string) {
    const filePath = args.file_path
    if (!filePath) return

    // ✅ Normalize file path
    const normalizedPath = this.normalizeFilePath(filePath)
    if (!normalizedPath) return // Ignore files outside project

    const oldString = args.old_string || ''
    const newString = args.new_string || ''

    const stats = this.calculateSimpleDiff(oldString, newString)
    const diffLines = this.generateDiffLines(oldString, newString)

    this.changes.set(normalizedPath, {
      filePath: normalizedPath,  // ✅ Store normalized path
      changeType: 'modified',
      additions: stats.additions,
      deletions: stats.deletions,
      toolCallId,
      // ✅ Store diff content for detailed view
      oldContent: oldString,
      newContent: newString,
      diffLines,
    })
  }

  /**
   * Track file changes from Write tool calls
   */
  trackFromWrite(args: any, result?: any, toolCallId?: string) {
    const filePath = args.file_path
    const content = args.content || ''

    if (!filePath) return

    // ✅ Normalize file path
    const normalizedPath = this.normalizeFilePath(filePath)
    if (!normalizedPath) return // Ignore files outside project

    // Determine if this is a new file or modification
    // If we have previous tracking, it's a modification
    const existing = this.changes.get(normalizedPath)
    const isModification = existing !== undefined

    const lines = content.split('\n').length

    this.changes.set(normalizedPath, {
      filePath: normalizedPath,  // ✅ Store normalized path
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
      // ✅ Normalize file path
      const normalizedPath = this.normalizeFilePath(file.filePath)
      if (!normalizedPath) return // Skip files outside project

      this.changes.set(normalizedPath, {
        ...file,
        filePath: normalizedPath,  // ✅ Store normalized path
      })
    })
  }

  /**
   * Track changes from diff blocks
   */
  trackFromDiffBlock(block: Block) {
    const filePath = block.metadata.fileName || block.metadata.filePath
    if (!filePath) return

    // ✅ Normalize file path
    const normalizedPath = this.normalizeFilePath(filePath)
    if (!normalizedPath) return // Ignore files outside project

    const additions = block.metadata.additions || 0
    const deletions = block.metadata.deletions || 0

    this.changes.set(normalizedPath, {
      filePath: normalizedPath,  // ✅ Store normalized path
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
   * Generate line-by-line diff for detailed view
   */
  private generateDiffLines(oldContent: string, newContent: string): Array<{ type: 'add' | 'remove' | 'unchanged'; content: string }> {
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')
    const diffLines: Array<{ type: 'add' | 'remove' | 'unchanged'; content: string }> = []

    // Simple line-based diff algorithm
    // For each old line, check if it exists in new lines
    const oldSet = new Set(oldLines)
    const newSet = new Set(newLines)

    const processedNew = new Set<number>()

    // First pass: match old lines
    for (let i = 0; i < oldLines.length; i++) {
      const oldLine = oldLines[i]

      // Find matching line in new content
      const newIndex = newLines.findIndex((line, idx) =>
        line === oldLine && !processedNew.has(idx)
      )

      if (newIndex !== -1) {
        // Line unchanged
        diffLines.push({ type: 'unchanged', content: oldLine })
        processedNew.add(newIndex)
      } else {
        // Line removed
        diffLines.push({ type: 'remove', content: oldLine })
      }
    }

    // Second pass: add new lines
    for (let i = 0; i < newLines.length; i++) {
      if (!processedNew.has(i)) {
        // Insert added line at appropriate position
        diffLines.push({ type: 'add', content: newLines[i] })
      }
    }

    return diffLines
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
