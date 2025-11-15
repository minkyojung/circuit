/**
 * DesignControlPanel
 *
 * Inline panel that displays design controls when AI makes design-related changes
 * MVP: Spacing controls only (padding, margin, gap)
 *
 * Renders below assistant messages with detected design changes
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, RotateCcw, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DesignChange } from '@/types/conversation'
import { SpacingSlider } from './controls/SpacingSlider'

// @ts-ignore
const ipcRenderer = window.electron?.ipcRenderer

interface DesignControlPanelProps {
  changes: DesignChange[]
  onDismiss?: () => void
}

export const DesignControlPanel: React.FC<DesignControlPanelProps> = ({
  changes,
  onDismiss,
}) => {
  const [localValues, setLocalValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    changes.forEach((c) => {
      initial[c.id] = c.newValue
    })
    return initial
  })

  const [appliedChanges, setAppliedChanges] = useState<Set<string>>(new Set())
  const [applyingChanges, setApplyingChanges] = useState<Set<string>>(new Set())

  const handleValueChange = (changeId: string, newValue: string) => {
    setLocalValues((prev) => ({ ...prev, [changeId]: newValue }))
  }

  const handleApplySingle = async (change: DesignChange) => {
    if (appliedChanges.has(change.id)) return

    setApplyingChanges((prev) => new Set(prev).add(change.id))

    try {
      const newValue = localValues[change.id]

      // IPC call to update file
      await ipcRenderer?.invoke('design:apply-spacing-change', {
        filePath: change.filePath,
        oldClass: change.oldValue,
        newClass: newValue,
      })

      setAppliedChanges((prev) => new Set(prev).add(change.id))
    } catch (error) {
      console.error('Failed to apply design change:', error)
      // TODO: Show error toast
    } finally {
      setApplyingChanges((prev) => {
        const next = new Set(prev)
        next.delete(change.id)
        return next
      })
    }
  }

  const handleRevert = (change: DesignChange) => {
    setLocalValues((prev) => ({ ...prev, [change.id]: change.newValue }))
  }

  const handleRevertAll = () => {
    const reverted: Record<string, string> = {}
    changes.forEach((c) => {
      reverted[c.id] = c.newValue
    })
    setLocalValues(reverted)
  }

  const handleApplyAll = async () => {
    for (const change of changes) {
      if (!appliedChanges.has(change.id)) {
        await handleApplySingle(change)
      }
    }

    // Auto-dismiss after applying all
    setTimeout(() => {
      onDismiss?.()
    }, 1000)
  }

  const pendingCount = changes.length - appliedChanges.size

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0, marginTop: 0 }}
        animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
        exit={{ opacity: 0, height: 0, marginTop: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="overflow-hidden"
      >
        <div
          className="border border-border rounded-lg bg-card/50 backdrop-blur-sm
                     shadow-sm overflow-hidden"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2
                       border-b border-border bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-circuit-green rounded-full animate-pulse" />
              <h4 className="text-xs font-medium">
                Design Controls
                <span className="ml-1.5 text-muted-foreground font-normal">
                  {changes.length} change{changes.length > 1 ? 's' : ''} detected
                </span>
              </h4>
            </div>

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 hover:bg-muted rounded-md transition-colors"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Changes */}
          <div className="p-3 space-y-3">
            {changes.map((change) => (
              <DesignChangeRow
                key={change.id}
                change={change}
                value={localValues[change.id]}
                onValueChange={(v) => handleValueChange(change.id, v)}
                onApply={() => handleApplySingle(change)}
                onRevert={() => handleRevert(change)}
                applied={appliedChanges.has(change.id)}
                applying={applyingChanges.has(change.id)}
              />
            ))}
          </div>

          {/* Footer Actions */}
          {changes.length > 1 && (
            <div
              className="flex items-center justify-between px-3 py-2
                         border-t border-border bg-muted/20"
            >
              <button
                onClick={handleRevertAll}
                className="text-xs text-muted-foreground hover:text-foreground
                           transition-colors flex items-center gap-1"
              >
                <RotateCcw size={12} />
                Reset All
              </button>

              <button
                onClick={handleApplyAll}
                disabled={pendingCount === 0}
                className="px-2.5 py-1 text-xs bg-primary text-primary-foreground
                           rounded-md hover:bg-primary/90 transition-colors
                           flex items-center gap-1.5 disabled:opacity-50
                           disabled:cursor-not-allowed"
              >
                <Check size={12} />
                Apply All {pendingCount > 0 && `(${pendingCount})`}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Individual design change row
 */
interface DesignChangeRowProps {
  change: DesignChange
  value: string
  onValueChange: (value: string) => void
  onApply: () => void
  onRevert: () => void
  applied: boolean
  applying: boolean
}

const DesignChangeRow: React.FC<DesignChangeRowProps> = ({
  change,
  value,
  onValueChange,
  onApply,
  onRevert,
  applied,
  applying,
}) => {
  return (
    <div
      className={cn(
        'p-2.5 rounded-md border transition-all',
        applied
          ? 'border-success/30 bg-success/5'
          : 'border-border/50 bg-background/50'
      )}
    >
      {/* Property Info */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium capitalize">
              {change.property}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
              {change.filePath.split('/').pop()}
            </span>
          </div>

          <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
            {change.filePath}
          </div>
        </div>

        {applied && (
          <div className="flex items-center gap-1 text-xs text-success">
            <Check size={12} />
            <span>Applied</span>
          </div>
        )}
      </div>

      {/* Before/After Comparison */}
      <div className="flex items-center gap-2 mb-2.5 text-xs">
        <div className="flex-1 px-2 py-1.5 rounded bg-destructive/10 text-destructive font-mono">
          <span className="line-through">{change.oldValue}</span>
          <span className="ml-1 text-[10px]">({change.oldValuePx}px)</span>
        </div>
        <span className="text-muted-foreground">→</span>
        <div className="flex-1 px-2 py-1.5 rounded bg-success/10 text-success font-mono">
          <span>{value}</span>
          <span className="ml-1 text-[10px]">
            ({DesignChangeDetector.pxToTailwind(0, '').match(/\d+/) ? 'custom' : ''})
          </span>
        </div>
      </div>

      {/* Control */}
      <div className="mb-2">
        <SpacingSlider
          value={value}
          onChange={onValueChange}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onRevert}
          disabled={applied}
          className="px-2 py-1 text-xs border border-border rounded-md
                     hover:bg-muted transition-colors disabled:opacity-50
                     disabled:cursor-not-allowed"
        >
          Reset
        </button>
        <button
          onClick={onApply}
          disabled={applied || applying}
          className="px-2 py-1 text-xs bg-primary text-primary-foreground
                     rounded-md hover:bg-primary/90 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-1"
        >
          {applying ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles size={12} />
              </motion.div>
              Applying...
            </>
          ) : (
            <>
              <Check size={12} />
              Apply
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Import DesignChangeDetector for pxToTailwind utility
import { DesignChangeDetector } from '@/services/DesignChangeDetector'
