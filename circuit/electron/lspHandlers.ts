/**
 * LSP IPC Handlers
 *
 * IPC handlers for communicating between renderer process and LSP clients.
 * Bridges the renderer's LSPLanguageService to the main process's LSPClient.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { LSPClientManager, LSPClient } from './lspClient.js';
import type { LSPServerType } from './lspClient.js';

// Global LSP client manager
const lspManager = new LSPClientManager();

// Store active workspace LSP sessions
const activeSessions = new Map<string, { client: LSPClient; serverType: LSPServerType }>();

/**
 * Register all LSP-related IPC handlers
 */
export function registerLSPHandlers() {
  console.log('[lspHandlers] Registering LSP IPC handlers');

  /**
   * Start an LSP server for a workspace
   */
  ipcMain.handle('lsp:start', async (event, workspacePath: string, serverType: LSPServerType) => {
    try {
      console.log(`[lspHandlers] Starting ${serverType} LSP for workspace:`, workspacePath);

      const client = await lspManager.getClient(workspacePath, serverType);

      // Set up diagnostics callback to send to renderer
      client.onDiagnostics((uri, diagnostics) => {
        // Find all windows and broadcast diagnostics
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('lsp:diagnostics', {
            workspacePath,
            serverType,
            uri,
            diagnostics,
          });
        });
      });

      // Store active session
      const sessionKey = `${workspacePath}:${serverType}`;
      activeSessions.set(sessionKey, { client, serverType });

      return { success: true };
    } catch (error: any) {
      console.error('[lspHandlers] Failed to start LSP:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Stop an LSP server
   */
  ipcMain.handle('lsp:stop', async (event, workspacePath: string, serverType: LSPServerType) => {
    try {
      console.log(`[lspHandlers] Stopping ${serverType} LSP for workspace:`, workspacePath);

      await lspManager.stopClient(workspacePath, serverType);

      const sessionKey = `${workspacePath}:${serverType}`;
      activeSessions.delete(sessionKey);

      return { success: true };
    } catch (error: any) {
      console.error('[lspHandlers] Failed to stop LSP:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Open a document in the LSP server
   */
  ipcMain.handle(
    'lsp:openDocument',
    async (event, workspacePath: string, serverType: LSPServerType, uri: string, languageId: string, version: number, text: string) => {
      try {
        const client = await lspManager.getClient(workspacePath, serverType);
        await client.openDocument(uri, languageId, version, text);

        return { success: true };
      } catch (error: any) {
        console.error('[lspHandlers] Failed to open document:', error);
        return { success: false, error: error.message };
      }
    }
  );

  /**
   * Close a document in the LSP server
   */
  ipcMain.handle('lsp:closeDocument', async (event, workspacePath: string, serverType: LSPServerType, uri: string) => {
    try {
      const client = await lspManager.getClient(workspacePath, serverType);
      await client.closeDocument(uri);

      return { success: true };
    } catch (error: any) {
      console.error('[lspHandlers] Failed to close document:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Update document content
   */
  ipcMain.handle('lsp:updateDocument', async (event, workspacePath: string, serverType: LSPServerType, uri: string, version: number, text: string) => {
    try {
      const client = await lspManager.getClient(workspacePath, serverType);
      await client.updateDocument(uri, version, text);

      return { success: true };
    } catch (error: any) {
      console.error('[lspHandlers] Failed to update document:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get hover information
   */
  ipcMain.handle('lsp:hover', async (event, workspacePath: string, serverType: LSPServerType, uri: string, line: number, character: number) => {
    try {
      const client = await lspManager.getClient(workspacePath, serverType);
      const result = await client.getHover(uri, line, character);

      return { success: true, data: result };
    } catch (error: any) {
      console.error('[lspHandlers] Failed to get hover:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get completions
   */
  ipcMain.handle('lsp:completion', async (event, workspacePath: string, serverType: LSPServerType, uri: string, line: number, character: number) => {
    try {
      const client = await lspManager.getClient(workspacePath, serverType);
      const result = await client.getCompletions(uri, line, character);

      return { success: true, data: result };
    } catch (error: any) {
      console.error('[lspHandlers] Failed to get completions:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[lspHandlers] ✅ LSP IPC handlers registered');
}

/**
 * Cleanup function to stop all LSP servers
 */
export async function cleanupLSPHandlers() {
  console.log('[lspHandlers] Cleaning up LSP clients...');
  await lspManager.stopAll();
  activeSessions.clear();
  console.log('[lspHandlers] ✅ All LSP clients stopped');
}
