/**
 * LSP Language Service
 *
 * Implementation of ILanguageService that uses Language Server Protocol
 * instead of Monaco's built-in TypeScript service.
 *
 * This provides full project-wide analysis, not just single-file validation.
 */

import type { ILanguageService } from './ILanguageService';
import type {
  LanguageConfig,
  Diagnostic,
  CompilerOptions,
  LanguageId,
  LSPServerType,
} from './types';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

/**
 * LSP Language Service
 * Communicates with Language Server Protocol servers via IPC
 */
export class LSPLanguageService implements ILanguageService {
  private workspacePath: string = '';
  private serverType: LSPServerType = 'typescript';
  private initialized: boolean = false;
  private diagnosticsMap = new Map<string, Diagnostic[]>();
  private openDocuments = new Map<string, { version: number; languageId: string }>();

  async initialize(config: LanguageConfig): Promise<void> {
    console.log('[LSPLanguageService] Initializing LSP service...');

    this.workspacePath = config.workspacePath;

    // Determine server type based on workspace (for now, default to TypeScript)
    // TODO: Auto-detect project type or allow configuration
    this.serverType = 'typescript';

    // Start LSP server
    const result = await ipcRenderer.invoke('lsp:start', this.workspacePath, this.serverType);

    if (!result.success) {
      throw new Error(`Failed to start LSP server: ${result.error}`);
    }

    // Listen for diagnostics notifications
    ipcRenderer.on('lsp:diagnostics', this.handleDiagnostics.bind(this));

    this.initialized = true;
    console.log('[LSPLanguageService] ✅ LSP service initialized successfully');
  }

  /**
   * Handle diagnostic notifications from LSP server
   */
  private handleDiagnostics(event: any, data: any): void {
    const { workspacePath, uri, diagnostics } = data;

    // Only handle diagnostics for our workspace
    if (workspacePath !== this.workspacePath) {
      return;
    }

    // Convert LSP diagnostics to our Diagnostic format
    const convertedDiagnostics: Diagnostic[] = diagnostics.map((d: any) => ({
      severity: this.convertSeverity(d.severity),
      message: d.message,
      startLine: d.range.start.line + 1, // LSP is 0-based, we use 1-based
      startColumn: d.range.start.character + 1,
      endLine: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      code: d.code,
      source: d.source,
    }));

    this.diagnosticsMap.set(uri, convertedDiagnostics);

    console.log(`[LSPLanguageService] Received diagnostics for ${uri}:`, convertedDiagnostics.length, 'issues');
  }

  /**
   * Convert LSP severity (1=Error, 2=Warning, 3=Information, 4=Hint) to our format
   */
  private convertSeverity(severity: number): 'error' | 'warning' | 'info' | 'hint' {
    switch (severity) {
      case 1: return 'error';
      case 2: return 'warning';
      case 3: return 'info';
      case 4: return 'hint';
      default: return 'error';
    }
  }

  async getDiagnostics(uri: string): Promise<Diagnostic[]> {
    // Return cached diagnostics
    return this.diagnosticsMap.get(uri) || [];
  }

  async updateCompilerOptions(options: CompilerOptions): Promise<void> {
    // LSP servers read tsconfig.json directly, so this is not needed
    // But we keep the method for interface compatibility
    console.log('[LSPLanguageService] Compiler options update requested (LSP reads tsconfig.json directly)');
  }

  async addTypeDefinitions(packageName: string, content: string, uri: string): Promise<void> {
    // LSP servers read node_modules directly, so this is not needed
    // But we keep the method for interface compatibility
    console.log('[LSPLanguageService] Type definitions add requested (LSP reads node_modules directly)');
  }

  async refreshDiagnostics(uri: string): Promise<void> {
    // With LSP, diagnostics are pushed automatically when files change
    // But we can trigger a re-open to force refresh
    const docInfo = this.openDocuments.get(uri);
    if (docInfo) {
      console.log(`[LSPLanguageService] Refreshing diagnostics for ${uri}`);
      // Increment version to trigger re-validation
      docInfo.version++;
    }
  }

  /**
   * Open a document in the LSP server
   */
  async openDocument(uri: string, languageId: string, text: string): Promise<void> {
    const version = 1;
    this.openDocuments.set(uri, { version, languageId });

    await ipcRenderer.invoke(
      'lsp:openDocument',
      this.workspacePath,
      this.serverType,
      uri,
      languageId,
      version,
      text
    );

    console.log(`[LSPLanguageService] Opened document: ${uri}`);
  }

  /**
   * Update document content in the LSP server
   */
  async updateDocument(uri: string, text: string): Promise<void> {
    const docInfo = this.openDocuments.get(uri);
    if (!docInfo) {
      console.warn(`[LSPLanguageService] Document not open: ${uri}`);
      return;
    }

    docInfo.version++;

    await ipcRenderer.invoke(
      'lsp:updateDocument',
      this.workspacePath,
      this.serverType,
      uri,
      docInfo.version,
      text
    );
  }

  /**
   * Close a document in the LSP server
   */
  async closeDocument(uri: string): Promise<void> {
    this.openDocuments.delete(uri);
    this.diagnosticsMap.delete(uri);

    await ipcRenderer.invoke(
      'lsp:closeDocument',
      this.workspacePath,
      this.serverType,
      uri
    );

    console.log(`[LSPLanguageService] Closed document: ${uri}`);
  }

  getSupportedLanguages(): LanguageId[] {
    // TypeScript LSP supports these languages
    return ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
  }

  supportsLanguage(languageId: LanguageId): boolean {
    return this.getSupportedLanguages().includes(languageId);
  }

  dispose(): void {
    console.log('[LSPLanguageService] Disposing LSP service');

    // Remove diagnostics listener
    ipcRenderer.removeAllListeners('lsp:diagnostics');

    // Stop LSP server
    ipcRenderer.invoke('lsp:stop', this.workspacePath, this.serverType);

    this.initialized = false;
    this.diagnosticsMap.clear();
    this.openDocuments.clear();
  }
}
