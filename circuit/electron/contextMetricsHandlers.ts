/**
 * Context Metrics Handlers
 *
 * Calculates and tracks context window usage for Claude conversations.
 * Uses accurate token counting to determine when to compact sessions.
 */

import { ipcMain } from 'electron';
import { countTokens } from '@anthropic-ai/tokenizer';

// Claude Sonnet 4.5 context window
const CONTEXT_WINDOW_SIZE = 200000; // 200k tokens
const COMPACT_THRESHOLD = 0.8; // 80%

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: any;
}

interface ContextMetrics {
  current: number;        // Current token count
  limit: number;          // Context window size
  percentage: number;     // Usage percentage (0-100)
  shouldCompact: boolean; // True if >= 80%
}

interface CalculateTokensRequest {
  messages: Message[];
}

interface CalculateTokensResult {
  success: boolean;
  metrics?: ContextMetrics;
  error?: string;
}

/**
 * Register context metrics IPC handlers
 */
export function registerContextMetricsHandlers() {
  console.log('[contextMetricsHandlers] Registering context metrics handlers');

  /**
   * Calculate total tokens for a message array
   */
  ipcMain.handle(
    'context:calculate-tokens',
    async (_event, request: CalculateTokensRequest): Promise<CalculateTokensResult> => {
      try {
        const { messages } = request;

        if (!messages || !Array.isArray(messages)) {
          return {
            success: false,
            error: 'Invalid messages array',
          };
        }

        // Calculate total tokens across all messages
        const totalTokens = messages.reduce((sum, msg) => {
          try {
            const content = msg.content || '';
            const tokens = countTokens(content);
            return sum + tokens;
          } catch (error) {
            console.error('[contextMetrics] Error counting tokens for message:', msg.id, error);
            return sum;
          }
        }, 0);

        // Calculate percentage
        const percentage = (totalTokens / CONTEXT_WINDOW_SIZE) * 100;
        const shouldCompact = percentage >= (COMPACT_THRESHOLD * 100);

        const metrics: ContextMetrics = {
          current: totalTokens,
          limit: CONTEXT_WINDOW_SIZE,
          percentage: Math.min(percentage, 100), // Cap at 100%
          shouldCompact,
        };

        return {
          success: true,
          metrics,
        };
      } catch (error: any) {
        console.error('[contextMetrics] Error calculating tokens:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }
  );

  console.log('[contextMetricsHandlers] ✅ Context metrics handlers registered');
}

/**
 * Cleanup handler
 */
export function cleanupContextMetricsHandlers() {
  console.log('[contextMetricsHandlers] Cleanup complete');
}
