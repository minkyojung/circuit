/**
 * ContextGauge Component
 *
 * A minimal percentage display that shows context usage.
 * Provides visual feedback and quick access to compact functionality.
 *
 * Design:
 * - Text-only below 80%
 * - Pill button at 80%+ with click to compact
 * - Color-coded: muted (safe), yellow (warning), red (urgent)
 */

import React from 'react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ContextGaugeProps {
  percentage: number
  current?: number
  limit?: number
  onCompact?: () => void
  disabled?: boolean
}

export const ContextGauge: React.FC<ContextGaugeProps> = ({
  percentage,
  current,
  limit,
  onCompact,
  disabled = false,
}) => {
  // Clamp percentage between 0-100
  const clampedPercentage = Math.max(0, Math.min(100, percentage))

  // Format tokens for display
  const formatTokens = (n: number) => `${(n / 1000).toFixed(0)}k`

  // Determine if clickable (80%+)
  const isCompactable = clampedPercentage >= 80

  // Get text color based on percentage
  const getTextColor = () => {
    if (clampedPercentage >= 95) return 'text-red-500'
    if (clampedPercentage >= 80) return 'text-yellow-500'
    return 'text-muted-foreground'
  }

  // Get background styles for pill (80%+)
  const getPillStyles = () => {
    if (clampedPercentage >= 95) {
      return 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30'
    }
    if (clampedPercentage >= 80) {
      return 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30'
    }
    return ''
  }

  const handleClick = () => {
    if (!disabled && onCompact && isCompactable) {
      onCompact()
    }
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {isCompactable ? (
            // Pill button (80%+)
            <button
              onClick={handleClick}
              disabled={disabled}
              className={cn(
                'inline-flex items-center justify-center',
                'px-2 h-[24px]',
                'rounded-full border transition-all duration-200',
                'text-xs font-medium',
                getPillStyles(),
                getTextColor(),
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              )}
              aria-label={`Context usage: ${clampedPercentage.toFixed(1)}%`}
            >
              {clampedPercentage.toFixed(1)}%
            </button>
          ) : (
            // Text-only (<80%)
            <div
              className={cn(
                'inline-flex items-center justify-center',
                'px-1 h-[24px]',
                'text-xs font-medium',
                getTextColor()
              )}
              aria-label={`Context usage: ${clampedPercentage.toFixed(1)}%`}
            >
              {clampedPercentage.toFixed(1)}%
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <div className="font-medium">
              Context:{' '}
              {current && limit
                ? `${formatTokens(current)} / ${formatTokens(limit)}`
                : `${clampedPercentage.toFixed(1)}%`}
            </div>
            {isCompactable && (
              <div className="text-muted-foreground">
                Click to compact →
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
