/**
 * Type definitions for context metrics
 */

export interface ContextMetrics {
  current: number;
  limit: number;
  percentage: number;
  lastCompact: string | null;
  sessionStart: string;
  prunableTokens: number;
  shouldCompact: boolean;
}
