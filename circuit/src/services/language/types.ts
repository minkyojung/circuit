/**
 * Language Service Types
 *
 * Common types used across all language service implementations.
 * These types abstract away Monaco-specific details and provide
 * a clean interface for future LSP integration.
 */

/**
 * Represents a diagnostic issue (error, warning, etc.)
 */
export interface Diagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  code?: string | number;
  source?: string;
}

/**
 * Compiler options for TypeScript/JavaScript
 */
export interface CompilerOptions {
  target?: string;
  module?: string;
  moduleResolution?: string;
  jsx?: string;
  lib?: string[];
  strict?: boolean;
  esModuleInterop?: boolean;
  allowJs?: boolean;
  checkJs?: boolean;
  noEmit?: boolean;
  baseUrl?: string;
  paths?: Record<string, string[]>;
  [key: string]: any;
}

/**
 * Type definition source
 */
export interface TypeDefinition {
  packageName: string;
  content: string;
  uri: string;
  source: 'node_modules' | 'builtin' | 'inline';
}

/**
 * Language service configuration
 */
export interface LanguageConfig {
  workspacePath: string;
  compilerOptions?: CompilerOptions;
  enableDiagnostics?: boolean;
  typeDefinitions?: TypeDefinition[];
}

/**
 * Language identifier
 */
export type LanguageId =
  | 'typescript'
  | 'javascript'
  | 'typescriptreact'
  | 'javascriptreact'
  | 'python'
  | 'go'
  | 'rust';

/**
 * LSP-specific types
 */

/**
 * LSP server type
 */
export type LSPServerType = 'typescript' | 'python' | 'go' | 'rust';

/**
 * LSP initialization options
 */
export interface LSPInitializeOptions {
  workspacePath: string;
  serverType: LSPServerType;
  compilerOptions?: CompilerOptions;
}

/**
 * LSP diagnostic notification
 */
export interface LSPDiagnosticNotification {
  uri: string;
  diagnostics: Diagnostic[];
}

/**
 * LSP request types
 */
export type LSPRequest =
  | { type: 'initialize'; params: LSPInitializeOptions }
  | { type: 'getDiagnostics'; params: { uri: string } }
  | { type: 'getCompletions'; params: { uri: string; line: number; character: number } }
  | { type: 'getHover'; params: { uri: string; line: number; character: number } }
  | { type: 'shutdown' };

/**
 * LSP response types
 */
export interface LSPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
