/**
 * DiffBlock - Renders diff content with minimal hover UI
 */

import React, { useState } from 'react'
import type { Block } from '../../types/conversation'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface DiffBlockProps {
  block: Block
  onCopy: (content: string) => void
}

export const DiffBlock: React.FC<DiffBlockProps> = ({ block, onCopy }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy(block.content)
    setCopied(true)
    toast.success('Diff copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--diff-border)] bg-[var(--diff-bg)]">
      {/* Diff content */}
      <div className="overflow-x-auto">
        <pre
          className="p-0 text-sm font-mono"
          style={{
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Source Code Pro", "SF Mono", Menlo, Consolas, Monaco, "Courier New", monospace',
          }}
        >
          {block.content.split('\n').map((line, i) => {
            const isAddition = line.startsWith('+') && !line.startsWith('+++')
            const isDeletion = line.startsWith('-') && !line.startsWith('---')
            const isContext = line.startsWith('@@')

            return (
              <div
                key={i}
                className={`px-4 py-0.5 ${
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

      {/* Hover pill - compact actions */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center gap-0.5 rounded-full bg-background/90 backdrop-blur-sm border border-border shadow-lg px-2 py-1">
          {/* Diff label and stats */}
          <span className="text-[10px] font-medium text-muted-foreground px-1.5 font-mono">
            {block.metadata.fileName ? (
              <>
                {block.metadata.fileName}
                {block.metadata.additions !== undefined && block.metadata.deletions !== undefined && (
                  <span className="ml-1.5">
                    <span className="text-green-400">+{block.metadata.additions}</span>
                    {' '}
                    <span className="text-red-400">-{block.metadata.deletions}</span>
                  </span>
                )}
              </>
            ) : (
              'diff'
            )}
          </span>

          {/* Divider */}
          <div className="h-3 w-[1px] bg-border mx-0.5" />

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center justify-center rounded-full p-1 transition-colors hover:bg-accent"
            title="Copy diff"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
