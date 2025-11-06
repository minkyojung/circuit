/**
 * MessageActions - Action bar for assistant messages
 *
 * Displays copy and retry buttons below the message content
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RetryDropdown } from './RetryDropdown';

interface MessageActionsProps {
  messageId: string;
  content: string;
  onCopy: (messageId: string, content: string) => void;
  onRetry: (messageId: string, mode: 'normal' | 'extended') => void;
  copiedMessageId: string | null;
}

export function MessageActions({
  messageId,
  content,
  onCopy,
  onRetry,
  copiedMessageId,
}: MessageActionsProps) {
  const isCopied = copiedMessageId === messageId;

  return (
    <div className="mt-3 flex items-center gap-2 justify-end">
      {/* Copy Button - Increased size */}
      <button
        onClick={() => onCopy(messageId, content)}
        className={cn(
          'p-2 rounded-md transition-all',
          'text-muted-foreground/60 hover:text-foreground',
          'hover:bg-secondary/50',
          isCopied && 'text-green-500'
        )}
        title="Copy message"
      >
        {isCopied ? (
          <Check className="w-4 h-4" strokeWidth={2} />
        ) : (
          <Copy className="w-4 h-4" strokeWidth={1.5} />
        )}
      </button>

      {/* Retry Dropdown */}
      <RetryDropdown
        onRetry={(mode) => onRetry(messageId, mode)}
      />
    </div>
  );
}
