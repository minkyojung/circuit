/**
 * QueueIndicator Component
 *
 * Displays the message queue status and allows users to manage queued messages
 */

import React from 'react';
import { Loader2, X, AlertCircle } from 'lucide-react';
import type { QueuedMessage } from '@/types/messageQueue';

interface QueueIndicatorProps {
  queue: QueuedMessage[];
  currentlyProcessing: QueuedMessage | null;
  onRemove?: (id: string) => void;
  onClearAll?: () => void;
}

export const QueueIndicator: React.FC<QueueIndicatorProps> = ({
  queue,
  currentlyProcessing,
  onRemove,
  onClearAll
}) => {
  // Separate items by status
  const queuedItems = queue.filter(item => item.status === 'queued');
  const processingItems = queue.filter(item => item.status === 'processing');
  const failedItems = queue.filter(item => item.status === 'failed');

  // Don't show if queue is empty
  if (queuedItems.length === 0 && processingItems.length === 0 && failedItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 space-y-2">
      {/* Currently Processing */}
      {currentlyProcessing && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20 text-sm">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
          <span className="text-blue-700 dark:text-blue-300 flex-1 truncate">
            Processing: {currentlyProcessing.preview}
          </span>
        </div>
      )}

      {/* Queued Messages */}
      {queuedItems.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-medium text-muted-foreground">
              Queue ({queuedItems.length})
            </span>
            {onClearAll && queuedItems.length > 1 && (
              <button
                onClick={onClearAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          {queuedItems.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm group"
            >
              <span className="text-muted-foreground flex-shrink-0">#{index + 1}</span>
              <span className="text-foreground/80 flex-1 truncate">
                {item.preview}
              </span>
              {onRemove && (
                <button
                  onClick={() => onRemove(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from queue"
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Failed Messages */}
      {failedItems.length > 0 && (
        <div className="space-y-1">
          <div className="px-2">
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              Failed ({failedItems.length})
            </span>
          </div>
          {failedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/20 text-sm group"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-red-700 dark:text-red-300 truncate">
                  {item.preview}
                </div>
                {item.error && (
                  <div className="text-xs text-red-600/80 dark:text-red-400/80 truncate mt-0.5">
                    {item.error}
                  </div>
                )}
              </div>
              {onRemove && (
                <button
                  onClick={() => onRemove(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from queue"
                >
                  <X className="w-4 h-4 text-red-600 hover:text-red-700" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
