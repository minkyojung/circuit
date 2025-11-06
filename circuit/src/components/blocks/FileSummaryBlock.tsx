/**
 * FileSummaryBlock - Displays a summary of file changes at the end of assistant messages
 * Shows total files changed with additions/deletions statistics
 * Expandable to show detailed line-by-line diff for each file
 */

import React, { useState } from 'react'
import type { Block } from '../../types/conversation'
import { ChevronRight, FileCode, Square } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FileSummaryBlockProps {
  block: Block
  onFileClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void
  /** Compact mode: renders without outer border and header, suitable for embedding */
  compact?: boolean
}

export const FileSummaryBlock: React.FC<FileSummaryBlockProps> = ({ block, onFileClick, compact = false }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set())

  const files = block.metadata.files || []
  const totalFiles = block.metadata.totalFiles || files.length
  const totalAdditions = block.metadata.totalAdditions || 0
  const totalDeletions = block.metadata.totalDeletions || 0

  if (files.length === 0) return null

  const getFileIcon = (changeType: 'created' | 'modified' | 'deleted', compact = false) => {
    const size = compact ? "w-3.5 h-3.5" : "w-4 h-4"
    return <FileCode className={`${size} flex-shrink-0 text-blue-400`} />
  }

  const toggleFileExpansion = (idx: number) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx)
    } else {
      newExpanded.add(idx)
    }
    setExpandedFiles(newExpanded)
  }

  // Compact mode: render file list directly without wrapper
  if (compact) {
    return (
      <div className="py-1">
        {files.map((file, idx) => {
          const isFileExpanded = expandedFiles.has(idx)
          const hasDiffLines = file.diffLines && file.diffLines.length > 0

          return (
            <div key={idx} className="">
              {/* File header */}
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  if (hasDiffLines) {
                    toggleFileExpansion(idx)
                  } else if (onFileClick && file.filePath) {
                    onFileClick(file.filePath)
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-secondary/50 transition-colors",
                  (hasDiffLines || onFileClick) && "cursor-pointer"
                )}
              >
                {hasDiffLines && (
                  <ChevronRight
                    className={cn(
                      "w-3 h-3 transition-transform text-muted-foreground flex-shrink-0",
                      isFileExpanded && "rotate-90"
                    )}
                  />
                )}
                {getFileIcon(file.changeType, true)}
                <span className="text-xs font-mono flex-1 truncate text-foreground/80 font-light">
                  {file.filePath}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] font-mono flex-shrink-0">
                  {file.additions > 0 && (
                    <span className="text-green-500">+{file.additions}</span>
                  )}
                  {file.deletions > 0 && (
                    <span className="text-red-500">-{file.deletions}</span>
                  )}
                </div>
              </div>

              {/* Diff lines (if expanded) */}
              {isFileExpanded && hasDiffLines && (
                <div className="ml-9 mt-1 mb-2 bg-background/50 rounded border border-border/30 overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto text-xs font-mono">
                    {file.diffLines?.map((line, lineIdx) => (
                      <div
                        key={lineIdx}
                        className={cn(
                          "px-3 py-0.5 leading-relaxed",
                          line.type === 'add' && "bg-green-500/10 text-green-400",
                          line.type === 'remove' && "bg-red-500/10 text-red-400",
                          line.type === 'unchanged' && "text-muted-foreground/60"
                        )}
                      >
                        <span className="select-none mr-2 inline-block w-4">
                          {line.type === 'add' && '+'}
                          {line.type === 'remove' && '-'}
                          {line.type === 'unchanged' && ' '}
                        </span>
                        {line.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Default mode: render with border and header
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
          {files.map((file, idx) => {
            const isFileExpanded = expandedFiles.has(idx)
            const hasDiffLines = file.diffLines && file.diffLines.length > 0

            return (
              <div key={idx} className="bg-background/30">
                {/* File header */}
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    if (hasDiffLines) {
                      toggleFileExpansion(idx)
                    } else {
                      onFileClick?.(file.filePath)
                    }
                  }}
                  className="flex items-center justify-between px-3 py-2 hover:bg-accent/20 cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {hasDiffLines && (
                      <ChevronRight
                        className={cn(
                          "w-3 h-3 transition-transform text-muted-foreground",
                          isFileExpanded && "rotate-90"
                        )}
                      />
                    )}
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

                {/* Detailed diff view */}
                {isFileExpanded && hasDiffLines && (
                  <div className="bg-background/70 border-t border-border/30 max-h-96 overflow-y-auto">
                    <div className="font-mono text-xs">
                      {file.diffLines.map((line, lineIdx) => (
                        <div
                          key={lineIdx}
                          className={cn(
                            "px-3 py-0.5 leading-relaxed",
                            line.type === 'add' && "bg-green-500/10 text-green-400",
                            line.type === 'remove' && "bg-red-500/10 text-red-400",
                            line.type === 'unchanged' && "text-muted-foreground/70"
                          )}
                        >
                          <span className="select-none mr-2 inline-block w-4">
                            {line.type === 'add' && '+'}
                            {line.type === 'remove' && '-'}
                            {line.type === 'unchanged' && ' '}
                          </span>
                          <span>{line.content || ' '}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
