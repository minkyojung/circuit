import React from 'react'

export interface QuickStatus {
  label: string
  icon?: React.ReactNode
  color?: 'success' | 'warning' | 'error' | 'default'
}

interface QuickStatusBarProps {
  statuses: QuickStatus[]
}

export function QuickStatusBar({ statuses }: QuickStatusBarProps) {
  const getColorClass = (color?: QuickStatus['color']) => {
    switch (color) {
      case 'success':
        return 'text-[var(--circuit-success)]'
      case 'warning':
        return 'text-[var(--circuit-orange)]'
      case 'error':
        return 'text-[var(--circuit-error)]'
      default:
        return 'text-[var(--text-secondary)]'
    }
  }

  return (
    <div className="glass-card px-4 py-2 rounded-lg">
      <div className="flex items-center gap-6">
        {statuses.map((status, index) => (
          <div key={index} className={`flex items-center gap-1.5 text-xs font-medium ${getColorClass(status.color)}`}>
            {status.icon}
            <span>{status.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
