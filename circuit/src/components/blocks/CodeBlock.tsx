/**
 * CodeBlock - Renders code with monospace font
 *
 * TODO: Add syntax highlighting with Vite-compatible library (shiki or prismjs)
 * Future: Add line numbers, file name header, "Open in editor" button.
 */

import React, { useState } from 'react'
import type { Block } from '../../types/conversation'
import { Copy, Check, FileCode, Bookmark, BookmarkCheck } from 'lucide-react'

const { ipcRenderer } = window.require('electron')

interface CodeBlockProps {
  block: Block
  onCopy: (content: string) => void
  onBookmark: (blockId: string) => void
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ block, onCopy }) => {
  const [copied, setCopied] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  const handleCopy = () => {
    onCopy(block.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBookmark = async () => {
    try {
      if (bookmarked) {
        // TODO: Implement unbookmark - need to track bookmark ID
        console.log('[CodeBlock] Unbookmark not yet implemented')
      } else {
        const bookmark = {
          id: `bookmark-${Date.now()}`,
          blockId: block.id,
          title: `${language} code`,
          createdAt: new Date().toISOString(),
        }
        await ipcRenderer.invoke('block:bookmark', bookmark)
        setBookmarked(true)
        console.log('[CodeBlock] Bookmarked:', block.id)
      }
    } catch (error) {
      console.error('[CodeBlock] Bookmark error:', error)
    }
  }

  const language = block.metadata.language || 'plaintext'
  const fileName = block.metadata.fileName

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-black/40">
      {/* Header with file info and actions */}
      <div className="flex items-center justify-between border-b border-border/50 bg-sidebar/30 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs">
          <FileCode className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">
            {fileName ? (
              <>
                <span className="font-mono">{fileName}</span>
                {block.metadata.lineStart && (
                  <span className="ml-1 text-muted-foreground/70">
                    :{block.metadata.lineStart}
                  </span>
                )}
              </>
            ) : (
              <span className="capitalize">{language}</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Bookmark button */}
          <button
            onClick={handleBookmark}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors hover:bg-sidebar-accent"
            title={bookmarked ? 'Bookmarked' : 'Bookmark this code'}
          >
            {bookmarked ? (
              <BookmarkCheck className="h-3 w-3 text-yellow-500" />
            ) : (
              <Bookmark className="h-3 w-3 text-muted-foreground" />
            )}
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors hover:bg-sidebar-accent"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="text-green-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code content with monospace font */}
      <div className="overflow-x-auto">
        <pre
          className="p-3 text-sm leading-relaxed"
          style={{
            margin: 0,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            color: '#d4d4d4',
          }}
        >
          <code>{block.content}</code>
        </pre>
      </div>
    </div>
  )
}
