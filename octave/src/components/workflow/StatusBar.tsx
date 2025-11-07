import React from 'react'

export interface StatusItem {
  label: string
  value: string | number
  icon?: React.ReactNode
  color?: 'success' | 'warning' | 'error' | 'default'
}

interface StatusBarProps {
  items: StatusItem[]
}

export function StatusBar({ items }: StatusBarProps) {
  const getColorClass = (color?: StatusItem['color']) => {
    switch (color) {
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
    <div className="glass-card p-4 rounded-lg">
      <div className="flex items-center gap-6">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {item.icon && (
              <div className={getColorClass(item.color)}>
                {item.icon}
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                {item.label}
              </div>
              <div className={`text-sm font-medium ${getColorClass(item.color)}`}>
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
