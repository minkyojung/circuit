/**
 * Language Service Interface
 *
 * This interface abstracts language intelligence features (diagnostics, autocomplete, etc.)
 * from the specific implementation (Monaco, LSP, etc.).
 *
 * Design Philosophy:
 * - Implementation-agnostic: Can be backed by Monaco, LSP, or any other engine
 * - Async by default: Supports both sync (Monaco) and async (LSP) implementations
 * - Clean separation: UI components only know about this interface
 */

import type {
  Diagnostic,
  CompilerOptions,
  LanguageConfig,
  LanguageId,
} from './types';

export interface ILanguageService {
  /**
   * Initialize the language service for a workspace
   * This should load configuration, type definitions, etc.
   */
  initialize(config: LanguageConfig): Promise<void>;

  /**
   * Get diagnostics (errors, warnings) for a specific file
   * @param uri - File URI (e.g., 'file:///path/to/file.ts')
   * @returns Array of diagnostics
   */
  getDiagnostics(uri: string): Promise<Diagnostic[]>;

  /**
   * Update compiler options
   * This triggers re-validation of all files
   */
  updateCompilerOptions(options: CompilerOptions): Promise<void>;

  /**
   * Add extra type definitions
   * Useful for loading @types packages or inline types
   */
  addTypeDefinitions(packageName: string, content: string, uri: string): Promise<void>;

  /**
   * Trigger re-validation of a specific file
   * This forces the language service to re-analyze the file
   */
  refreshDiagnostics(uri: string): Promise<void>;

  /**
   * Get supported languages
   */
  getSupportedLanguages(): LanguageId[];

  /**
   * Check if a language is supported
   */
  supportsLanguage(languageId: LanguageId): boolean;

  /**
   * Cleanup resources when service is no longer needed
   */
  dispose(): void;
}

/**
 * Factory function type for creating language services
 */
export type LanguageServiceFactory = (config: LanguageConfig) => Promise<ILanguageService>;
