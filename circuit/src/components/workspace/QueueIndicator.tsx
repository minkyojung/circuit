/**
 * QueueIndicator Component - Pill Style
 *
 * Displays queued messages as compact pills with X buttons
 */

import React from 'react';
import { X } from 'lucide-react';
import type { QueuedMessage } from '@/types/messageQueue';

interface QueueIndicatorProps {
  queue: QueuedMessage[];
  currentlyProcessing: QueuedMessage | null;
  onRemove?: (id: string) => void;
  onClearAll?: () => void;
}

export const QueueIndicator: React.FC<QueueIndicatorProps> = ({
  queue,
  onRemove,
}) => {
  // Only show queued items (not processing or failed)
  const queuedItems = queue.filter(item => item.status === 'queued');

  // Don't show if no queued items
  if (queuedItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {queuedItems.map((item) => (
        <div
          key={item.id}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 text-xs group hover:bg-muted/60 transition-colors border border-border/40"
        >
          <span className="text-muted-foreground max-w-[200px] truncate">
            {item.preview}
          </span>
          {onRemove && (
            <button
              onClick={() => onRemove(item.id)}
              className="flex-shrink-0 hover:bg-background/50 rounded-full p-0.5 transition-colors"
              title="Remove from queue"
            >
              <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
