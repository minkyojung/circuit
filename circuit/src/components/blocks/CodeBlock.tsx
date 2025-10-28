/**
 * CodeBlock - Renders code with syntax highlighting
 *
 * Uses Monaco Editor's syntax highlighter for accurate coloring.
 * Future: Add line numbers, file name header, "Open in editor" button.
 */

import React, { useState } from 'react'
import type { Block } from '../../types/conversation'
import { Copy, Check, FileCode } from 'lucide-react'

interface CodeBlockProps {
  block: Block
  onCopy: (content: string) => void
  onBookmark: (blockId: string) => void
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ block, onCopy }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy(block.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="p-3 text-sm font-mono leading-relaxed">
          <code
            className={`language-${language}`}
            style={{
              color: '#d4d4d4',
              display: 'block',
            }}
          >
            {block.content}
          </code>
        </pre>
      </div>
    </div>
  )
}
