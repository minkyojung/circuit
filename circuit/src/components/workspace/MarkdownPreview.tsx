/**
 * MarkdownPreview Component
 *
 * Renders markdown content with Tailwind Prose styling
 */

import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <div
      className={cn(
        "h-full w-full overflow-auto p-8 bg-card",
        className
      )}
    >
      <article className="prose prose-invert prose-sm max-w-4xl mx-auto">
        <ReactMarkdown>
          {content}
        </ReactMarkdown>
      </article>
    </div>
  )
}
