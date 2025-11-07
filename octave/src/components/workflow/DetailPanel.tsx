import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface DetailSection {
  title: string
  content: React.ReactNode
  defaultExpanded?: boolean
  color?: 'success' | 'warning' | 'error' | 'default'
}

interface DetailPanelProps {
  sections: DetailSection[]
  collapsible?: boolean
}

export function DetailPanel({ sections, collapsible = true }: DetailPanelProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<number>>(
    new Set(sections.map((s, i) => s.defaultExpanded !== false ? i : -1).filter(i => i !== -1))
  )

  const toggleSection = (index: number) => {
    if (!collapsible) return

    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSections(newExpanded)
  }

  const getBorderColor = (color?: DetailSection['color']) => {
    switch (color) {
      case 'success':
        return 'border-[var(--circuit-success)]'
      case 'warning':
        return 'border-[var(--circuit-orange)]'
      case 'error':
        return 'border-[var(--circuit-error)]'
      default:
        return 'border-[var(--glass-border)]'
    }
  }

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const isExpanded = expandedSections.has(index)

        return (
          <div
            key={index}
            className={`glass-card rounded-lg overflow-hidden border-l-2 ${getBorderColor(section.color)}`}
          >
            <button
              onClick={() => toggleSection(index)}
              className={`w-full px-4 py-3 flex items-center justify-between ${
                collapsible ? 'hover:bg-[var(--glass-hover)] cursor-pointer' : 'cursor-default'
              } transition-colors`}
              disabled={!collapsible}
            >
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                {section.title}
              </h3>
              {collapsible && (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                )
              )}
            </button>

            {(!collapsible || isExpanded) && (
              <div className="px-4 pb-4">
                {section.content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
