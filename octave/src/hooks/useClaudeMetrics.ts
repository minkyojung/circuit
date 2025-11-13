import { useEffect, useState, useCallback } from 'react';
import type { ContextMetrics } from '@/types/metrics';

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

export interface OctaveMetrics {
  usage: UsageMetrics;
  context: ContextMetrics;
  timestamp: number;
}

interface UseClaudeMetricsResult {
  metrics: OctaveMetrics | null;
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
  const [metrics, setMetrics] = useState<OctaveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refresh metrics manually
  const refresh = useCallback(async () => {
    if (!ipcRenderer) {
      // Silently fail
      setLoading(false);
      return;
    }

    try {
      const result = await ipcRenderer.invoke('octave:metrics-refresh');

      if (result.success && result.metrics) {
        setMetrics(result.metrics);
        setError(null);
      }
    } catch (err) {
      // Silently fail - metrics not available
      console.warn('[useClaudeMetrics] Refresh not available (ignored)');
    }
  }, []);

  useEffect(() => {
    if (!ipcRenderer) {
      // Silently fail
      setLoading(false);
      return;
    }

    let mounted = true;

    // Start metrics monitoring
    const startMonitoring = async () => {
      try {
        // Get project path first
        const pathResult = await ipcRenderer.invoke('octave:get-project-path');

        if (!pathResult.success) {
          throw new Error('Failed to get project path');
        }

        // Start metrics monitoring
        const startResult = await ipcRenderer.invoke(
          'octave:metrics-start',
          pathResult.projectPath
        );

        if (!startResult.success) {
          throw new Error(startResult.error || 'Failed to start monitoring');
        }

        // Get initial metrics
        const metricsResult = await ipcRenderer.invoke('octave:metrics-get');

        if (mounted) {
          if (metricsResult.success && metricsResult.metrics) {
            setMetrics(metricsResult.metrics);
          }
          setLoading(false);
        }
      } catch (err) {
        console.warn('[useClaudeMetrics] Metrics not available (this is OK):', err);
        if (mounted) {
          // Don't set error state - just fail silently
          // setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    // Listen for metrics updates
    const handleMetricsUpdate = (_event: any, updatedMetrics: OctaveMetrics) => {
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
    ipcRenderer.on('octave:metrics-updated', handleMetricsUpdate);
    ipcRenderer.on('octave:metrics-error', handleMetricsError);

    // Start monitoring
    startMonitoring();

    // Auto-polling: 10초마다 메트릭 리프레시
    const pollingInterval = setInterval(async () => {
      if (mounted) {
        try {
          const result = await ipcRenderer.invoke('octave:metrics-refresh');
          if (result.success && result.metrics) {
            setMetrics(result.metrics);
            setError(null);
          }
        } catch (err) {
          // Silently fail - metrics not available
          // console.warn('[useClaudeMetrics] Polling error (ignored):', err);
        }
      }
    }, 10000); // 10초

    // Cleanup
    return () => {
      mounted = false;

      // Clear polling interval
      clearInterval(pollingInterval);

      // Remove listeners
      ipcRenderer?.removeListener('octave:metrics-updated', handleMetricsUpdate);
      ipcRenderer?.removeListener('octave:metrics-error', handleMetricsError);

      // Stop monitoring (silently fail if not available)
      ipcRenderer?.invoke('octave:metrics-stop').catch(() => {
        // Silently ignore - metrics not available
      });
    };
  }, []);

  return {
    metrics,
    loading,
    error,
    refresh
  };
}
