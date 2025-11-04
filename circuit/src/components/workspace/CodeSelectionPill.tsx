/**
 * CodeSelectionPill Component
 *
 * Displays a code selection as an interactive pill, showing a preview
 * of the selected code with file context and line numbers.
 */

import { Code, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeSelectionPillProps {
  code: string
  filePath: string
  lineStart: number
  lineEnd: number
  onRemove?: () => void
  className?: string
}

export function CodeSelectionPill({
  code,
  filePath,
  lineStart,
  lineEnd,
  onRemove,
  className
}: CodeSelectionPillProps) {
  const pathParts = filePath.split('/')
  const fileName = pathParts[pathParts.length - 1]
  const directory = pathParts.slice(0, -1).join('/')

  const lineInfo = lineEnd && lineEnd !== lineStart
    ? `:${lineStart}-${lineEnd}`
    : `:${lineStart}`

  // Preview first line of code (max 50 chars)
  const codePreview = code.split('\n')[0].trim()
  const truncatedPreview = codePreview.length > 50
    ? codePreview.substring(0, 47) + '...'
    : codePreview

  return (
    <div
      className={cn(
        'inline-flex items-start gap-2 px-3 py-2 rounded-lg',
        'bg-purple-500/10 border border-purple-500/30',
        'transition-all',
        'text-xs font-mono',
        'max-w-full',
        className
      )}
    >
      <Code className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" strokeWidth={2} />

      <div className="flex-1 min-w-0 space-y-1">
        {/* File path with line numbers */}
        <div className="flex items-baseline gap-0.5">
          {directory && <span className="text-purple-400/60">{directory}/</span>}
          <span className="text-purple-400 font-medium">{fileName}</span>
          <span className="text-purple-300/60">{lineInfo}</span>
        </div>

        {/* Code preview */}
        <div className="text-purple-200/80 truncate">
          {truncatedPreview}
        </div>
      </div>

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault()
            onRemove()
          }}
          className={cn(
            'flex-shrink-0 p-0.5 rounded hover:bg-purple-500/20',
            'text-purple-400 hover:text-purple-300',
            'transition-colors'
          )}
          title="Remove code selection"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
