/**
 * FileSummaryBlock - Displays a summary of file changes at the end of assistant messages
 * Shows total files changed with additions/deletions statistics
 */

import React, { useState } from 'react'
import type { Block } from '../../types/conversation'
import { ChevronRight, FileCode, Square } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FileSummaryBlockProps {
  block: Block
  onFileClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void
}

export const FileSummaryBlock: React.FC<FileSummaryBlockProps> = ({ block, onFileClick }) => {
  const [isExpanded, setIsExpanded] = useState(true)

  const files = block.metadata.files || []
  const totalFiles = block.metadata.totalFiles || files.length
  const totalAdditions = block.metadata.totalAdditions || 0
  const totalDeletions = block.metadata.totalDeletions || 0

  if (files.length === 0) return null

  const getFileIcon = (changeType: 'created' | 'modified' | 'deleted') => {
    return <FileCode className="w-4 h-4 flex-shrink-0 text-blue-400" />
  }

  return (
    <div className="mt-4 mb-2 border border-border rounded-lg overflow-hidden bg-background/50">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-accent/30 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={cn(
              "w-4 h-4 transition-transform text-muted-foreground",
              isExpanded && "rotate-90"
            )}
          />
          <span className="font-medium text-sm">
            {totalFiles} {totalFiles === 1 ? 'file' : 'files'} changed
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm font-mono">
          <span className="text-green-500 font-medium">+{totalAdditions}</span>
          <span className="text-red-500 font-medium">-{totalDeletions}</span>
          <Square className="w-3 h-3 text-muted-foreground" />
        </div>
      </button>

      {/* File list */}
      {isExpanded && (
        <div className="divide-y divide-border/50">
          {files.map((file, idx) => (
            <div
              key={idx}
              onClick={() => onFileClick?.(file.filePath)}
              className="flex items-center justify-between px-3 py-2 hover:bg-accent/20 cursor-pointer group transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(file.changeType)}
                <span className="font-mono text-xs truncate text-foreground/90">
                  {file.filePath}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono ml-3">
                <span className="text-green-500">+{file.additions}</span>
                <span className="text-red-500">-{file.deletions}</span>
                <Square className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
