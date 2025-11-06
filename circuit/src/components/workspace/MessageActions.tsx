/**
 * MessageActions - Action bar for assistant messages
 *
 * Displays copy and retry buttons below the message content
 */

import React from 'react';
import { Copy, Check, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RetryDropdown } from './RetryDropdown';

interface MessageActionsProps {
  messageId: string;
  content: string;
  onCopy: (messageId: string, content: string) => void;
  onRetry: (messageId: string, mode: 'normal' | 'extended') => void;
  onExplain: (messageId: string, content: string) => void;
  copiedMessageId: string | null;
}

export function MessageActions({
  messageId,
  content,
  onCopy,
  onRetry,
  onExplain,
  copiedMessageId,
}: MessageActionsProps) {
  const isCopied = copiedMessageId === messageId;

  return (
    <div className="mt-2 flex items-center gap-1 justify-end">
      {/* Copy Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onCopy(messageId, content)}
        className={cn(
          'h-[32px] w-[32px] hover:bg-secondary',
          'text-muted-foreground hover:text-foreground',
          isCopied && 'text-green-500'
        )}
        title="Copy message"
      >
        {isCopied ? (
          <Check className="w-4 h-4" strokeWidth={2} />
        ) : (
          <Copy className="w-4 h-4" strokeWidth={1.5} />
        )}
      </Button>

      {/* Explain Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onExplain(messageId, content)}
        className={cn(
          'h-[32px] w-[32px] hover:bg-secondary',
          'text-muted-foreground hover:text-foreground'
        )}
        title="Explain this response"
      >
        <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
      </Button>

      {/* Retry Dropdown */}
      <RetryDropdown
        onRetry={(mode) => onRetry(messageId, mode)}
      />
    </div>
  );
}
