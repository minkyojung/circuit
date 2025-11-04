/**
 * FileReferencePill - Clickable pill for file references in Claude messages
 *
 * Renders file paths like "src/App.tsx:42" as interactive pills
 * that open the file and jump to the specified line
 */

import React from 'react'
import { File } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileReferencePillProps {
  filePath: string
  lineStart?: number
  lineEnd?: number
  onClick: (filePath: string, lineStart?: number, lineEnd?: number) => void
  className?: string
}

export function FileReferencePill({
  filePath,
  lineStart,
  lineEnd,
  onClick,
  className
}: FileReferencePillProps) {
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

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        onClick(filePath, lineStart, lineEnd)
      }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md',
        'bg-blue-500/10 hover:bg-blue-500/20',
        'border border-blue-500/30 hover:border-blue-500/50',
        'transition-all cursor-pointer',
        'text-xs font-mono',
        className
      )}
      title={`Open ${filePath}${lineInfo}`}
    >
      {/* File icon */}
      <File className="w-3 h-3 text-blue-400 flex-shrink-0" strokeWidth={2} />

      {/* File path */}
      <span className="flex items-baseline gap-0.5">
        {directory && (
          <span className="text-blue-400/60">{directory}/</span>
        )}
        <span className="text-blue-400 font-medium">{fileName}</span>
        {lineInfo && (
          <span className="text-blue-300/60">{lineInfo}</span>
        )}
      </span>
    </button>
  )
}
