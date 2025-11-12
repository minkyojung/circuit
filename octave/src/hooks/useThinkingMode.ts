/**
 * useThinkingMode Hook
 *
 * Manages thinking mode selection state.
 * Simple state hook for selecting between normal, think, megathink, ultrathink, and plan modes.
 *
 * @example
 * const { thinkingMode, setThinkingMode } = useThinkingMode();
 *
 * // In component:
 * <select value={thinkingMode} onChange={(e) => setThinkingMode(e.target.value)}>
 *   <option value="normal">Normal</option>
 *   <option value="think">Think</option>
 * </select>
 */

import { useState } from 'react';

export type ThinkingMode = 'normal' | 'think' | 'megathink' | 'ultrathink' | 'plan';

interface UseThinkingModeReturn {
  thinkingMode: ThinkingMode;
  setThinkingMode: (mode: ThinkingMode) => void;
}

export function useThinkingMode(initialMode: ThinkingMode = 'normal'): UseThinkingModeReturn {
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(initialMode);

  return {
    thinkingMode,
    setThinkingMode,
  };
}
