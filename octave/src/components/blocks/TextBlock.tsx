/**
 * TextBlock - Renders plain text and Markdown content
 * Supports file reference pills (e.g., "src/App.tsx:42")
 */

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Block } from '../../types/conversation'
import { FileReferencePill } from '../workspace/FileReferencePill'

interface TextBlockProps {
  block: Block
  onCopy: (content: string) => void
  onBookmark: (blockId: string) => void
  onFileReferenceClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void
}

/**
 * Parse text for file references and render them as pills
 * Pattern: path/to/file.ext:line or path/to/file.ext:start-end
 */
const parseFileReferences = (
  text: string,
  onFileClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void
): React.ReactNode[] => {
  // Regex to match file references
  // Matches: src/App.tsx:42 or src/App.tsx:42-50 or just src/App.tsx
  const fileRefRegex = /([a-zA-Z0-9_\-\/\.]+\.(tsx?|jsx?|py|rs|go|java|cpp|c|h|hpp|css|scss|html|md|json|yaml|yml|toml|sh|bash)):?(\d+)?(?:-(\d+))?/g

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = fileRefRegex.exec(text)) !== null) {
    const [fullMatch, filePath, , lineStartStr, lineEndStr] = match

    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    // Add FileReferencePill
    const lineStart = lineStartStr ? parseInt(lineStartStr, 10) : undefined
    const lineEnd = lineEndStr ? parseInt(lineEndStr, 10) : undefined

    parts.push(
      <FileReferencePill
        key={`${filePath}-${lineStart || 0}-${parts.length}`}
        filePath={filePath}
        lineStart={lineStart}
        lineEnd={lineEnd}
        onClick={onFileClick || (() => {})}
      />
    )

    lastIndex = match.index + fullMatch.length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

export const TextBlock: React.FC<TextBlockProps> = ({ block, onFileReferenceClick }) => {
  // Custom component to handle text nodes with file references
  const components = {
    p: ({ children, ...props }: any) => {
      // Process children to find and replace file references
      const processedChildren = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          const parts = parseFileReferences(child, onFileReferenceClick)
          return parts.length === 1 ? parts[0] : <>{parts}</>
        }
        return child
      })

      return <p {...props}>{processedChildren}</p>
    },
    // Also handle inline code that might contain file paths
    code: ({ children, inline, ...props }: any) => {
      if (inline && typeof children === 'string') {
        const parts = parseFileReferences(children, onFileReferenceClick)
        if (parts.length > 1) {
          // Contains file reference, render as pills
          return <span className="inline-flex items-center gap-1">{parts}</span>
        }
      }
      // Normal code rendering
      return <code {...props}>{children}</code>
    }
  }

  return (
    <div className="prose dark:prose-invert max-w-none text-base font-normal leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {block.content}
      </ReactMarkdown>
    </div>
  )
}
