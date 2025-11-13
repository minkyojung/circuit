/**
 * usePrefillMessage Hook
 *
 * Handles input prefilling from external sources.
 * When a prefill message is provided, it automatically populates the input
 * using the provided setInput function and clears the prefill state.
 *
 * @example
 * const [input, setInput] = useState('');
 * usePrefillMessage({
 *   prefillMessage,
 *   setInput,
 *   onPrefillCleared: () => clearPrefill()
 * });
 */

import { useEffect } from 'react';

interface UsePrefillMessageParams {
  prefillMessage: string | null;
  setInput: (value: string) => void;
  onPrefillCleared?: () => void;
}

export function usePrefillMessage({
  prefillMessage,
  setInput,
  onPrefillCleared,
}: UsePrefillMessageParams): void {
  useEffect(() => {
    if (prefillMessage) {
      setInput(prefillMessage);
      onPrefillCleared?.();
    }
  }, [prefillMessage, setInput, onPrefillCleared]);
}
