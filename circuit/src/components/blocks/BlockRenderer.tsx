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

  switch (block.type) {
    case 'text':
      return <TextBlock {...commonProps} />

    case 'code':
      return <CodeBlock {...commonProps} />

    case 'command':
      return (
        <CommandBlock
          {...commonProps}
          onExecute={onExecute || (() => console.log('Execute:', block.content))}
        />
      )

    case 'error':
      return (
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
      return (
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
      return (
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
      return (
        <div className="rounded-lg border border-border bg-black/40 overflow-hidden">
          {/* Diff header */}
          <div className="flex items-center justify-between border-b border-border/50 bg-sidebar/30 px-3 py-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Diff</span>
              {block.metadata.fileName && (
                <span className="font-mono text-muted-foreground">{block.metadata.fileName}</span>
              )}
              {block.metadata.additions !== undefined && block.metadata.deletions !== undefined && (
                <span className="text-muted-foreground">
                  <span className="text-green-500">+{block.metadata.additions}</span>
                  {' '}
                  <span className="text-red-500">-{block.metadata.deletions}</span>
                </span>
              )}
            </div>
            <button
              onClick={() => onCopy(block.content)}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors hover:bg-sidebar-accent"
              title="Copy diff"
            >
              <span className="text-muted-foreground">Copy</span>
            </button>
          </div>

          {/* Diff content */}
          <div className="overflow-x-auto">
            <pre
              className="p-0 text-sm font-mono"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
            >
              {block.content.split('\n').map((line, i) => {
                const isAddition = line.startsWith('+') && !line.startsWith('+++')
                const isDeletion = line.startsWith('-') && !line.startsWith('---')
                const isContext = line.startsWith('@@')

                return (
                  <div
                    key={i}
                    className={`px-3 py-0.5 ${
                      isAddition
                        ? 'bg-green-500/10 text-green-400'
                        : isDeletion
                        ? 'bg-red-500/10 text-red-400'
                        : isContext
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-gray-300'
                    }`}
                  >
                    {line || ' '}
                  </div>
                )
              })}
            </pre>
          </div>
        </div>
      )

    // Fallback for unsupported types
    case 'diagram':
    case 'link':
    case 'quote':
    case 'list':
    case 'table':
    default:
      return (
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
