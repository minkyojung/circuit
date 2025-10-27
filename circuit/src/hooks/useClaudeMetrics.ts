import { useEffect, useState, useCallback } from 'react';

interface UsageMetrics {
  input: number;
  output: number;
  total: number;
  percentage: number;
  planLimit: number;
  burnRate: number;
  timeLeft: number;
  resetTime: number;
}

interface ContextMetrics {
  current: number;
  limit: number;
  percentage: number;
  lastCompact: string | null;
  sessionStart: string;
  prunableTokens: number;
  shouldCompact: boolean;
}

export interface CircuitMetrics {
  usage: UsageMetrics;
  context: ContextMetrics;
  timestamp: number;
}

interface UseClaudeMetricsResult {
  metrics: CircuitMetrics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Get IPC renderer (nodeIntegration: true이므로 직접 require 가능)
let ipcRenderer: any = null;
try {
  if (typeof window !== 'undefined' && (window as any).electron) {
    ipcRenderer = (window as any).electron.ipcRenderer;
  } else if (typeof require !== 'undefined') {
    const { ipcRenderer: electronIpc } = require('electron');
    ipcRenderer = electronIpc;
  }
} catch (err) {
  console.error('[useClaudeMetrics] Failed to load IPC:', err);
}

/**
 * Custom hook for Claude Code usage & context monitoring
 * Connects to Electron IPC for real-time metrics updates
 */
export function useClaudeMetrics(): UseClaudeMetricsResult {
  const [metrics, setMetrics] = useState<CircuitMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refresh metrics manually
  const refresh = useCallback(async () => {
    if (!ipcRenderer) {
      setError('Electron IPC not available');
      setLoading(false);
      return;
    }

    try {
      const result = await ipcRenderer.invoke('circuit:metrics-refresh');

      if (result.success && result.metrics) {
        setMetrics(result.metrics);
        setError(null);
      } else {
        setError(result.error || 'Failed to refresh metrics');
      }
    } catch (err) {
      console.error('[useClaudeMetrics] Refresh error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  useEffect(() => {
    if (!ipcRenderer) {
      setError('Electron IPC not available');
      setLoading(false);
      return;
    }

    let mounted = true;

    // Start metrics monitoring
    const startMonitoring = async () => {
      try {
        // Get project path first
        const pathResult = await ipcRenderer.invoke('circuit:get-project-path');

        if (!pathResult.success) {
          throw new Error('Failed to get project path');
        }

        // Start metrics monitoring
        const startResult = await ipcRenderer.invoke(
          'circuit:metrics-start',
          pathResult.projectPath
        );

        if (!startResult.success) {
          throw new Error(startResult.error || 'Failed to start monitoring');
        }

        // Get initial metrics
        const metricsResult = await ipcRenderer.invoke('circuit:metrics-get');

        if (mounted) {
          if (metricsResult.success && metricsResult.metrics) {
            setMetrics(metricsResult.metrics);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('[useClaudeMetrics] Start error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    // Listen for metrics updates
    const handleMetricsUpdate = (_event: any, updatedMetrics: CircuitMetrics) => {
      if (mounted) {
        setMetrics(updatedMetrics);
        setError(null);
      }
    };

    // Listen for metrics errors
    const handleMetricsError = (_event: any, errorMessage: string) => {
      if (mounted) {
        setError(errorMessage);
      }
    };

    // Set up listeners
    ipcRenderer.on('circuit:metrics-updated', handleMetricsUpdate);
    ipcRenderer.on('circuit:metrics-error', handleMetricsError);

    // Start monitoring
    startMonitoring();

    // Auto-polling: 10초마다 메트릭 리프레시
    const pollingInterval = setInterval(async () => {
      if (mounted) {
        try {
          const result = await ipcRenderer.invoke('circuit:metrics-refresh');
          if (result.success && result.metrics) {
            setMetrics(result.metrics);
            setError(null);
          }
        } catch (err) {
          console.error('[useClaudeMetrics] Polling error:', err);
        }
      }
    }, 10000); // 10초

    // Cleanup
    return () => {
      mounted = false;

      // Clear polling interval
      clearInterval(pollingInterval);

      // Remove listeners
      ipcRenderer?.removeListener('circuit:metrics-updated', handleMetricsUpdate);
      ipcRenderer?.removeListener('circuit:metrics-error', handleMetricsError);

      // Stop monitoring
      ipcRenderer?.invoke('circuit:metrics-stop').catch(console.error);
    };
  }, []);

  return {
    metrics,
    loading,
    error,
    refresh
  };
}
