/**
 * useFilteredMessages Hook
 *
 * Filters messages for display:
 * 1. Removes file-summary blocks (shown in UnifiedReasoningPanel)
 * 2. Removes plan/todoWrite JSON blocks
 * 3. Hides empty assistant messages (unless pending)
 *
 * Returns messages with filteredBlocks property for rendering.
 *
 * @example
 * const filteredMessages = useFilteredMessages(
 *   messages,
 *   isSending,
 *   pendingAssistantMessageId
 * );
 */

import { useMemo } from 'react';
import type { Message } from '@/types/conversation';

export function useFilteredMessages(
  messages: Message[],
  isSending: boolean,
  pendingAssistantMessageId: string | null
): Message[] {
  // Memoize filtered blocks for each message to avoid expensive JSON parsing on every render
  const messagesWithFilteredBlocks = useMemo(() => {
    return messages.map((msg) => {
      // Skip if no blocks
      if (!msg.blocks || msg.blocks.length === 0) {
        return { ...msg, filteredBlocks: msg.blocks };
      }

      // Filter out file-summary blocks (shown in UnifiedReasoningPanel) and plan/todoWrite JSON blocks
      const filteredBlocks = msg.blocks.filter((block) => {
        // Remove file-summary blocks (now shown in UnifiedReasoningPanel)
        if (block.type === 'file-summary') {
          return false;
        }

        // Remove plan/todoWrite JSON blocks
        if (block.type === 'code' && block.metadata?.language === 'json') {
          try {
            const parsed = JSON.parse(block.content);
            // Remove blocks containing todos array (plan/todoWrite JSON)
            if (parsed.todos && Array.isArray(parsed.todos)) {
              return false;
            }
          } catch (e) {
            // Not valid JSON, keep it
          }
        }
        return true;
      });

      return { ...msg, filteredBlocks };
    });
  }, [messages]);

  // Filter out empty assistant messages for display
  const filteredMessages = useMemo(() => {
    return messagesWithFilteredBlocks.filter((msg) => {
      // Hide empty assistant messages UNLESS it's the pending message (in progress)
      if (msg.role === 'assistant' && !msg.content && (!msg.blocks || msg.blocks.length === 0)) {
        // Keep if it's the pending message currently being streamed
        if (isSending && msg.id === pendingAssistantMessageId) {
          return true;
        }
        return false;
      }
      return true;
    });
  }, [messagesWithFilteredBlocks, isSending, pendingAssistantMessageId]);

  return filteredMessages;
}
