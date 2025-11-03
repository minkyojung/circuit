/**
 * File utility functions
 * Icons, extensions, file name parsing, etc.
 */

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
