/**
 * SpacingSlider Control
 *
 * Slider-based control for adjusting spacing values (padding, margin, gap, space)
 * Provides preset buttons + continuous slider + manual input
 */

import React, { useState, useEffect } from 'react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { DesignChangeDetector } from '@/services/DesignChangeDetector'

interface SpacingSliderProps {
  value: string // Tailwind class e.g., "p-4"
  onChange: (newClass: string) => void
  className?: string
}

// Common spacing presets (in px)
const PRESETS = [4, 8, 12, 16, 24, 32, 48, 64]

export const SpacingSlider: React.FC<SpacingSliderProps> = ({
  value,
  onChange,
  className,
}) => {
  const [pxValue, setPxValue] = useState(16)
  const [prefix, setPrefix] = useState('p')

  // Parse initial value
  useEffect(() => {
    const match = value.match(/^([a-z-]+)-(\d+\.?\d*)$/)
    if (match) {
      setPrefix(match[1])
      const tailwindValue = match[2]
      const px = getTailwindPx(tailwindValue)
      if (px !== null) {
        setPxValue(px)
      }
    }
  }, [value])

  const getTailwindPx = (tailwindValue: string): number | null => {
    const map: Record<string, number> = {
      '0': 0,
      '1': 4,
      '2': 8,
      '3': 12,
      '4': 16,
      '5': 20,
      '6': 24,
      '7': 28,
      '8': 32,
      '9': 36,
      '10': 40,
      '11': 44,
      '12': 48,
      '14': 56,
      '16': 64,
    }
    return map[tailwindValue] ?? null
  }

  const handleSliderChange = (values: number[]) => {
    const newPx = values[0]
    setPxValue(newPx)

    // Convert back to Tailwind class
    const newClass = DesignChangeDetector.pxToTailwind(newPx, prefix)
    onChange(newClass)
  }

  const handlePresetClick = (px: number) => {
    setPxValue(px)
    const newClass = DesignChangeDetector.pxToTailwind(px, prefix)
    onChange(newClass)
  }

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPx = parseInt(e.target.value, 10)
    if (isNaN(newPx) || !DesignChangeDetector.isValidSpacingPx(newPx)) {
      return
    }

    setPxValue(newPx)
    const newClass = DesignChangeDetector.pxToTailwind(newPx, prefix)
    onChange(newClass)
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Preset Buttons */}
      <div className="flex gap-1 flex-wrap">
        {PRESETS.map((px) => (
          <button
            key={px}
            onClick={() => handlePresetClick(px)}
            className={cn(
              'px-2 py-1 text-xs rounded-md transition-colors font-mono',
              pxValue === px
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            )}
          >
            {px}px
          </button>
        ))}
      </div>

      {/* Slider */}
      <div className="flex items-center gap-3">
        <Slider
          value={[pxValue]}
          onValueChange={handleSliderChange}
          max={64}
          min={0}
          step={4}
          className="flex-1"
        />

        {/* Manual Input */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={pxValue}
            onChange={handleManualInput}
            min={0}
            max={128}
            step={4}
            className="w-14 px-2 py-1 text-xs border border-border rounded-md
                       text-right font-mono bg-background"
          />
          <span className="text-xs text-muted-foreground font-mono">px</span>
        </div>
      </div>

      {/* Current Tailwind Class */}
      <div className="text-[11px] text-muted-foreground font-mono">
        Class: <span className="text-foreground">{value}</span>
      </div>
    </div>
  )
}
