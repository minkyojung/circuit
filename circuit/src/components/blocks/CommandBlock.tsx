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
import { Copy, Check, Play, Loader2, Terminal, AlertCircle, Bookmark, BookmarkCheck, ChevronDown } from 'lucide-react'
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
  const [isExpanded, setIsExpanded] = useState(false)

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

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[#857850]/30 bg-[#857850]/5">
      {/* Header */}
      <div className="group/header relative">
        <div
          className="flex items-center justify-between border-b border-[#857850]/20 bg-[#857850]/10 px-3 py-2 cursor-pointer hover:bg-[#857850]/15 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 text-xs max-w-[300px] truncate">
            <span className="text-[#A89968]/90">Command</span>
            {block.metadata.language && (
              <span className="text-[#A89968]/60">({block.metadata.language})</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Hover actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleBookmark}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-[#857850]/20 bg-[#857850]/10"
                title={bookmarked ? 'Bookmarked' : 'Bookmark this command'}
                disabled={executing}
              >
                {bookmarked ? (
                  <BookmarkCheck className="h-3 w-3 text-yellow-500" />
                ) : (
                  <Bookmark className="h-3 w-3 text-[#A89968]/60 hover:text-[#A89968]" />
                )}
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-[#857850]/20 bg-[#857850]/10"
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
                    <Copy className="h-3 w-3 text-[#A89968]/60 hover:text-[#A89968]" />
                    <span className="text-[#A89968]/80 hover:text-[#A89968]">Copy</span>
                  </>
                )}
              </button>

              <button
                onClick={handleExecute}
                disabled={executing}
                className="flex items-center gap-1 rounded bg-[#857850]/20 px-1.5 py-0.5 text-xs font-medium text-[#A89968]/90 transition-colors hover:bg-[#857850]/30 disabled:opacity-50"
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

            <ChevronDown
              className={`h-3 w-3 text-[#A89968]/60 transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Command content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
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
    </div>
  )
}
