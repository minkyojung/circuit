/**
 * MessageActions - Action bar for assistant messages
 *
 * Displays copy and retry buttons below the message content
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MessageActionsProps {
  messageId: string;
  content: string;
  onCopy: (messageId: string, content: string) => void;
  onExplain: (messageId: string, content: string) => void;
  copiedMessageId: string | null;
}

export function MessageActions({
  messageId,
  content,
  onCopy,
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

      {/* Explain Button - Text style like ChatInput */}
      <button
        onClick={() => onExplain(messageId, content)}
        className={cn(
          'inline-flex items-center gap-1',
          'h-[32px] px-2 py-1.5 text-sm rounded-md',
          'text-muted-foreground hover:text-foreground',
          'hover:bg-secondary',
          'transition-colors'
        )}
        title="Explain this response"
      >
        <span className="font-light">Explain</span>
      </button>
    </div>
  );
}
