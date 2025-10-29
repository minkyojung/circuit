/**
 * TextBlock - Renders plain text and Markdown content
 */

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Block } from '../../types/conversation'

interface TextBlockProps {
  block: Block
  onCopy: (content: string) => void
  onBookmark: (blockId: string) => void
}

export const TextBlock: React.FC<TextBlockProps> = ({ block }) => {
  return (
    <div className="prose prose-invert max-w-none text-base font-normal leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {block.content}
      </ReactMarkdown>
    </div>
  )
}
