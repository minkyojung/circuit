/**
 * useRefSync Hook
 *
 * Synchronizes a ref with the latest value to avoid stale closures.
 * Useful for accessing current state values in callbacks without re-creating them.
 *
 * @example
 * const sessionIdRef = useRefSync(sessionId);
 * // sessionIdRef.current will always have the latest sessionId value
 */

import { useEffect, useRef } from 'react';

export function useRefSync<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef<T>(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
