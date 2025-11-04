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
import { DiagramBlock } from './DiagramBlock'
import { ChecklistBlock } from './ChecklistBlock'
import { TableBlock } from './TableBlock'
import { LinkBlock } from './LinkBlock'
import { QuoteBlock } from './QuoteBlock'
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, AlertTriangle, XCircle, Info, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlockRendererProps {
  block: Block
  onCopy?: (content: string) => void
  onExecute?: (content: string) => void
  onBookmark?: (blockId: string) => void
  onFileReferenceClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void
}

/**
 * Helper: Get error severity based on type
 */
const getErrorSeverity = (errorType?: string): 'critical' | 'error' | 'warning' | 'info' => {
  if (!errorType) return 'error'

  const type = errorType.toLowerCase()
  if (type.includes('critical') || type.includes('fatal')) return 'critical'
  if (type.includes('warning') || type.includes('warn')) return 'warning'
  if (type.includes('info') || type.includes('notice')) return 'info'
  return 'error'
}

/**
 * Helper: Get error icon and color based on severity
 */
const getErrorIcon = (severity: 'critical' | 'error' | 'warning' | 'info') => {
  switch (severity) {
    case 'critical':
      return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-500/10', border: 'border-red-500/50' }
    case 'error':
      return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/50' }
    case 'warning':
      return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50' }
    case 'info':
      return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/50' }
  }
}

/**
 * Helper: Format duration for display
 */
const formatDuration = (ms?: number): string => {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Helper: Get tool display name from toolName
 */
const getToolDisplayName = (toolName?: string): string => {
  if (!toolName) return 'Tool Call'

  // Capitalize first letter
  return toolName.charAt(0).toUpperCase() + toolName.slice(1)
}

/**
 * Helper: Simplify tool args for display
 */
const simplifyToolArgs = (args?: Record<string, unknown>): Record<string, unknown> => {
  if (!args) return {}

  const simplified: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(args)) {
    // Show only essential args
    if (key === 'file_path' || key === 'pattern' || key === 'command' ||
        key === 'description' || key === 'prompt' || key === 'path') {
      simplified[key] = value
    }
  }

  return Object.keys(simplified).length > 0 ? simplified : args
}

/**
 * Helper: Truncate long output
 */
const truncateOutput = (output: unknown, maxLength = 500): string => {
  if (!output) return ''

  const str = typeof output === 'string' ? output : JSON.stringify(output, null, 2)

  if (str.length <= maxLength) return str

  return str.substring(0, maxLength) + '\n... (truncated)'
}

/**
 * Render a single block based on its type
 */
export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  onCopy,
  onExecute,
  onBookmark,
  onFileReferenceClick,
}) => {
  // Common props passed to all block components
  const commonProps = {
    block,
    onCopy: onCopy || (() => navigator.clipboard.writeText(block.content)),
    onBookmark: onBookmark || (() => console.log('Bookmark:', block.id)),
    onFileReferenceClick,
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

    case 'error': {
      const severity = getErrorSeverity(block.metadata.errorType)
      const { icon: ErrorIcon, color, bg, border } = getErrorIcon(severity)

      return renderWithBlockId(
        <div className={cn('rounded-lg border-2 p-4', bg, border)}>
          {/* Error Header */}
          <div className="flex items-start gap-3 mb-3">
            <ErrorIcon className={cn('shrink-0 mt-0.5', color)} size={20} />
            <div className="flex-1 min-w-0">
              {/* Error Type Badge and Code */}
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={cn('text-xs font-semibold', color)}>
                  {block.metadata.errorType || severity.toUpperCase()}
                </Badge>
                {block.metadata.errorCode && (
                  <span className="text-xs text-muted-foreground">
                    Code: {block.metadata.errorCode}
                  </span>
                )}
              </div>

              {/* Error Message */}
              <div className={cn('font-mono text-sm leading-relaxed', color)}>
                {block.content}
              </div>
            </div>
          </div>

          {/* Suggested Fix */}
          {block.metadata.suggestedFix && (
            <div className="mt-3 p-3 bg-background/50 rounded border border-border/50">
              <div className="flex items-start gap-2">
                <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-blue-500 mb-1">Suggested Fix:</p>
                  <p className="text-xs text-muted-foreground">{block.metadata.suggestedFix}</p>
                </div>
              </div>
            </div>
          )}

          {/* Stack Trace (Collapsible) */}
          {block.metadata.stack && (
            <Accordion type="single" collapsible className="mt-3">
              <AccordionItem value="stack-trace" className="border-0">
                <AccordionTrigger className={cn('text-xs hover:no-underline py-2', color)}>
                  View Stack Trace
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="text-xs text-muted-foreground overflow-x-auto p-3 bg-background/50 rounded">
                    {block.metadata.stack}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )
    }

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
          <div className="mb-1 text-xs text-[var(--success)]">Output:</div>
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

    case 'tool': {
      const displayName = getToolDisplayName(block.metadata.toolName)
      const simplifiedArgs = simplifyToolArgs(block.metadata.args)
      const duration = block.metadata.duration
      const status = block.metadata.status || (block.metadata.error ? 'error' : 'success')

      // Build enhanced title with duration and status
      let enhancedTitle = displayName

      if (duration) {
        enhancedTitle += ` • ${formatDuration(duration)}`
      }

      // Status indicator
      const statusIndicator = status === 'success' ? '✓' :
                            status === 'error' ? '✗' :
                            status === 'running' ? '⟳' : '○'

      enhancedTitle = `${statusIndicator} ${enhancedTitle}`

      return renderWithBlockId(
        <Tool defaultOpen={false}>
          <ToolHeader
            title={block.content || enhancedTitle}
            type={(block.metadata.type || 'tool-call') as `tool-${string}`}
            state={block.metadata.state || (status === 'error' ? 'output-error' : 'output-available')}
          />
          <ToolContent>
            {/* Simplified Args Display */}
            {simplifiedArgs && Object.keys(simplifiedArgs).length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-muted-foreground mb-1">Input:</div>
                <ToolInput input={simplifiedArgs} />
              </div>
            )}

            {/* Status-aware Output */}
            {(block.metadata.result !== undefined || block.metadata.error !== undefined) && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  {status === 'error' ? 'Error:' : 'Output:'}
                </div>
                {status === 'error' ? (
                  <ToolOutput
                    output={undefined}
                    errorText={block.metadata.error as string | undefined}
                  />
                ) : (
                  <ToolOutput
                    output={truncateOutput(block.metadata.result)}
                    errorText={undefined}
                  />
                )}
              </div>
            )}

            {/* Duration Badge (if available) */}
            {duration && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={12} />
                <span>{formatDuration(duration)}</span>
              </div>
            )}
          </ToolContent>
        </Tool>
      )
    }

    case 'diagram':
      return renderWithBlockId(<DiagramBlock {...commonProps} />)

    case 'checklist':
      return renderWithBlockId(<ChecklistBlock {...commonProps} />)

    case 'table':
      return renderWithBlockId(<TableBlock {...commonProps} />)

    case 'link':
      return renderWithBlockId(<LinkBlock {...commonProps} />)

    case 'quote':
      return renderWithBlockId(<QuoteBlock {...commonProps} />)

    // Fallback for unsupported types
    case 'list':
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
  onFileReferenceClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void
}

export const BlockList: React.FC<BlockListProps> = ({ blocks, onCopy, onExecute, onBookmark, onFileReferenceClick }) => {
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          onCopy={onCopy}
          onExecute={onExecute}
          onBookmark={onBookmark}
          onFileReferenceClick={onFileReferenceClick}
        />
      ))}
    </div>
  )
}
