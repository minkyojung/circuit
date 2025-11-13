/**
 * CompactUrgentModal Component
 *
 * Modal dialog that appears when context usage reaches urgent level (90%)
 * Provides clear instructions on how to compact
 * Blocks user interaction until dismissed or compacted
 */

import React from 'react';
import { AlertOctagon, Copy, ExternalLink } from 'lucide-react';
import { useAutoCompact } from '@/hooks/useAutoCompact';
import { toast } from 'sonner';
import type { ContextMetrics } from '@/types/metrics';

interface CompactUrgentModalProps {
  workspaceId?: string;
  workspacePath?: string;
  context: ContextMetrics | null;
}

export const CompactUrgentModal: React.FC<CompactUrgentModalProps> = ({
  workspaceId,
  workspacePath,
  context,
}) => {
  const {
    shouldShowModal,
    percentage,
    dismissWarning,
    openClaudeCode,
    copyCompactCommand,
  } = useAutoCompact({ workspaceId, workspacePath, context });

  if (!shouldShowModal) {
    return null;
  }

  const handleCopyAndOpen = () => {
    copyCompactCommand();
    openClaudeCode();
    toast.success('Command copied! Opening Claude Code...', {
      duration: 3000,
    });
    // Don't dismiss - let user dismiss after compacting
  };

  const handleRemindLater = () => {
    dismissWarning();
    toast.info('Reminder dismissed for now', {
      duration: 2000,
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={handleRemindLater}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-md pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-6 py-4 border-b border-border">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertOctagon size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Context Window Critically Full
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Action required to continue working effectively
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-center py-3">
              <div className="text-center">
                <div className="text-5xl font-bold text-red-600 dark:text-red-400">
                  {percentage.toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Context usage
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                How to compact:
              </p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Switch to your Claude Code terminal</li>
                <li>
                  Type:{' '}
                  <code className="px-1.5 py-0.5 bg-background rounded font-mono text-foreground">
                    /compact
                  </code>
                </li>
                <li>Wait for compaction to complete (~10-30 seconds)</li>
                <li>Return to Octave and continue working</li>
              </ol>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs text-yellow-900 dark:text-yellow-100">
                <strong>Note:</strong> Compacting will summarize your conversation history
                while preserving recent context. This is necessary to continue working
                efficiently.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleRemindLater}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Remind me later
            </button>
            <button
              onClick={handleCopyAndOpen}
              className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <Copy size={14} />
              <span>Copy & Open Claude Code</span>
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
