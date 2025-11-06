/**
 * LSP Client for Electron Main Process
 *
 * Manages Language Server Protocol clients for different languages.
 * Spawns language server processes and handles communication via stdio.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

interface LSPMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export type LSPServerType = 'typescript' | 'python' | 'go' | 'rust';

/**
 * LSP Client for a single language server
 */
export class LSPClient {
  private serverProcess: ChildProcess | null = null;
  private serverType: LSPServerType;
  private workspacePath: string;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (error: any) => void }>();
  private buffer = '';
  private initialized = false;
  private diagnosticsCallback: ((uri: string, diagnostics: any[]) => void) | null = null;

  constructor(serverType: LSPServerType, workspacePath: string) {
    this.serverType = serverType;
    this.workspacePath = workspacePath;
  }

  /**
   * Start the language server process
   */
  async start(): Promise<void> {
    console.log(`[LSPClient] Starting ${this.serverType} language server for workspace:`, this.workspacePath);

    const serverCommand = this.getServerCommand();
    if (!serverCommand) {
      throw new Error(`Unsupported language server: ${this.serverType}`);
    }

    const { command, args } = serverCommand;

    // Spawn the language server process
    this.serverProcess = spawn(command, args, {
      cwd: this.workspacePath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!this.serverProcess.stdout || !this.serverProcess.stdin || !this.serverProcess.stderr) {
      throw new Error('Failed to create language server process streams');
    }

    // Handle stdout (LSP messages)
    this.serverProcess.stdout.on('data', (data: Buffer) => {
      this.handleServerMessage(data);
    });

    // Handle stderr (logs)
    this.serverProcess.stderr.on('data', (data: Buffer) => {
      console.error(`[LSPClient ${this.serverType}] stderr:`, data.toString());
    });

    // Handle process exit
    this.serverProcess.on('exit', (code) => {
      console.log(`[LSPClient ${this.serverType}] Process exited with code:`, code);
      this.initialized = false;
    });

    // Initialize the server
    await this.initialize();

    console.log(`[LSPClient] ✅ ${this.serverType} language server started successfully`);
  }

  /**
   * Get server command and args based on server type
   */
  private getServerCommand(): { command: string; args: string[] } | null {
    switch (this.serverType) {
      case 'typescript':
        // Use typescript-language-server
        return {
          command: 'npx',
          args: ['typescript-language-server', '--stdio'],
        };
      case 'python':
        // Use pyright
        return {
          command: 'pyright-langserver',
          args: ['--stdio'],
        };
      case 'go':
        // Use gopls
        return {
          command: 'gopls',
          args: ['serve'],
        };
      case 'rust':
        // Use rust-analyzer
        return {
          command: 'rust-analyzer',
          args: [],
        };
      default:
        return null;
    }
  }

  /**
   * Initialize the language server
   */
  private async initialize(): Promise<void> {
    const initializeParams = {
      processId: process.pid,
      clientInfo: {
        name: 'Circuit',
        version: '1.0.0',
      },
      rootUri: `file://${this.workspacePath}`,
      capabilities: {
        textDocument: {
          synchronization: {
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: true,
          },
          completion: {
            dynamicRegistration: false,
            completionItem: {
              snippetSupport: true,
              commitCharactersSupport: false,
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          hover: {
            dynamicRegistration: false,
            contentFormat: ['markdown', 'plaintext'],
          },
          publishDiagnostics: {
            relatedInformation: true,
            tagSupport: { valueSet: [1, 2] },
          },
        },
        workspace: {
          workspaceFolders: true,
          configuration: true,
        },
      },
      workspaceFolders: [
        {
          uri: `file://${this.workspacePath}`,
          name: path.basename(this.workspacePath),
        },
      ],
    };

    const response = await this.sendRequest('initialize', initializeParams);
    console.log(`[LSPClient ${this.serverType}] Initialize response:`, response);

    // Send initialized notification
    await this.sendNotification('initialized', {});

    this.initialized = true;
  }

  /**
   * Handle incoming messages from the server
   */
  private handleServerMessage(data: Buffer): void {
    this.buffer += data.toString();

    // Process complete messages
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      // Parse headers
      const headers = this.buffer.substring(0, headerEnd);
      const contentLengthMatch = headers.match(/Content-Length: (\d+)/i);
      if (!contentLengthMatch) {
        console.error('[LSPClient] No Content-Length header found');
        break;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (this.buffer.length < messageEnd) {
        // Message not complete yet
        break;
      }

      // Extract message
      const messageContent = this.buffer.substring(messageStart, messageEnd);
      this.buffer = this.buffer.substring(messageEnd);

      try {
        const message: LSPMessage = JSON.parse(messageContent);
        this.handleMessage(message);
      } catch (error) {
        console.error('[LSPClient] Failed to parse message:', error, messageContent);
      }
    }
  }

  /**
   * Handle a parsed LSP message
   */
  private handleMessage(message: LSPMessage): void {
    // Response to a request
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message || 'LSP request failed'));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // Notification from server
    if (message.method) {
      this.handleNotification(message.method, message.params);
    }
  }

  /**
   * Handle notifications from the server
   */
  private handleNotification(method: string, params: any): void {
    if (method === 'textDocument/publishDiagnostics') {
      // Diagnostic notification
      const { uri, diagnostics } = params;
      console.log(`[LSPClient ${this.serverType}] Diagnostics for ${uri}:`, diagnostics.length);

      if (this.diagnosticsCallback) {
        this.diagnosticsCallback(uri, diagnostics);
      }
    } else if (method === 'window/logMessage') {
      // Log message from server
      console.log(`[LSPClient ${this.serverType}] ${params.message}`);
    }
  }

  /**
   * Send a request to the language server
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.serverProcess || !this.serverProcess.stdin) {
      throw new Error('Language server not running');
    }

    const id = ++this.messageId;
    const message: LSPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const content = JSON.stringify(message);
      const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;

      this.serverProcess!.stdin!.write(header + content, 'utf8');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('LSP request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Send a notification to the language server
   */
  private async sendNotification(method: string, params: any): Promise<void> {
    if (!this.serverProcess || !this.serverProcess.stdin) {
      throw new Error('Language server not running');
    }

    const message: LSPMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;

    this.serverProcess.stdin.write(header + content, 'utf8');
  }

  /**
   * Open a document in the language server
   */
  async openDocument(uri: string, languageId: string, version: number, text: string): Promise<void> {
    await this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version,
        text,
      },
    });
  }

  /**
   * Close a document in the language server
   */
  async closeDocument(uri: string): Promise<void> {
    await this.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });
  }

  /**
   * Update document content
   */
  async updateDocument(uri: string, version: number, text: string): Promise<void> {
    await this.sendNotification('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  /**
   * Get hover information
   */
  async getHover(uri: string, line: number, character: number): Promise<any> {
    return this.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  /**
   * Get completions
   */
  async getCompletions(uri: string, line: number, character: number): Promise<any> {
    return this.sendRequest('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  /**
   * Set callback for diagnostics notifications
   */
  onDiagnostics(callback: (uri: string, diagnostics: any[]) => void): void {
    this.diagnosticsCallback = callback;
  }

  /**
   * Stop the language server
   */
  async stop(): Promise<void> {
    if (!this.serverProcess) return;

    try {
      await this.sendRequest('shutdown', {});
      await this.sendNotification('exit', {});
    } catch (error) {
      console.error(`[LSPClient ${this.serverType}] Error during shutdown:`, error);
    }

    this.serverProcess.kill();
    this.serverProcess = null;
    this.initialized = false;

    console.log(`[LSPClient] ${this.serverType} language server stopped`);
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * LSP Client Manager
 * Manages multiple LSP clients for different workspaces and languages
 */
export class LSPClientManager {
  private clients = new Map<string, LSPClient>();

  /**
   * Get or create an LSP client
   */
  async getClient(workspacePath: string, serverType: LSPServerType): Promise<LSPClient> {
    const key = `${workspacePath}:${serverType}`;

    let client = this.clients.get(key);
    if (!client) {
      client = new LSPClient(serverType, workspacePath);
      await client.start();
      this.clients.set(key, client);
    }

    return client;
  }

  /**
   * Stop a specific client
   */
  async stopClient(workspacePath: string, serverType: LSPServerType): Promise<void> {
    const key = `${workspacePath}:${serverType}`;
    const client = this.clients.get(key);

    if (client) {
      await client.stop();
      this.clients.delete(key);
    }
  }

  /**
   * Stop all clients
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.clients.values()).map(client => client.stop());
    await Promise.all(stopPromises);
    this.clients.clear();
  }
}
