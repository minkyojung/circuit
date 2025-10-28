/**
 * CommandBlock - Renders executable shell commands
 *
 * Features:
 * - Execute button to run command
 * - Shows execution status (running/success/error)
 * - Displays last execution result
 * - Copy command button
 */

import React, { useState } from 'react'
import type { Block } from '../../types/conversation'
import { Copy, Check, Play, Loader2, Terminal, AlertCircle, Bookmark, BookmarkCheck } from 'lucide-react'

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

  return (
    <div className="group relative overflow-hidden rounded-lg border border-purple-500/30 bg-purple-500/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-purple-500/20 bg-purple-500/10 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs">
          <Terminal className="h-3 w-3 text-purple-400" />
          <span className="font-semibold text-purple-300">Command</span>
          {block.metadata.language && (
            <span className="text-purple-400/70">({block.metadata.language})</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Bookmark button */}
          <button
            onClick={handleBookmark}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors hover:bg-purple-500/20"
            title={bookmarked ? 'Bookmarked' : 'Bookmark this command'}
            disabled={executing}
          >
            {bookmarked ? (
              <BookmarkCheck className="h-3 w-3 text-yellow-500" />
            ) : (
              <Bookmark className="h-3 w-3 text-purple-300" />
            )}
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors hover:bg-purple-500/20"
            title="Copy command"
            disabled={executing}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="text-green-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-purple-300" />
                <span className="text-purple-300">Copy</span>
              </>
            )}
          </button>

          {/* Execute button */}
          <button
            onClick={handleExecute}
            disabled={executing}
            className="flex items-center gap-1 rounded bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-500/30 disabled:opacity-50"
            title="Run command"
          >
            {executing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                <span>Run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Command content */}
      <div className="p-3">
        <pre
          className="font-mono text-sm text-purple-100"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {block.content}
        </pre>
      </div>

      {/* Execution status (if executed before) */}
      {hasExecuted && (
        <div className="border-t border-purple-500/20 bg-purple-500/5 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            {exitCode === 0 ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="text-green-400">Executed successfully</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-red-500" />
                <span className="text-red-400">Exit code: {exitCode}</span>
              </>
            )}
            {executedAt && (
              <span className="text-purple-400/70">
                • {new Date(executedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
