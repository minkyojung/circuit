/**
 * useCopyMessage Hook
 *
 * Manages copying message content to clipboard with visual feedback.
 * Shows a temporary "copied" state for 2 seconds after copying.
 *
 * @example
 * const { copiedMessageId, handleCopyMessage } = useCopyMessage();
 *
 * // In component:
 * <button onClick={() => handleCopyMessage(msg.id, msg.content)}>
 *   {copiedMessageId === msg.id ? 'Copied!' : 'Copy'}
 * </button>
 */

import { useCallback, useState } from 'react';

interface UseCopyMessageReturn {
  copiedMessageId: string | null;
  handleCopyMessage: (messageId: string, content: string) => void;
}

export function useCopyMessage(): UseCopyMessageReturn {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = useCallback((messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);

    // Reset after 2 seconds
    setTimeout(() => {
      setCopiedMessageId(null);
    }, 2000);
  }, []);

  return { copiedMessageId, handleCopyMessage };
}
