import React from 'react'

export interface TimelineEvent {
  timestamp?: string
  title: string
  description?: string
  icon?: React.ReactNode
  color?: 'success' | 'warning' | 'error' | 'default'
}

interface ContentTimelineProps {
  events: TimelineEvent[]
  emptyMessage?: string
  maxHeight?: string
}

export function ContentTimeline({
  events,
  emptyMessage = 'No events yet...',
  maxHeight = 'max-h-80'
}: ContentTimelineProps) {
  const getColorClass = (color?: TimelineEvent['color']) => {
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

  if (events.length === 0) {
    return (
      <div className="glass-card p-6 rounded-lg text-center">
        <p className="text-xs text-[var(--text-muted)]">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={`glass-card p-4 rounded-lg ${maxHeight} overflow-y-auto`}>
      <div className="space-y-3">
        {events.map((event, index) => (
          <div key={index} className={`flex gap-3 pb-3 border-l-2 pl-3 ${getColorClass(event.color)}`}>
            {event.icon && (
              <div className="flex-shrink-0 mt-0.5">
                {event.icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {event.title}
                </p>
                {event.timestamp && (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {event.timestamp}
                  </span>
                )}
              </div>
              {event.description && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
