/**
 * BlockRenderer - Main component for rendering message blocks
 *
 * This component acts as a router, dispatching each block to its
 * specialized renderer based on block type.
 */

import React from 'react'
import type { Block } from '../../types/conversation'
import { TextBlock } from './TextBlock'
import { CodeBlock } from './CodeBlock'
import { CommandBlock } from './CommandBlock'
import { DiffBlock } from './DiffBlock'
import { toast } from 'sonner'

interface BlockRendererProps {
  block: Block
  onCopy?: (content: string) => void
  onExecute?: (content: string) => void
  onBookmark?: (blockId: string) => void
}

/**
 * Render a single block based on its type
 */
export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  onCopy,
  onExecute,
  onBookmark,
}) => {
  // Common props passed to all block components
  const commonProps = {
    block,
    onCopy: onCopy || (() => navigator.clipboard.writeText(block.content)),
    onBookmark: onBookmark || (() => console.log('Bookmark:', block.id)),
  }

  // Wrapper function to add data-block-id to all blocks
  const renderWithBlockId = (content: React.ReactNode) => (
    <div data-block-id={block.id} className="scroll-mt-4">
      {content}
    </div>
  )

  switch (block.type) {
    case 'text':
      return renderWithBlockId(<TextBlock {...commonProps} />)

    case 'code':
      return renderWithBlockId(<CodeBlock {...commonProps} />)

    case 'command':
      return renderWithBlockId(
        <CommandBlock
          {...commonProps}
          onExecute={onExecute || (() => console.log('Execute:', block.content))}
        />
      )

    case 'error':
      return renderWithBlockId(
        <div className="rounded-lg border-2 border-red-500/50 bg-red-500/10 p-3">
          <div className="flex items-start gap-2">
            <span className="text-red-500">🚨</span>
            <div className="flex-1">
              <div className="font-mono text-sm text-red-400">{block.content}</div>
              {block.metadata.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-red-400/70 hover:text-red-400">
                    Stack trace
                  </summary>
                  <pre className="mt-1 text-xs text-red-400/70">{block.metadata.stack}</pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )

    case 'file':
      return renderWithBlockId(
        <div className="rounded border border-border bg-sidebar p-2 text-sm">
          <div className="flex items-center gap-2">
            <span>📄</span>
            <span className="font-mono">{block.metadata.fileName || 'Unknown file'}</span>
            {block.metadata.changeType && (
              <span className="text-xs text-muted-foreground">({block.metadata.changeType})</span>
            )}
          </div>
        </div>
      )

    case 'result':
      return renderWithBlockId(
        <div className="rounded border border-green-500/30 bg-green-500/5 p-3">
          <div className="mb-1 text-xs text-green-600 dark:text-green-400">Output:</div>
          <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
            {block.content}
          </pre>
          {block.metadata.exitCode !== undefined && (
            <div className="mt-2 text-xs text-muted-foreground">
              Exit code: {block.metadata.exitCode}
            </div>
          )}
        </div>
      )

    case 'diff':
      return renderWithBlockId(<DiffBlock {...commonProps} />)

    // Fallback for unsupported types
    case 'diagram':
    case 'link':
    case 'quote':
    case 'list':
    case 'table':
    default:
      return renderWithBlockId(
        <div className="rounded border border-border bg-sidebar/50 p-3">
          <div className="mb-1 text-xs text-muted-foreground">
            {block.type.toUpperCase()} (coming soon)
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground">{block.content}</div>
        </div>
      )
  }
}

/**
 * Render a list of blocks for a message
 */
interface BlockListProps {
  blocks: Block[]
  onCopy?: (content: string) => void
  onExecute?: (content: string) => void
  onBookmark?: (blockId: string) => void
}

export const BlockList: React.FC<BlockListProps> = ({ blocks, onCopy, onExecute, onBookmark }) => {
  return (
    <div className="space-y-2">
      {blocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          onCopy={onCopy}
          onExecute={onExecute}
          onBookmark={onBookmark}
        />
      ))}
    </div>
  )
}
