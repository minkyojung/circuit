/**
 * Language Service Module
 *
 * Clean, centralized export of all language service components
 */

// Core interface and types
export type { ILanguageService, LanguageServiceFactory } from './ILanguageService';
export type {
  Diagnostic,
  CompilerOptions,
  TypeDefinition,
  LanguageConfig,
  LanguageId,
  LSPServerType,
  LSPInitializeOptions,
  LSPDiagnosticNotification,
  LSPRequest,
  LSPResponse,
} from './types';

// Implementations
export { MonacoLanguageService } from './MonacoLanguageService';
export { LSPLanguageService } from './LSPLanguageService';
export { TypeDefinitionLoader } from './TypeDefinitionLoader';
