/**
 * File utility functions
 * Icons, extensions, file name parsing, etc.
 */

import { LucideIcon } from 'lucide-react'
import {
  FileJson,
  FileCode,
  FileText,
  FileType,
  Braces,
  FileImage,
  FileVideo,
  FileArchive,
  Settings,
  File,
} from 'lucide-react'

/**
 * Get file icon based on extension
 */
export function getFileIcon(filePath: string): LucideIcon {
  const ext = filePath.split('.').pop()?.toLowerCase()

  // Code files
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) return FileCode
  if (['py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'rb', 'php'].includes(ext || '')) return FileCode

  // Markup/Data
  if (['json', 'jsonc'].includes(ext || '')) return FileJson
  if (['html', 'xml', 'svg'].includes(ext || '')) return Braces
  if (['md', 'mdx', 'txt'].includes(ext || '')) return FileText
  if (['css', 'scss', 'sass', 'less'].includes(ext || '')) return FileType

  // Config files
  if (['yaml', 'yml', 'toml', 'ini', 'conf', 'env'].includes(ext || '')) return Settings

  // Media
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext || '')) return FileImage
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) return FileVideo

  // Archives
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext || '')) return FileArchive

  // Default
  return File
}

/**
 * Get file name from path
 */
export function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath
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
