/**
 * useAutoScroll Hook
 *
 * Manages intelligent scroll behavior for chat/message interfaces with virtual scrolling support.
 * Tracks user scroll intent, saves/restores scroll positions per workspace, and provides
 * smooth auto-scroll functionality.
 *
 * Features:
 * - Smart auto-scroll on new messages (respects user intent)
 * - Workspace-specific scroll position persistence
 * - Virtual scroller synchronization
 * - User scroll intent tracking (prevents interrupting manual scrolling)
 * - Smooth scroll animations
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Message } from '@/types/conversation';

interface UseAutoScrollOptions {
  messages: Message[];
  workspaceId: string;
  isLoading: boolean;
  enabled?: boolean; // Enable/disable auto-scroll feature (default: true)
  bottomThreshold?: number; // Distance from bottom to consider "at bottom" (default: 150px)
}

interface UseAutoScrollReturn {
  // Refs
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;

  // State
  isAtBottom: boolean;
  userScrolledAway: boolean;

  // Actions
  scrollToBottom: () => void;
  handleScroll: () => void;
  resetScrollIntent: () => void; // Reset user scroll intent (e.g., after sending message)
}

/**
 * Auto-scroll hook for chat interfaces
 *
 * @example
 * const {
 *   scrollContainerRef,
 *   isAtBottom,
 *   scrollToBottom,
 *   handleScroll
 * } = useAutoScroll({
 *   messages,
 *   workspaceId: workspace.id,
 *   isLoading: isLoadingConversation,
 *   enabled: true
 * });
 */
export function useAutoScroll(options: UseAutoScrollOptions): UseAutoScrollReturn {
  const {
    messages,
    workspaceId,
    isLoading,
    enabled = true,
    bottomThreshold = 150,
  } = options;

  // ============================================================================
  // Refs and State
  // ============================================================================

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userScrolledAway, setUserScrolledAway] = useState(false);

  // Track scroll positions per workspace
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const previousWorkspaceIdRef = useRef<string>(workspaceId);

  // Track previous message count to detect new messages
  const previousMessagesLengthRef = useRef(messages.length);

  // Track if we're in the middle of a programmatic scroll
  const isProgrammaticScrollRef = useRef(false);

  // ============================================================================
  // Scroll Detection
  // ============================================================================

  const handleScroll = useCallback(() => {
    // Ignore scroll events during programmatic scrolling
    if (isProgrammaticScrollRef.current) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    const nearBottom = distanceFromBottom < bottomThreshold;
    setIsAtBottom(nearBottom);

    // Track user intent: if they scroll away from bottom, they're reading old messages
    if (!nearBottom) {
      setUserScrolledAway(true);
    } else {
      // User scrolled back to bottom - re-enable auto-scroll
      setUserScrolledAway(false);
    }
  }, [bottomThreshold]);

  // ============================================================================
  // Scroll Actions
  // ============================================================================

  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Mark as programmatic scroll to prevent handleScroll from interfering
    isProgrammaticScrollRef.current = true;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });

    // Reset flag after animation completes (~300ms for smooth scroll)
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      setIsAtBottom(true);
      setUserScrolledAway(false);
    }, 350);
  }, []);

  const resetScrollIntent = useCallback(() => {
    setUserScrolledAway(false);
  }, []);

  // ============================================================================
  // Workspace Scroll Position Persistence
  // ============================================================================

  // Save scroll position when workspace changes
  useEffect(() => {
    const currentWorkspaceId = workspaceId;
    const previousWorkspaceId = previousWorkspaceIdRef.current;

    // Save scroll position of previous workspace
    if (previousWorkspaceId !== currentWorkspaceId && scrollContainerRef.current) {
      const scrollTop = scrollContainerRef.current.scrollTop;
      scrollPositionsRef.current.set(previousWorkspaceId, scrollTop);
      console.log('[useAutoScroll] Saved scroll position for workspace', previousWorkspaceId, ':', scrollTop);

      // Reset scroll intent for new workspace
      setUserScrolledAway(false);
    }

    // Update previous workspace ID
    previousWorkspaceIdRef.current = currentWorkspaceId;
  }, [workspaceId]);

  // Restore scroll position after messages are loaded
  useEffect(() => {
    // Only restore after loading is complete and messages are rendered
    if (!isLoading && messages.length > 0) {
      const currentWorkspaceId = workspaceId;
      const savedScrollPosition = scrollPositionsRef.current.get(currentWorkspaceId);

      if (savedScrollPosition !== undefined && scrollContainerRef.current) {
        console.log('[useAutoScroll] Restoring scroll position for workspace', currentWorkspaceId, ':', savedScrollPosition);

        // Use setTimeout to ensure virtualizer has finished rendering
        setTimeout(() => {
          if (scrollContainerRef.current) {
            isProgrammaticScrollRef.current = true;
            scrollContainerRef.current.scrollTop = savedScrollPosition;

            // Reset flag after DOM updates
            setTimeout(() => {
              isProgrammaticScrollRef.current = false;
            }, 100);
          }
        }, 100);
      }
    }
  }, [isLoading, workspaceId, messages.length]);

  // ============================================================================
  // Auto-Scroll on New Messages
  // ============================================================================

  useEffect(() => {
    if (!enabled) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const currentLength = messages.length;
    const previousLength = previousMessagesLengthRef.current;

    // Detect new message
    const hasNewMessage = currentLength > previousLength;

    if (hasNewMessage) {
      // Smart auto-scroll decision logic:
      // Scroll if user hasn't manually scrolled away OR if they're already at bottom
      const shouldAutoScroll = !userScrolledAway || isAtBottom;

      if (shouldAutoScroll) {
        // Use requestAnimationFrame to wait for virtualizer to render
        // Virtual scrollers need time to calculate new heights
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (container && scrollContainerRef.current) {
              scrollToBottom();
            }
          }, 50); // 50ms is sufficient for most virtual scrollers
        });
      }
    }

    // Update message count
    previousMessagesLengthRef.current = currentLength;
  }, [messages.length, userScrolledAway, isAtBottom, enabled, scrollToBottom]);

  // ============================================================================
  // Initial Scroll Check
  // ============================================================================

  // Check initial scroll position when messages load
  useEffect(() => {
    if (messages.length > 0 && scrollContainerRef.current) {
      handleScroll();
    }
  }, [messages.length, handleScroll]);

  // ============================================================================
  // Return Values
  // ============================================================================

  return {
    // Refs
    scrollContainerRef,

    // State
    isAtBottom,
    userScrolledAway,

    // Actions
    scrollToBottom,
    handleScroll,
    resetScrollIntent,
  };
}
