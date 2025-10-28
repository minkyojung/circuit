import { useEffect, useState, useCallback } from 'react';

interface ContextMetrics {
  current: number;
  limit: number;
  percentage: number;
  lastCompact: string | null;
  sessionStart: string;
  prunableTokens: number;
  shouldCompact: boolean;
}

interface UseWorkspaceContextResult {
  context: ContextMetrics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Get IPC renderer
let ipcRenderer: any = null;
try {
  if (typeof window !== 'undefined' && (window as any).electron) {
    ipcRenderer = (window as any).electron.ipcRenderer;
  } else if (typeof require !== 'undefined') {
    const { ipcRenderer: electronIpc } = require('electron');
    ipcRenderer = electronIpc;
  }
} catch (err) {
  console.error('[useWorkspaceContext] Failed to load IPC:', err);
}

/**
 * Custom hook for workspace-specific Claude Code context monitoring
 * Connects to Electron IPC for real-time context updates
 */
export function useWorkspaceContext(
  workspaceId: string | undefined,
  workspacePath: string | undefined
): UseWorkspaceContextResult {
  const [context, setContext] = useState<ContextMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refresh context manually
  const refresh = useCallback(async () => {
    if (!ipcRenderer || !workspaceId || !workspacePath) {
      setError('Invalid workspace parameters');
      setLoading(false);
      return;
    }

    try {
      const result = await ipcRenderer.invoke('workspace:context-get', workspaceId, workspacePath);

      if (result.success && result.context) {
        setContext(result.context);
        setError(null);
      } else {
        setError(result.error || 'Failed to get context');
      }
    } catch (err) {
      console.error('[useWorkspaceContext] Refresh error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [workspaceId, workspacePath]);

  useEffect(() => {
    if (!ipcRenderer) {
      setError('Electron IPC not available');
      setLoading(false);
      return;
    }

    if (!workspaceId || !workspacePath) {
      setContext(null);
      setLoading(false);
      setError(null);
      return;
    }

    let mounted = true;

    // Start context tracking
    const startTracking = async () => {
      try {
        console.log('[useWorkspaceContext] Starting tracking for:', workspaceId);

        const result = await ipcRenderer.invoke(
          'workspace:context-start',
          workspaceId,
          workspacePath
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to start tracking');
        }

        if (mounted && result.context) {
          setContext(result.context);
          setError(null);
        }

        setLoading(false);
      } catch (err) {
        console.error('[useWorkspaceContext] Start error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    // Listen for context updates
    const handleContextUpdate = (_event: any, wsId: string, updatedContext: ContextMetrics) => {
      if (mounted && wsId === workspaceId) {
        console.log('[useWorkspaceContext] Context updated for:', wsId);
        setContext(updatedContext);
        setError(null);
      }
    };

    // Set up listener
    ipcRenderer.on('workspace:context-updated', handleContextUpdate);

    // Start tracking
    startTracking();

    // Cleanup
    return () => {
      mounted = false;

      // Remove listener
      ipcRenderer?.removeListener('workspace:context-updated', handleContextUpdate);

      // Stop tracking
      if (workspaceId) {
        ipcRenderer?.invoke('workspace:context-stop', workspaceId).catch(console.error);
      }
    };
  }, [workspaceId, workspacePath]);

  return {
    context,
    loading,
    error,
    refresh
  };
}
