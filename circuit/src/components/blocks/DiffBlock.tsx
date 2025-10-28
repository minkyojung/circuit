/**
 * DiffBlock - Renders diff content with collapsible UI
 */

import React, { useState } from 'react'
import type { Block } from '../../types/conversation'
import { Copy, Check, GitCompareArrows, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

interface DiffBlockProps {
  block: Block
  onCopy: (content: string) => void
}

export const DiffBlock: React.FC<DiffBlockProps> = ({ block, onCopy }) => {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleCopy = () => {
    onCopy(block.content)
    setCopied(true)
    toast.success('Diff copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[#857850]/30 bg-[#857850]/5">
      {/* Header */}
      <div className="group/header relative">
        <div
          className="flex items-center justify-between border-b border-[#857850]/20 bg-[#857850]/10 px-3 py-2 cursor-pointer hover:bg-[#857850]/15 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 text-xs max-w-[300px] truncate">
            <span className="text-[#A89968]/90">Diff</span>
            {block.metadata.fileName && (
              <span className="font-mono text-[#A89968]/90">{block.metadata.fileName}</span>
            )}
            {block.metadata.additions !== undefined && block.metadata.deletions !== undefined && (
              <span className="text-[#A89968]/80">
                <span className="text-green-500/80">+{block.metadata.additions}</span>
                {' '}
                <span className="text-red-500/80">-{block.metadata.deletions}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Hover actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-[#857850]/20 bg-[#857850]/10"
                title="Copy diff"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-[#A89968]/60 hover:text-[#A89968]" />
                    <span className="text-[#A89968]/80 hover:text-[#A89968]">Copy</span>
                  </>
                )}
              </button>
            </div>

            <ChevronDown
              className={`h-3 w-3 text-[#A89968]/60 transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Diff content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
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
    </div>
  )
}
