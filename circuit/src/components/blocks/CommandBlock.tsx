/**
 * CommandBlock - Renders executable shell commands
 *
 * Features:
 * - Execute button to run command
 * - Shows execution status (running/success/error)
 * - Displays last execution result
 * - Copy command button
 * - Minimal design with hover pill
 */

import React, { useState } from 'react'
import type { Block } from '../../types/conversation'
import { Copy, Check, Play, Loader2, AlertCircle, Bookmark, BookmarkCheck } from 'lucide-react'
import { toast } from 'sonner'

const { ipcRenderer } = window.require('electron')

interface CommandBlockProps {
  block: Block
  onCopy: (content: string) => void
  onExecute: (content: string) => void
  onBookmark: (blockId: string) => void
}

export const CommandBlock: React.FC<CommandBlockProps> = ({ block, onCopy, onExecute }) => {
  const [copied, setCopied] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  const handleCopy = () => {
    onCopy(block.content)
    setCopied(true)
    toast.success('Command copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExecute = async () => {
    setExecuting(true)
    try {
      await onExecute(block.content)
    } finally {
      setExecuting(false)
    }
  }

  const handleBookmark = async () => {
    try {
      if (bookmarked) {
        console.log('[CommandBlock] Unbookmark not yet implemented')
      } else {
        const bookmark = {
          id: `bookmark-${Date.now()}`,
          blockId: block.id,
          title: 'Command',
          createdAt: new Date().toISOString(),
        }
        await ipcRenderer.invoke('block:bookmark', bookmark)
        setBookmarked(true)
        console.log('[CommandBlock] Bookmarked:', block.id)
      }
    } catch (error) {
      console.error('[CommandBlock] Bookmark error:', error)
    }
  }

  const exitCode = block.metadata.exitCode
  const executedAt = block.metadata.executedAt
  const hasExecuted = executedAt !== undefined
  const language = block.metadata.language || 'bash'

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--command-border)] bg-[var(--command-bg)]">
      {/* Command content */}
      <div className="p-4">
        <pre
          className="font-mono text-sm text-[var(--command-accent)]"
          style={{
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Source Code Pro", "SF Mono", Menlo, Consolas, Monaco, "Courier New", monospace',
          }}
        >
          {block.content}
        </pre>
      </div>

      {/* Execution status (if executed before) */}
      {hasExecuted && (
        <div className="border-t border-[var(--command-border)] bg-[var(--command-bg)] px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            {exitCode === 0 ? (
              <>
                <Check className="h-3 w-3 text-success" />
                <span className="text-success">Executed successfully</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span className="text-destructive">Exit code: {exitCode}</span>
              </>
            )}
            {executedAt && (
              <span className="text-muted-foreground">
                • {new Date(executedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Hover pill - compact actions */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center gap-0.5 rounded-full bg-background/90 backdrop-blur-sm border border-border shadow-lg px-2 py-1">
          {/* Language label */}
          <span className="text-[10px] font-medium text-muted-foreground px-1.5 font-mono">
            {language}
          </span>

          {/* Divider */}
          <div className="h-3 w-[1px] bg-border mx-0.5" />

          {/* Run button */}
          <button
            onClick={handleExecute}
            disabled={executing}
            className="flex items-center justify-center rounded-full p-1 transition-colors hover:bg-accent disabled:opacity-50"
            title="Run command"
          >
            {executing ? (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            ) : (
              <Play className="h-3 w-3 text-primary fill-primary" />
            )}
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            disabled={executing}
            className="flex items-center justify-center rounded-full p-1 transition-colors hover:bg-accent disabled:opacity-50"
            title="Copy command"
          >
            {copied ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </button>

          {/* Bookmark button */}
          <button
            onClick={handleBookmark}
            disabled={executing}
            className="flex items-center justify-center rounded-full p-1 transition-colors hover:bg-accent disabled:opacity-50"
            title={bookmarked ? 'Bookmarked' : 'Bookmark'}
          >
            {bookmarked ? (
              <BookmarkCheck className="h-3 w-3 text-warning" />
            ) : (
              <Bookmark className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
