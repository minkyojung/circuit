import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface WorkflowCardProps {
  title: string
  status: {
    label: string
    icon?: React.ReactNode
    color?: 'success' | 'warning' | 'error' | 'default'
  }
  quickActions?: React.ReactNode
  children?: React.ReactNode
  autoExpand?: boolean
  defaultExpanded?: boolean
}

export function WorkflowCard({
  title,
  status,
  quickActions,
  children,
  autoExpand = false,
  defaultExpanded = false
}: WorkflowCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || autoExpand)

  // Auto-expand when autoExpand changes (e.g., error occurs)
  useEffect(() => {
    if (autoExpand) {
      setIsExpanded(true)
    }
  }, [autoExpand])

  const getColorClass = () => {
    switch (status.color) {
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

  const getTextColorClass = () => {
    switch (status.color) {
      case 'success':
        return 'text-[var(--circuit-success)]'
      case 'warning':
        return 'text-[var(--circuit-orange)]'
      case 'error':
        return 'text-[var(--circuit-error)]'
      default:
        return 'text-[var(--text-primary)]'
    }
  }

  return (
    <div className={`glass-card rounded-lg border-l-2 ${getColorClass()} overflow-hidden transition-all`}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsExpanded(!isExpanded)
          }
        }}
        role="button"
        tabIndex={0}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--glass-hover)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
          <div className={`flex items-center gap-1.5 text-xs ${getTextColorClass()}`}>
            {status.icon}
            <span>{status.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {quickActions && !isExpanded && (
            <div onClick={(e) => e.stopPropagation()}>
              {quickActions}
            </div>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && children && (
        <div className="px-4 pb-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}
