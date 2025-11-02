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
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Table header label */}
      <div className="bg-sidebar/50 px-4 py-2 border-b border-border flex items-center gap-2">
        <Table size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">
          Table ({rows.length} rows)
        </span>
      </div>

      {/* Scrollable table container */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Table header */}
          <thead className="bg-sidebar border-b border-border">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-4 py-3 font-semibold text-foreground',
                    getAlignmentClass(alignments?.[i])
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table body */}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  'border-b border-border/50 last:border-0',
                  'hover:bg-sidebar/30 transition-colors'
                )}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      'px-4 py-3 text-foreground',
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
