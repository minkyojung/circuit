/**
 * QuoteBlock - Renders quoted text sections
 *
 * Displays block quotes with optional attribution (author, source)
 */

import React from 'react'
import type { Block } from '@/types/conversation'
import { Quote } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuoteBlockProps {
  block: Block
}

/**
 * Parse quote content to extract attribution if present
 * Format: "Quote text\n\n— Author" or "Quote text\n\n- Source"
 */
const parseQuote = (
  content: string
): { quote: string; attribution?: string } => {
  const lines = content.trim().split('\n')

  // Check if last line is an attribution (starts with — or -)
  const lastLine = lines[lines.length - 1]?.trim()
  if (lastLine && (lastLine.startsWith('—') || lastLine.startsWith('- '))) {
    const quote = lines.slice(0, -1).join('\n').trim()
    const attribution = lastLine.replace(/^[—-]\s*/, '').trim()
    return { quote, attribution }
  }

  return { quote: content.trim() }
}

export const QuoteBlock: React.FC<QuoteBlockProps> = ({ block }) => {
  const { quote, attribution } = parseQuote(block.content)
  const author = block.metadata.author as string | undefined
  const source = block.metadata.source as string | undefined

  // Use metadata if available, otherwise use parsed attribution
  const displayAttribution = author || source || attribution

  return (
    <div
      className={cn(
        'relative rounded-lg border-l-4 border-l-primary',
        'border border-border bg-sidebar/30 p-4 pl-6'
      )}
    >
      {/* Quote icon */}
      <div className="absolute left-3 top-4">
        <Quote size={16} className="text-primary/40" />
      </div>

      {/* Quote content */}
      <div className="space-y-3">
        <blockquote className="text-sm text-foreground leading-relaxed italic">
          {quote.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < quote.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </blockquote>

        {/* Attribution */}
        {displayAttribution && (
          <footer className="text-xs text-muted-foreground font-medium pt-2 border-t border-border/50">
            {author && source ? (
              <cite className="not-italic">
                {author}, <span className="italic">{source}</span>
              </cite>
            ) : (
              <cite className="not-italic">{displayAttribution}</cite>
            )}
          </footer>
        )}
      </div>
    </div>
  )
}
