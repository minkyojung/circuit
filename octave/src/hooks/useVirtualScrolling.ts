/**
 * useVirtualScrolling Hook
 *
 * Sets up virtual scrolling for message lists with dynamic height estimation.
 * Optimizes rendering performance for large message lists.
 *
 * @example
 * const virtualizer = useVirtualScrolling(
 *   filteredMessages,
 *   messageThinkingSteps,
 *   scrollContainerRef
 * );
 *
 * // Use in render:
 * virtualizer.getVirtualItems().map((virtualItem) => {...})
 */

import { useCallback } from 'react';
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import type { Message } from '@/types/conversation';
import type { ThinkingStep } from '@/types/thinking';

interface UseVirtualScrollingParams {
  filteredMessages: Message[];
  messageThinkingSteps: Record<string, { steps: ThinkingStep[]; duration: number }>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useVirtualScrolling({
  filteredMessages,
  messageThinkingSteps,
  scrollContainerRef,
}: UseVirtualScrollingParams): Virtualizer<HTMLDivElement, Element> {
  // Memoize getScrollElement to prevent virtualizer recreation
  const getScrollElement = useCallback(() => scrollContainerRef.current, [scrollContainerRef]);

  // Memoize estimateSize with dynamic height prediction
  const estimateSize = useCallback(
    (index: number) => {
      const msg = filteredMessages[index];
      if (!msg) return 200;

      // Check if message has reasoning (collapsed by default, showing file changes)
      const hasReasoning = messageThinkingSteps[msg.id]?.steps?.length > 0;
      if (hasReasoning) {
        // Collapsed reasoning panel shows file changes only
        // Estimate: base height (150px) + panel header (50px) + file changes (~40px each)
        const fileChangeCount = 3; // Conservative estimate
        return 150 + 50 + fileChangeCount * 40;
      }

      // Estimate based on number of blocks (code blocks, etc.)
      const blockCount = msg.blocks?.length || 0;
      if (blockCount > 0) {
        // Code blocks are typically 200-300px each
        return 150 + blockCount * 250;
      }

      // Estimate based on content length
      const contentLength = msg.content?.length || 0;
      if (contentLength > 1000) {
        return 400;
      } else if (contentLength > 500) {
        return 300;
      } else if (contentLength > 200) {
        return 200;
      }

      // Default minimum height
      return 150;
    },
    [filteredMessages, messageThinkingSteps]
  );

  const virtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement,
    estimateSize,
    overscan: 5, // Render 5 extra items outside viewport for smooth scrolling
  });

  return virtualizer;
}
