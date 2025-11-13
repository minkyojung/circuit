/**
 * useContextMetrics Hook
 *
 * Calculates context metrics (token usage, percentage) from messages.
 * Automatically recalculates when messages change.
 *
 * @example
 * const contextMetrics = useContextMetrics(messages);
 * // contextMetrics.context.percentage
 * // contextMetrics.context.shouldCompact
 */

import { useEffect, useState } from 'react';
import type { Message } from '@/types/conversation';

const ipcRenderer = window.electron.ipcRenderer;

interface ContextMetrics {
  context: {
    percentage: number;
    shouldCompact: boolean;
    tokensUsed: number;
    tokensLimit: number;
  };
}

export function useContextMetrics(messages: Message[]): ContextMetrics | null {
  const [contextMetrics, setContextMetrics] = useState<ContextMetrics | null>(null);

  useEffect(() => {
    const calculateContextMetrics = async () => {
      if (messages.length === 0) {
        setContextMetrics(null);
        return;
      }

      try {
        const result = await ipcRenderer.invoke('context:calculate-tokens', { messages });

        if (result.success && result.metrics) {
          setContextMetrics({
            context: result.metrics,
          });
        }
      } catch (error) {
        console.error('[useContextMetrics] Failed to calculate:', error);
        setContextMetrics(null);
      }
    };

    calculateContextMetrics();
  }, [messages]);

  return contextMetrics;
}
