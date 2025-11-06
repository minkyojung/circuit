/**
 * FileReferencePill - Clickable pill for file references in Claude messages
 *
 * Renders file paths like "src/App.tsx:42" as interactive pills
 * that open the file and jump to the specified line
 */

import React, { useState, useEffect } from 'react'
import { File } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useProjectPath } from '@/App'

// @ts-ignore
const { ipcRenderer } = window.require('electron')

interface FileReferencePillProps {
  filePath: string
  lineStart?: number
  lineEnd?: number
  onClick: (filePath: string, lineStart?: number, lineEnd?: number) => void
  className?: string
  workspaceRoot?: string  // Optional: specific workspace root to check against
}

export function FileReferencePill({
  filePath,
  lineStart,
  lineEnd,
  onClick,
  className,
  workspaceRoot
}: FileReferencePillProps) {
  const { projectPath } = useProjectPath()
  const [exists, setExists] = useState<boolean | null>(null)

  // Check file existence on mount
  useEffect(() => {
    const checkFileExists = async () => {
      // Use workspaceRoot if provided, otherwise fallback to projectPath
      const root = workspaceRoot || projectPath
      if (!root) {
        setExists(null)
        return
      }

      // Build absolute path
      const absolutePath = filePath.startsWith('/') || filePath.match(/^[A-Z]:\\/)
        ? filePath
        : `${root}/${filePath}`

      try {
        const fileExists = await ipcRenderer.invoke('file-exists', absolutePath)
        setExists(fileExists)
      } catch (error) {
        console.error('[FileReferencePill] Error checking file existence:', error)
        setExists(null)
      }
    }

    checkFileExists()
  }, [filePath, workspaceRoot, projectPath])

  // Extract filename and directory
  const pathParts = filePath.split('/')
  const fileName = pathParts[pathParts.length - 1]
  const directory = pathParts.slice(0, -1).join('/')

  // Build display text
  const lineInfo = lineStart
    ? lineEnd && lineEnd !== lineStart
      ? `:${lineStart}-${lineEnd}`
      : `:${lineStart}`
    : ''

  // Handle click with validation
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()

    if (exists === false) {
      toast.error(`파일을 찾을 수 없습니다: ${filePath}`)
      return
    }

    onClick(filePath, lineStart, lineEnd)
  }

  return (
    <button
      onClick={handleClick}
      disabled={exists === false}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md',
        'border transition-all',
        'text-xs font-mono',
        // Conditional styling based on file existence
        exists === false
          ? 'opacity-50 cursor-not-allowed bg-gray-500/10 border-gray-500/30 hover:bg-gray-500/10 hover:border-gray-500/30'
          : 'bg-green-700/15 hover:bg-green-700/25 border-green-700/40 hover:border-green-700/60 cursor-pointer',
        className
      )}
      title={
        exists === false
          ? `File not found: ${filePath}${lineInfo}`
          : `Open ${filePath}${lineInfo}`
      }
    >
      {/* File icon */}
      <File
        className={cn(
          'w-3 h-3 flex-shrink-0',
          exists === false ? 'text-gray-400' : 'text-green-600'
        )}
        strokeWidth={2}
      />

      {/* File path */}
      <span className="flex items-baseline gap-0.5">
        {directory && (
          <span className={cn(exists === false ? 'text-gray-400/60' : 'text-green-500/70')}>
            {directory}/
          </span>
        )}
        <span className={cn('font-medium', exists === false ? 'text-gray-400' : 'text-green-500')}>
          {fileName}
        </span>
        {lineInfo && (
          <span className={cn(exists === false ? 'text-gray-300/60' : 'text-green-400/70')}>
            {lineInfo}
          </span>
        )}
      </span>
    </button>
  )
}
