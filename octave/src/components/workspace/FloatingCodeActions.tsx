/**
 * FloatingCodeActions Component
 *
 * Displays floating action buttons near selected code in Monaco editor.
 * Appears when code is selected, disappears when selection is cleared.
 */

import { motion, AnimatePresence } from 'motion/react'
import { MessageSquare, BookOpen, Zap, TestTube } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FloatingCodeActionsProps {
  visible: boolean
  position: { top: number; left: number }
  onAsk: () => void
  onExplain: () => void
  onOptimize: () => void
  onAddTests: () => void
  className?: string
}

export function FloatingCodeActions({
  visible,
  position,
  onAsk,
  onExplain,
  onOptimize,
  onAddTests,
  className
}: FloatingCodeActionsProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 1000,
          }}
          className={cn(
            'flex items-center gap-1 px-1.5 py-1.5 rounded-lg',
            'bg-background/95 backdrop-blur-sm',
            'border border-border shadow-lg',
            className
          )}
        >
          {/* Ask Claude */}
          <button
            onClick={onAsk}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md',
              'text-xs font-medium',
              'bg-blue-500/10 hover:bg-blue-500/20',
              'text-blue-400 hover:text-blue-300',
              'border border-blue-500/30 hover:border-blue-500/50',
              'transition-all',
              'whitespace-nowrap'
            )}
            title="Ask Claude about this (Cmd+K)"
          >
            <MessageSquare size={14} strokeWidth={2} />
            <span>Ask</span>
          </button>

          {/* Explain */}
          <button
            onClick={onExplain}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md',
              'text-xs font-medium',
              'bg-purple-500/10 hover:bg-purple-500/20',
              'text-purple-400 hover:text-purple-300',
              'border border-purple-500/30 hover:border-purple-500/50',
              'transition-all',
              'whitespace-nowrap'
            )}
            title="Explain this code"
          >
            <BookOpen size={14} strokeWidth={2} />
            <span>Explain</span>
          </button>

          {/* Optimize */}
          <button
            onClick={onOptimize}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md',
              'text-xs font-medium',
              'bg-amber-500/10 hover:bg-amber-500/20',
              'text-amber-400 hover:text-amber-300',
              'border border-amber-500/30 hover:border-amber-500/50',
              'transition-all',
              'whitespace-nowrap'
            )}
            title="Optimize this code"
          >
            <Zap size={14} strokeWidth={2} />
            <span>Optimize</span>
          </button>

          {/* Add Tests */}
          <button
            onClick={onAddTests}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md',
              'text-xs font-medium',
              'bg-primary/10 hover:bg-primary/20',
              'text-primary hover:text-primary/80',
              'border border-primary/30 hover:border-primary/50',
              'transition-all',
              'whitespace-nowrap'
            )}
            title="Add tests for this code"
          >
            <TestTube size={14} strokeWidth={2} />
            <span>Test</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
