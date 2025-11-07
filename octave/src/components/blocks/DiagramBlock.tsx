/**
 * DiagramBlock - Renders Mermaid diagrams
 *
 * Supports various diagram types: flowchart, sequence, class, state, etc.
 */

import React, { useEffect, useRef, useState } from 'react'
import type { Block } from '@/types/conversation'
import { AlertCircle, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DiagramBlockProps {
  block: Block
  onCopy?: (content: string) => void
}

export const DiagramBlock: React.FC<DiagramBlockProps> = ({ block, onCopy }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return

      try {
        // Dynamic import to avoid SSR issues
        const mermaid = (await import('mermaid')).default

        // Initialize mermaid with dark theme
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Source Code Pro", "SF Mono", Menlo, Consolas, Monaco, "Courier New", monospace',
        })

        // Clear container
        containerRef.current.innerHTML = ''

        // Create unique ID for this diagram
        const id = `mermaid-${block.id}`

        // Render diagram
        const { svg } = await mermaid.render(id, block.content)

        if (containerRef.current) {
          containerRef.current.innerHTML = svg
        }

        setError(null)
      } catch (err) {
        console.error('[DiagramBlock] Render error:', err)
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
      }
    }

    renderDiagram()
  }, [block.content, block.id])

  const handleCopy = () => {
    if (onCopy) {
      onCopy(block.content)
    } else {
      navigator.clipboard.writeText(block.content)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (error) {
    return (
      <div className="rounded-lg border-2 border-yellow-500/50 bg-yellow-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5 text-yellow-500" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-500 mb-1">
              Failed to render diagram
            </p>
            <p className="text-xs text-muted-foreground mb-3">{error}</p>
            <details className="text-xs">
              <summary className="cursor-pointer text-yellow-500 hover:text-yellow-400">
                View diagram source
              </summary>
              <pre className="mt-2 p-3 bg-background/50 rounded overflow-x-auto">
                {block.content}
              </pre>
            </details>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative group">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={cn(
          'absolute top-2 right-2 p-2 rounded-md transition-all',
          'opacity-0 group-hover:opacity-100',
          'bg-background/80 hover:bg-background border border-border'
        )}
        title="Copy diagram source"
      >
        {copied ? (
          <Check size={14} className="text-green-500" />
        ) : (
          <Copy size={14} className="text-muted-foreground" />
        )}
      </button>

      {/* Diagram container */}
      <div className="rounded-lg border border-border bg-sidebar/50 p-6 overflow-x-auto">
        <div
          ref={containerRef}
          className="flex items-center justify-center min-h-[100px]"
        />
      </div>

      {/* Diagram type label */}
      {block.metadata.diagramType && (
        <div className="mt-2 text-xs text-muted-foreground">
          {block.metadata.diagramType} diagram
        </div>
      )}
    </div>
  )
}
