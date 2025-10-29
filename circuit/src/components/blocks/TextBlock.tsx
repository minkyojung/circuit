/**
 * TextBlock - Renders plain text and Markdown content
 */

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Block } from '../../types/conversation'
import { Copy, Check } from 'lucide-react'

interface TextBlockProps {
  block: Block
  onCopy: (content: string) => void
  onBookmark: (blockId: string) => void
}

export const TextBlock: React.FC<TextBlockProps> = ({ block, onCopy }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy(block.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative">
      {/* Copy button (appears on hover) */}
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity hover:bg-sidebar-accent group-hover:opacity-100"
        title="Copy text"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {/* Text content with Markdown rendering */}
      <div className="prose prose-invert max-w-none text-base font-normal leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {block.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
