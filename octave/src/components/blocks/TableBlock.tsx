/**
 * TableBlock - Renders markdown tables
 *
 * Parses and displays markdown-style tables with proper formatting
 */

import React from 'react'
import type { Block } from '@/types/conversation'
import { Table } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TableBlockProps {
  block: Block
}

interface TableData {
  headers: string[]
  rows: string[][]
  alignments?: ('left' | 'center' | 'right')[]
}

/**
 * Parse markdown table into structured data
 */
const parseMarkdownTable = (content: string): TableData | null => {
  const lines = content.trim().split('\n').filter(line => line.trim())

  if (lines.length < 2) return null

  // Parse headers (first line)
  const headers = lines[0]
    .split('|')
    .map(h => h.trim())
    .filter(Boolean)

  // Parse alignment from separator line (second line)
  const alignmentLine = lines[1]
  const alignments = alignmentLine
    .split('|')
    .map(a => a.trim())
    .filter(Boolean)
    .map(cell => {
      if (cell.startsWith(':') && cell.endsWith(':')) return 'center'
      if (cell.endsWith(':')) return 'right'
      return 'left'
    }) as ('left' | 'center' | 'right')[]

  // Parse data rows (from third line onward)
  const rows = lines.slice(2).map(line =>
    line
      .split('|')
      .map(c => c.trim())
      .filter(Boolean)
  )

  return { headers, rows, alignments }
}

/**
 * Get text alignment class
 */
const getAlignmentClass = (alignment?: 'left' | 'center' | 'right'): string => {
  switch (alignment) {
    case 'center':
      return 'text-center'
    case 'right':
      return 'text-right'
    default:
      return 'text-left'
  }
}

export const TableBlock: React.FC<TableBlockProps> = ({ block }) => {
  const tableData = parseMarkdownTable(block.content)

  if (!tableData) {
    return (
      <div className="rounded-lg border border-border bg-sidebar/50 p-4">
        <p className="text-sm text-muted-foreground">Invalid table format</p>
      </div>
    )
  }

  const { headers, rows, alignments } = tableData

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background">
      {/* Table header label - more compact */}
      <div className="bg-muted/30 px-3 py-1.5 border-b border-border flex items-center gap-2">
        <Table size={12} className="text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Table ({rows.length} {rows.length === 1 ? 'row' : 'rows'})
        </span>
      </div>

      {/* Scrollable table container */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Table header - stronger styling */}
          <thead className="bg-muted/50 border-b-2 border-border">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-4 py-3 font-bold text-foreground text-xs uppercase tracking-wide',
                    getAlignmentClass(alignments?.[i])
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table body with zebra striping */}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  'border-b border-border/40 last:border-0',
                  'transition-colors duration-150',
                  // Zebra striping
                  rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/10',
                  // Hover effect
                  'hover:bg-accent/50'
                )}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      'px-4 py-3 text-foreground/90',
                      getAlignmentClass(alignments?.[cellIndex])
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No data in table</p>
        </div>
      )}
    </div>
  )
}
