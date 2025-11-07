/**
 * Monaco Language Service
 *
 * Implementation of ILanguageService using Monaco Editor's built-in TypeScript service.
 *
 * Architecture:
 * - Wraps Monaco's TypeScript language service
 * - Converts between Monaco types and our generic types
 * - Manages type definitions via TypeDefinitionLoader
 *
 * Limitations (why we need LSP eventually):
 * - Only analyzes files that are open in the editor
 * - Cannot do project-wide analysis
 * - Limited to TypeScript/JavaScript
 */

import * as monaco from 'monaco-editor';
import type { ILanguageService } from './ILanguageService';
import type {
  Diagnostic,
  CompilerOptions,
  LanguageConfig,
  LanguageId,
} from './types';
import { TypeDefinitionLoader } from './TypeDefinitionLoader';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

export class MonacoLanguageService implements ILanguageService {
  private config: LanguageConfig | null = null;
  private typeLoader = new TypeDefinitionLoader();
  private initialized = false;

  async initialize(config: LanguageConfig): Promise<void> {
    console.log('[MonacoLanguageService] Initializing for workspace:', config.workspacePath);
    this.config = config;

    // Step 1: Load TypeScript configuration from workspace
    await this.loadWorkspaceConfig(config.workspacePath);

    // Step 2: Load type definitions
    await this.loadTypeDefinitions(config.workspacePath);

    this.initialized = true;
    console.log('[MonacoLanguageService] ✅ Initialization complete');
  }

  async getDiagnostics(uri: string): Promise<Diagnostic[]> {
    if (!this.initialized) {
      console.warn('[MonacoLanguageService] Service not initialized');
      return [];
    }

    // Find the Monaco model for this URI
    const model = monaco.editor
      .getModels()
      .find((m) => m.uri.toString() === uri);

    if (!model) {
      console.warn(`[MonacoLanguageService] No model found for URI: ${uri}`);
      return [];
    }

    // Get Monaco markers (diagnostics)
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });

    // Convert Monaco markers to our Diagnostic type
    return markers.map((marker) => ({
      severity: this.convertSeverity(marker.severity),
      message: marker.message,
      startLine: marker.startLineNumber,
      startColumn: marker.startColumn,
      endLine: marker.endLineNumber,
      endColumn: marker.endColumn,
      code: typeof marker.code === 'string' ? marker.code : marker.code?.value,
      source: marker.source,
    }));
  }

  async updateCompilerOptions(options: CompilerOptions): Promise<void> {
    console.log('[MonacoLanguageService] Updating compiler options');

    const monacoOptions = this.convertToMonacoCompilerOptions(options);

    // Apply to both TypeScript and JavaScript
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(monacoOptions);
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(monacoOptions);

    // Enable diagnostics
    const diagnosticsOptions = {
      noSemanticValidation: false,
      noSyntaxValidation: false,
      onlyVisible: false,
    };

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);

    console.log('[MonacoLanguageService] ✅ Compiler options updated');
  }

  async addTypeDefinitions(packageName: string, content: string, uri: string): Promise<void> {
    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, uri);
    console.log(`[MonacoLanguageService] ✅ Added type definitions: ${packageName}`);
  }

  async refreshDiagnostics(uri: string): Promise<void> {
    // Find the Monaco model
    const model = monaco.editor.getModels().find((m) => m.uri.toString() === uri);

    if (!model) {
      console.warn(`[MonacoLanguageService] Cannot refresh - no model for: ${uri}`);
      return;
    }

    // Trigger re-validation by updating the model
    // This is a clean way to force Monaco to re-analyze the file
    const currentValue = model.getValue();
    model.setValue(currentValue);

    console.log(`[MonacoLanguageService] ✅ Refreshed diagnostics for: ${uri}`);
  }

  getSupportedLanguages(): LanguageId[] {
    return ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
  }

  supportsLanguage(languageId: LanguageId): boolean {
    return this.getSupportedLanguages().includes(languageId);
  }

  dispose(): void {
    console.log('[MonacoLanguageService] Disposing service');
    this.typeLoader.clearCache();
    this.config = null;
    this.initialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Load workspace TypeScript configuration
   */
  private async loadWorkspaceConfig(workspacePath: string): Promise<void> {
    try {
      const result = await ipcRenderer.invoke('monaco:load-tsconfig', workspacePath);

      // Default compiler options (used if no tsconfig found)
      const defaultOptions: CompilerOptions = {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'NodeJs',
        jsx: 'react',
        lib: ['ES2020', 'DOM'],
        strict: true,
        esModuleInterop: true,
        allowJs: true,
        noEmit: true,
      };

      // Merge with workspace config if available
      const finalOptions = result.success && result.compilerOptions
        ? { ...defaultOptions, ...result.compilerOptions }
        : defaultOptions;

      await this.updateCompilerOptions(finalOptions);

      if (result.success) {
        console.log('[MonacoLanguageService] ✅ Loaded workspace TypeScript configuration');
      } else {
        console.log('[MonacoLanguageService] Using default TypeScript configuration');
      }
    } catch (error) {
      console.error('[MonacoLanguageService] Error loading workspace config:', error);
    }
  }

  /**
   * Load type definitions
   */
  private async loadTypeDefinitions(workspacePath: string): Promise<void> {
    try {
      console.log('[MonacoLanguageService] Loading type definitions...');

      const typeDefs = await this.typeLoader.loadEssentialTypes(workspacePath);

      for (const typeDef of typeDefs) {
        await this.addTypeDefinitions(typeDef.packageName, typeDef.content, typeDef.uri);
      }

      console.log(`[MonacoLanguageService] ✅ Loaded ${typeDefs.length} type definition packages`);
    } catch (error) {
      console.error('[MonacoLanguageService] Error loading type definitions:', error);
    }
  }

  /**
   * Convert our CompilerOptions to Monaco format
   */
  private convertToMonacoCompilerOptions(options: CompilerOptions): monaco.languages.typescript.CompilerOptions {
    return {
      target: this.mapTarget(options.target),
      module: this.mapModule(options.module),
      moduleResolution: this.mapModuleResolution(options.moduleResolution),
      jsx: this.mapJsx(options.jsx),
      lib: options.lib,
      strict: options.strict,
      esModuleInterop: options.esModuleInterop,
      allowJs: options.allowJs,
      checkJs: options.checkJs,
      noEmit: options.noEmit ?? true,
      baseUrl: options.baseUrl,
      paths: options.paths,
      allowNonTsExtensions: true,
      typeRoots: ['node_modules/@types'],
    };
  }

  /**
   * Convert marker severity to our Diagnostic severity
   */
  private convertSeverity(severity: monaco.MarkerSeverity): Diagnostic['severity'] {
    switch (severity) {
      case monaco.MarkerSeverity.Error:
        return 'error';
      case monaco.MarkerSeverity.Warning:
        return 'warning';
      case monaco.MarkerSeverity.Info:
        return 'info';
      case monaco.MarkerSeverity.Hint:
        return 'hint';
      default:
        return 'info';
    }
  }

  // Target mapping
  private mapTarget(value?: string): monaco.languages.typescript.ScriptTarget {
    const map: Record<string, monaco.languages.typescript.ScriptTarget> = {
      'ES3': monaco.languages.typescript.ScriptTarget.ES3,
      'ES5': monaco.languages.typescript.ScriptTarget.ES5,
      'ES6': monaco.languages.typescript.ScriptTarget.ES2015,
      'ES2015': monaco.languages.typescript.ScriptTarget.ES2015,
      'ES2016': monaco.languages.typescript.ScriptTarget.ES2016,
      'ES2017': monaco.languages.typescript.ScriptTarget.ES2017,
      'ES2018': monaco.languages.typescript.ScriptTarget.ES2018,
      'ES2019': monaco.languages.typescript.ScriptTarget.ES2019,
      'ES2020': monaco.languages.typescript.ScriptTarget.ES2020,
      'ESNext': monaco.languages.typescript.ScriptTarget.ESNext,
    };
    return value ? (map[value] ?? monaco.languages.typescript.ScriptTarget.ES2020) : monaco.languages.typescript.ScriptTarget.ES2020;
  }

  // Module mapping
  private mapModule(value?: string): monaco.languages.typescript.ModuleKind {
    const map: Record<string, monaco.languages.typescript.ModuleKind> = {
      'None': monaco.languages.typescript.ModuleKind.None,
      'CommonJS': monaco.languages.typescript.ModuleKind.CommonJS,
      'AMD': monaco.languages.typescript.ModuleKind.AMD,
      'UMD': monaco.languages.typescript.ModuleKind.UMD,
      'System': monaco.languages.typescript.ModuleKind.System,
      'ES6': monaco.languages.typescript.ModuleKind.ES2015,
      'ES2015': monaco.languages.typescript.ModuleKind.ES2015,
      'ES2020': monaco.languages.typescript.ModuleKind.ES2015, // Monaco doesn't have ES2020, use ES2015
      'ESNext': monaco.languages.typescript.ModuleKind.ESNext,
    };
    return value ? (map[value] ?? monaco.languages.typescript.ModuleKind.ESNext) : monaco.languages.typescript.ModuleKind.ESNext;
  }

  // Module resolution mapping
  private mapModuleResolution(value?: string): monaco.languages.typescript.ModuleResolutionKind {
    const map: Record<string, monaco.languages.typescript.ModuleResolutionKind> = {
      'Classic': monaco.languages.typescript.ModuleResolutionKind.Classic,
      'NodeJs': monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      'Node': monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    };
    return value ? (map[value] ?? monaco.languages.typescript.ModuleResolutionKind.NodeJs) : monaco.languages.typescript.ModuleResolutionKind.NodeJs;
  }

  // JSX mapping
  private mapJsx(value?: string): monaco.languages.typescript.JsxEmit {
    const map: Record<string, monaco.languages.typescript.JsxEmit> = {
      'None': monaco.languages.typescript.JsxEmit.None,
      'Preserve': monaco.languages.typescript.JsxEmit.Preserve,
      'React': monaco.languages.typescript.JsxEmit.React,
      'ReactNative': monaco.languages.typescript.JsxEmit.ReactNative,
      'ReactJSX': monaco.languages.typescript.JsxEmit.ReactJSX,
    };
    return value ? (map[value] ?? monaco.languages.typescript.JsxEmit.React) : monaco.languages.typescript.JsxEmit.React;
  }
}
