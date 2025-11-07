/**
 * PathResolver - Centralized file path normalization service
 *
 * Single source of truth for all file path operations.
 * Ensures consistent path formatting across the entire application,
 * eliminating temporal mismatches when workspaces switch.
 *
 * Design Principles:
 * - Normalize at use time, not storage time
 * - All paths are workspace-relative (e.g., "src/App.tsx")
 * - Immutable after creation (use updateProjectRoot for changes)
 */

export class PathResolver {
  private projectRoot: string

  /**
   * Create a new PathResolver for the given project root
   * @param projectRoot - Absolute path to project root (may include .conductor path)
   */
  constructor(projectRoot: string) {
    this.projectRoot = this.normalizeProjectRoot(projectRoot)
  }

  /**
   * Normalize project root to ensure it points to the actual project directory
   * Strips .conductor workspace paths if present
   */
  private normalizeProjectRoot(root: string): string {
    if (!root) return ''

    // Remove .conductor workspace path if present
    // e.g., /project/.conductor/workspaces/foo -> /project
    if (root.includes('/.conductor/')) {
      return root.split('/.conductor/')[0]
    }

    return root
  }

  /**
   * Normalize any file path to workspace-relative format
   * This is the ONLY place where normalization logic exists
   *
   * Examples:
   * - "/project/src/App.tsx" -> "src/App.tsx"
   * - "./src/App.tsx" -> "src/App.tsx"
   * - "src\\App.tsx" -> "src/App.tsx"
   *
   * @param filePath - Any file path (absolute, relative, or already normalized)
   * @returns Workspace-relative path with forward slashes
   */
  normalize(filePath: string): string {
    if (!filePath) return ''

    let normalized = filePath

    // 1. Convert absolute path to relative path
    if (normalized.startsWith('/') || normalized.match(/^[A-Z]:\\/)) {
      // This is an absolute path
      if (normalized.startsWith(this.projectRoot)) {
        // Remove project root prefix
        normalized = normalized.slice(this.projectRoot.length)

        // Remove leading slash
        if (normalized.startsWith('/') || normalized.startsWith('\\')) {
          normalized = normalized.slice(1)
        }
      } else {
        // File is outside project root
        // Log warning but continue - we'll let file existence check handle it
        console.warn('[PathResolver] File path outside project root:', {
          filePath,
          projectRoot: this.projectRoot,
        })
      }
    }

    // 2. Remove "./" or ".\\" prefix
    normalized = normalized.replace(/^\.\//, '')
    normalized = normalized.replace(/^\.\\/, '')

    // 3. Normalize path separators (convert backslashes to forward slashes)
    normalized = normalized.replace(/\\/g, '/')

    return normalized
  }

  /**
   * Convert workspace-relative path to absolute path
   *
   * @param relativePath - Workspace-relative path (e.g., "src/App.tsx")
   * @returns Absolute path (e.g., "/project/src/App.tsx")
   */
  toAbsolute(relativePath: string): string {
    const normalized = this.normalize(relativePath)

    if (!normalized) return this.projectRoot

    return `${this.projectRoot}/${normalized}`
  }

  /**
   * Update the project root (for workspace switching)
   *
   * @param newRoot - New project root path
   */
  updateProjectRoot(newRoot: string): void {
    this.projectRoot = this.normalizeProjectRoot(newRoot)
  }

  /**
   * Get the current project root
   */
  getProjectRoot(): string {
    return this.projectRoot
  }
}
