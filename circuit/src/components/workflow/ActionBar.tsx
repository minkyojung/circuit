import React from 'react'

interface ActionBarProps {
  primary?: React.ReactNode
  secondary?: React.ReactNode[]
  className?: string
}

export function ActionBar({ primary, secondary, className = '' }: ActionBarProps) {
  return (
    <div className={`glass-card p-4 rounded-lg ${className}`}>
      <div className="flex items-center gap-3">
        {primary && <div>{primary}</div>}
        {secondary && secondary.length > 0 && (
          <>
            {secondary.map((action, index) => (
              <div key={index}>{action}</div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
