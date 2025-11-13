/**
 * useArchitectMode Hook
 *
 * Manages architect mode state with workspace config persistence.
 * Automatically loads architect mode setting from workspace configuration.
 *
 * @example
 * const { architectMode, setArchitectMode } = useArchitectMode(workspacePath);
 *
 * // architectMode is loaded from workspace config on mount
 * // setArchitectMode updates both state and workspace config
 */

import { useState, useEffect } from 'react';
import { getArchitectMode, setArchitectMode as saveArchitectMode } from '@/services/projectConfigLocal';

interface UseArchitectModeReturn {
  architectMode: boolean;
  setArchitectMode: (enabled: boolean) => Promise<void>;
}

export function useArchitectMode(workspacePath: string | undefined): UseArchitectModeReturn {
  const [architectMode, setArchitectModeState] = useState<boolean>(false);

  // Load architect mode from workspace config
  useEffect(() => {
    if (!workspacePath) return;

    const loadArchitectMode = async () => {
      const enabled = await getArchitectMode(workspacePath);
      setArchitectModeState(enabled);
    };

    loadArchitectMode();
  }, [workspacePath]);

  // Update both state and workspace config
  const setArchitectMode = async (enabled: boolean) => {
    setArchitectModeState(enabled);
    if (workspacePath) {
      await saveArchitectMode(workspacePath, enabled);
    }
  };

  return {
    architectMode,
    setArchitectMode,
  };
}
