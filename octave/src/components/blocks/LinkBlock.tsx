/**
 * LinkBlock - Renders URL references with metadata
 *
 * Displays links with optional title, description, and favicon
 */

import React from 'react'
import type { Block } from '@/types/conversation'
import { ExternalLink, Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LinkBlockProps {
  block: Block
}

/**
 * Extract domain from URL for display
 */
const getDomain = (url: string): string => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}

/**
 * Validate URL format
 */
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export const LinkBlock: React.FC<LinkBlockProps> = ({ block }) => {
  const url = block.content.trim()
  const title = block.metadata.title as string | undefined
  const description = block.metadata.description as string | undefined
  const domain = getDomain(url)

  if (!isValidUrl(url)) {
    return (
      <div className="rounded-lg border border-border bg-sidebar/50 p-4">
        <p className="text-sm text-muted-foreground">Invalid URL format</p>
      </div>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block rounded-lg border border-border bg-sidebar/50 p-4',
        'hover:bg-sidebar/80 hover:border-primary/50 transition-all',
        'group no-underline'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="shrink-0 mt-1">
          <LinkIcon size={18} className="text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title or URL */}
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {title || url}
            </h4>
            <ExternalLink
              size={14}
              className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
            />
          </div>

          {/* Description */}
          {description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {description}
            </p>
          )}

          {/* Domain */}
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-muted-foreground font-mono">
              {domain}
            </span>
          </div>
        </div>
      </div>
    </a>
  )
}
