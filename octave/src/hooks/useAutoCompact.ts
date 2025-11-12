/**
 * useAutoCompact Hook
 *
 * Monitors context metrics and automatically triggers session compact
 * when context usage reaches 80% (with cooldown period).
 *
 * Features:
 * - Smart threshold detection (80%+ context usage)
 * - 5-minute cooldown between auto-compacts
 * - Minimum message count requirement (20+)
 * - Fallback metrics support
 *
 * @example
 * useAutoCompact({
 *   contextMetrics,
 *   fallbackMetrics: metrics,
 *   conversationId,
 *   messageCount: messages.length,
 *   lastCompactTime,
 *   onCompact: () => handleSessionCompact(true)
 * });
 */

import { useEffect } from 'react';

interface ContextMetrics {
  context: {
    shouldCompact: boolean;
    percentage: number;
    tokensUsed: number;
    tokensLimit: number;
  };
}

interface UseAutoCompactParams {
  contextMetrics: ContextMetrics | null;
  fallbackMetrics?: ContextMetrics | null;
  conversationId: string | null;
  messageCount: number;
  lastCompactTime: number;
  onCompact: () => void;
}

const MIN_COMPACT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MIN_MESSAGE_COUNT = 20;

export function useAutoCompact({
  contextMetrics,
  fallbackMetrics,
  conversationId,
  messageCount,
  lastCompactTime,
  onCompact,
}: UseAutoCompactParams): void {
  useEffect(() => {
    // Use calculated context metrics if available, fallback to useClaudeMetrics
    const effectiveMetrics = contextMetrics || fallbackMetrics;
    const shouldAutoCompact = effectiveMetrics?.context?.shouldCompact;

    // Early returns for conditions that prevent auto-compact
    if (!shouldAutoCompact || !conversationId || messageCount < MIN_MESSAGE_COUNT) {
      return;
    }

    // Prevent compact if we did it recently (within 5 minutes)
    const timeSinceLastCompact = Date.now() - lastCompactTime;

    if (lastCompactTime > 0 && timeSinceLastCompact < MIN_COMPACT_INTERVAL) {
      console.log('[useAutoCompact] Skipping auto-compact (too soon since last compact)');
      return;
    }

    // Trigger silent auto-compact
    console.log('[useAutoCompact] Auto-compact triggered (Context Gauge at 80%+)');
    onCompact();
  }, [
    contextMetrics,
    fallbackMetrics?.context?.shouldCompact,
    conversationId,
    messageCount,
    lastCompactTime,
    onCompact,
  ]);
}
