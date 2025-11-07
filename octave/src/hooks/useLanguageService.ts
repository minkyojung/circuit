/**
 * React hook for language service integration
 *
 * Provides a clean interface for components to use language services
 * (Monaco, LSP, etc.) without directly coupling to implementation details.
 */

import { useEffect, useRef, useState } from 'react';
import { MonacoLanguageService } from '@/services/language/MonacoLanguageService';
import { LSPLanguageService } from '@/services/language/LSPLanguageService';
import type { ILanguageService, LanguageConfig } from '@/services/language';

export type LanguageServiceMode = 'monaco' | 'lsp';

interface UseLanguageServiceOptions {
  workspacePath: string;
  enabled?: boolean;
  mode?: LanguageServiceMode; // 'monaco' or 'lsp'
}

interface UseLanguageServiceResult {
  languageService: ILanguageService | null;
  isInitialized: boolean;
  error: Error | null;
  mode: LanguageServiceMode;
}

/**
 * Hook to initialize and access the language service
 *
 * Usage:
 * ```tsx
 * // Use LSP mode for full project analysis (recommended)
 * const { languageService, isInitialized } = useLanguageService({
 *   workspacePath: workspace.path,
 *   mode: 'lsp'
 * });
 *
 * // Or use Monaco mode for single-file analysis (faster startup)
 * const { languageService, isInitialized } = useLanguageService({
 *   workspacePath: workspace.path,
 *   mode: 'monaco'
 * });
 *
 * // Later: refresh diagnostics
 * await languageService?.refreshDiagnostics(fileUri);
 * ```
 */
export function useLanguageService(
  options: UseLanguageServiceOptions
): UseLanguageServiceResult {
  const { workspacePath, enabled = true, mode = 'lsp' } = options; // Default to LSP for better experience

  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use ref to maintain stable instance across re-renders
  const languageServiceRef = useRef<ILanguageService | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Create service instance based on mode
    const service = mode === 'lsp'
      ? new LSPLanguageService()
      : new MonacoLanguageService();

    languageServiceRef.current = service;

    // Initialize service
    const initialize = async () => {
      try {
        console.log(`[useLanguageService] Initializing ${mode.toUpperCase()} language service...`);
        setIsInitialized(false);
        setError(null);

        const config: LanguageConfig = {
          workspacePath,
          enableDiagnostics: true,
        };

        await service.initialize(config);

        console.log(`[useLanguageService] ✅ ${mode.toUpperCase()} language service initialized successfully`);
        setIsInitialized(true);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`[useLanguageService] Failed to initialize ${mode} service:`, error);
        setError(error);
        setIsInitialized(false);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      console.log(`[useLanguageService] Disposing ${mode} language service`);
      service.dispose();
      languageServiceRef.current = null;
    };
  }, [workspacePath, enabled, mode]);

  return {
    languageService: languageServiceRef.current,
    isInitialized,
    error,
    mode,
  };
}
