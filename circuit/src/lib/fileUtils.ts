/**
 * File utility functions
 * Icons, extensions, file name parsing, etc.
 */

/**
 * Normalize file path to workspace-relative path
 *
 * This function ensures all file paths are consistently represented as
 * workspace-relative paths, regardless of how they were originally specified.
 *
 * @param filePath - The file path to normalize (can be relative or absolute)
 * @param projectRoot - The absolute path to the project root
 * @returns A normalized workspace-relative path
 *
 * @example
 * normalizeFilePath("src/App.tsx", "/Users/william/project")
 * // → "src/App.tsx"
 *
 * normalizeFilePath("/Users/william/project/src/App.tsx", "/Users/william/project")
 * // → "src/App.tsx"
 *
 * normalizeFilePath("./src/App.tsx", "/Users/william/project")
 * // → "src/App.tsx"
 */
export function normalizeFilePath(filePath: string, projectRoot: string): string {
  // Handle empty or invalid inputs
  if (!filePath || !projectRoot) {
    return filePath;
  }

  let normalized = filePath;

  // 1. Convert absolute path to relative path
  if (normalized.startsWith('/') || normalized.match(/^[A-Z]:\\/)) {
    // Absolute path (Unix or Windows)
    if (normalized.startsWith(projectRoot)) {
      // Remove project root prefix
      normalized = normalized.slice(projectRoot.length);
      // Remove leading slash
      if (normalized.startsWith('/') || normalized.startsWith('\\')) {
        normalized = normalized.slice(1);
      }
    }
  }

  // 2. Remove "./" prefix (current directory)
  normalized = normalized.replace(/^\.\//, '');
  normalized = normalized.replace(/^\.\\/, ''); // Windows

  // 3. Normalize path separators (convert backslashes to forward slashes)
  normalized = normalized.replace(/\\/g, '/');

  return normalized;
}

/**
 * Get file name from path (without directory)
 */
export function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

/**
 * Get file extension
 */
export function getFileExtension(filePath: string): string {
  const ext = filePath.split('.').pop()
  return ext ? ext.toLowerCase() : ''
}

/**
 * Get language for Monaco Editor based on file extension
 */
export function getLanguageFromFilePath(filePath: string): string {
  const ext = getFileExtension(filePath)

  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'json': 'json',
    'jsonc': 'json',
    'md': 'markdown',
    'mdx': 'markdown',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'rb': 'ruby',
    'php': 'php',
    'sql': 'sql',
    'xml': 'xml',
    'toml': 'toml',
    'ini': 'ini',
  }

  return languageMap[ext] || 'plaintext'
}
