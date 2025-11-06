const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const os = require('os');
const http = require('http');

const execAsync = promisify(exec);

// Import MCP Server Manager (ES Module)
let mcpManagerPromise = null;
async function getMCPManagerInstance() {
  console.log('[main.cjs] getMCPManagerInstance called');
  if (!mcpManagerPromise) {
    console.log('[main.cjs] Creating new MCP Manager instance...');
    mcpManagerPromise = import('../dist-electron/mcp-manager.js')
      .then(module => {
        console.log('[main.cjs] mcp-manager.js imported successfully');
        return module.getMCPManager();
      })
      .catch(error => {
        console.error('[main.cjs] Failed to import mcp-manager.js:', error);
        throw error;
      });
  }
  const manager = await mcpManagerPromise;
  console.log('[main.cjs] MCP Manager instance ready');
  return manager;
}

// Import Circuit API Server (ES Module)
let apiServerPromise = null;
async function getAPIServerInstance() {
  if (!apiServerPromise) {
    apiServerPromise = (async () => {
      const mcpManager = await getMCPManagerInstance();
      const { CircuitAPIServer } = await import('../dist-electron/api-server.js');
      return new CircuitAPIServer(mcpManager);
    })();
  }
  return apiServerPromise;
}

// Import Workspace Context Tracker (ES Module) - Refactored for simplicity
let contextTrackerPromise = null;
let eventListenersSetup = false;

async function getWorkspaceContextTrackerInstance() {
  console.log('[main.cjs] getWorkspaceContextTrackerInstance called');
  if (!contextTrackerPromise) {
    console.log('[main.cjs] Creating new Workspace Context Tracker instance...');
    contextTrackerPromise = import('../dist-electron/workspace-context-tracker.js')
      .then(module => {
        console.log('[main.cjs] workspace-context-tracker.js imported successfully');
        const tracker = new module.WorkspaceContextTracker();

        // Set up global event listeners once
        if (!eventListenersSetup) {
          tracker.on('context-updated', (workspaceId, context) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('workspace:context-updated', workspaceId, context);
            }
          });

          tracker.on('context-waiting', (workspaceId) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('workspace:context-waiting', workspaceId);
            }
          });

          eventListenersSetup = true;
          console.log('[main.cjs] Global event listeners set up');
        }

        return tracker;
      })
      .catch(error => {
        console.error('[main.cjs] Failed to import workspace-context-tracker.js:', error);
        throw error;
      });
  }
  const tracker = await contextTrackerPromise;
  console.log('[main.cjs] Workspace Context Tracker instance ready');
  return tracker;
}

// Import Terminal Manager (ES Module)
let terminalManagerPromise = null;

async function getTerminalManagerInstance() {
  console.log('[main.cjs] getTerminalManagerInstance called');
  if (!terminalManagerPromise) {
    console.log('[main.cjs] Creating new Terminal Manager instance...');
    terminalManagerPromise = import('../dist-electron/terminalManager.js')
      .then(module => {
        console.log('[main.cjs] terminalManager.js imported successfully');
        const manager = module.getTerminalManager();

        // Set up event listeners for terminal data and exit
        manager.on('data', (workspaceId, data) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('terminal:data', workspaceId, data);
          }
        });

        manager.on('exit', (workspaceId, exitCode) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('terminal:exit', workspaceId, exitCode);
          }
        });

        return manager;
      })
      .catch(error => {
        console.error('[main.cjs] Failed to import terminalManager.js:', error);
        throw error;
      });
  }
  const manager = await terminalManagerPromise;
  console.log('[main.cjs] Terminal Manager instance ready');
  return manager;
}

/**
 * Install circuit-proxy to ~/.circuit/bin/
 * This proxy allows Claude Code to access all MCP servers via a single MCP interface
 */
async function installCircuitProxy() {
  try {
    const circuitDir = path.join(os.homedir(), '.circuit');
    const binDir = path.join(circuitDir, 'bin');
    const proxyDestPath = path.join(binDir, 'circuit-proxy');

    // Create directories
    await fs.mkdir(binDir, { recursive: true });

    // Copy the proxy script
    const proxySourcePath = path.join(__dirname, 'circuit-proxy.js');
    await fs.copyFile(proxySourcePath, proxyDestPath);

    // Make it executable
    await fs.chmod(proxyDestPath, 0o755);

    console.log('[Circuit] Proxy installed to:', proxyDestPath);
    return { success: true, path: proxyDestPath };
  } catch (error) {
    console.error('[Circuit] Failed to install proxy:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Install built-in Memory server
 * Auto-installs if not present, auto-starts for project context
 */
async function installMemoryServer(manager) {
  try {
    const serverId = 'circuit-memory';

    // Uninstall if already exists (to ensure latest path)
    if (manager.servers.has(serverId)) {
      console.log('[Circuit] Uninstalling existing Memory server...');
      await manager.uninstall(serverId);
    }

    // Use same project path logic as UI (circuit:get-project-path)
    // From: /path/to/circuit-1/.conductor/hyderabad/circuit/electron
    // To:   /path/to/circuit-1
    const projectPath = path.resolve(__dirname, '../../../..');

    // Install Memory server (built file is in dist-electron)
    const memoryServerPath = path.join(__dirname, '../dist-electron/memory-server.js');
    console.log('[Circuit] Installing Memory server from:', memoryServerPath);
    console.log('[Circuit] Memory server project path:', projectPath);

    await manager.install(serverId, {
      command: 'node',
      args: [memoryServerPath],
      env: {
        PROJECT_PATH: projectPath,
      },
      autoStart: true,
    });

    console.log('[Circuit] Memory server installed for project:', projectPath);
    return { success: true };
  } catch (error) {
    console.error('[Circuit] Failed to install Memory server:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Install Vercel Deployment MCP server
 * Monitors Vercel deployments and provides error logs
 */
async function installVercelServer(manager) {
  try {
    const serverId = 'vercel-deployments';

    // Uninstall if already exists
    if (manager.servers.has(serverId)) {
      console.log('[Circuit] Uninstalling existing Vercel server...');
      await manager.uninstall(serverId);
    }

    // Get Vercel token from environment or electron-store
    // For now, use environment variable (can be set in .env or system)
    const vercelToken = process.env.VERCEL_TOKEN || '';
    const vercelTeamId = process.env.VERCEL_TEAM_ID || '';

    if (!vercelToken) {
      console.warn('[Circuit] VERCEL_TOKEN not set - Vercel MCP will not work');
      console.warn('[Circuit] Set VERCEL_TOKEN environment variable to use Vercel features');
    }

    // Install Vercel server (built file is in dist-electron)
    const vercelServerPath = path.join(__dirname, '../dist-electron/vercel-mcp-server.js');
    console.log('[Circuit] Installing Vercel server from:', vercelServerPath);

    await manager.install(serverId, {
      command: 'node',
      args: [vercelServerPath],
      env: {
        VERCEL_TOKEN: vercelToken,
        VERCEL_TEAM_ID: vercelTeamId,
      },
      autoStart: true,
    });

    console.log('[Circuit] Vercel server installed');
    return { success: true };
  } catch (error) {
    console.error('[Circuit] Failed to install Vercel server:', error);
    return { success: false, error: error.message };
  }
}

// macOS traffic light button positioning
const HEADER_HEIGHT = 44;
const TRAFFIC_LIGHTS_HEIGHT = 14;
const TRAFFIC_LIGHTS_MARGIN = 20;

// Window instances
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    transparent: true,
    vibrancy: 'under-window',  // macOS native glassmorphism
    visualEffectState: 'active',
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    ...(process.platform === 'darwin' && {
      trafficLightPosition: {
        x: TRAFFIC_LIGHTS_MARGIN,
        y: (HEADER_HEIGHT - TRAFFIC_LIGHTS_HEIGHT) / 2
      }
    }),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load from Vite dev server in development, or built files in production
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools(); // Disabled auto-open DevTools
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Clean up reference when window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// Webhook Server for Integrations (Vercel, GitHub, etc.)
// ============================================================================

/**
 * Handle Vercel deployment webhook
 */
function handleVercelWebhook(payload, res) {
  try {
    const deploymentData = {
      type: 'deployment',
      source: 'vercel',
      status: transformVercelStatus(payload.deployment.state),
      projectName: payload.deployment.projectSettings?.name || payload.deployment.name,
      branch: payload.deployment.meta?.githubCommitRef || 'main',
      commit: payload.deployment.meta?.githubCommitSha?.slice(0, 7) || 'unknown',
      timestamp: Date.now(),
      duration: payload.deployment.ready ? Date.now() - payload.deployment.createdAt : undefined,
      url: payload.deployment.url ? `https://${payload.deployment.url}` : undefined,
      logUrl: payload.deployment.inspectorUrl,
      error: payload.deployment.errorMessage ? {
        message: payload.deployment.errorMessage,
      } : undefined
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

/**
 * Handle GitHub webhook events
 */
function handleGitHubWebhook(payload, eventType, res) {
  try {
    let githubData = null;

    // Push event
    if (eventType === 'push') {
      githubData = {
        type: 'github',
        eventType: 'push',
        repository: payload.repository.full_name,
        timestamp: Date.now(),
        push: {
          ref: payload.ref.replace('refs/heads/', ''),
          pusher: payload.pusher.name,
          commits: payload.commits.map(c => ({
            sha: c.id.slice(0, 7),
            message: c.message.split('\n')[0],  // First line only
            author: c.author.name
          })),
          compareUrl: payload.compare
        }
      };
    }

    // Pull Request event
    else if (eventType === 'pull_request') {
      githubData = {
        type: 'github',
        eventType: 'pull_request',
        repository: payload.repository.full_name,
        timestamp: Date.now(),
        pullRequest: {
          number: payload.pull_request.number,
          title: payload.pull_request.title,
          action: payload.action,
          author: payload.pull_request.user.login,
          state: payload.pull_request.state,
          merged: payload.pull_request.merged || false,
          mergeable: payload.pull_request.mergeable,
          url: payload.pull_request.html_url
        }
      };
    }

    // Check Run event (CI/CD)
    else if (eventType === 'check_run') {
      githubData = {
        type: 'github',
        eventType: 'check_run',
        repository: payload.repository.full_name,
        timestamp: Date.now(),
        checkRun: {
          name: payload.check_run.name,
          status: payload.check_run.status,
          conclusion: payload.check_run.conclusion,
          branch: payload.check_run.check_suite?.head_branch || payload.check_run.head_branch || 'unknown',
          commit: payload.check_run.head_sha ? payload.check_run.head_sha.slice(0, 7) : 'unknown',
          detailsUrl: payload.check_run.details_url || payload.check_run.html_url
        }
      };
    }

    // Pull Request Review event
    else if (eventType === 'pull_request_review') {
      githubData = {
        type: 'github',
        eventType: 'review',
        repository: payload.repository.full_name,
        timestamp: Date.now(),
        review: {
          pullRequestNumber: payload.pull_request.number,
          reviewer: payload.review.user.login,
          state: payload.review.state.toLowerCase(),
          body: payload.review.body
        }
      };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

/**
 * Start HTTP server to receive webhooks from various services
 * Server listens on port 3456 by default
 */
function startWebhookServer() {
  const PORT = process.env.WEBHOOK_PORT || 3456;

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);

        // Route based on URL
        if (req.url === '/webhook/vercel') {
          handleVercelWebhook(payload, res);
        }
        else if (req.url === '/webhook/github') {
          // GitHub sends event type in X-GitHub-Event header
          const eventType = req.headers['x-github-event'];
          handleGitHubWebhook(payload, eventType, res);
        }
        else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  });

  // Handle port conflicts gracefully
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`[Webhook] Port ${PORT} is already in use. Webhook server not started.`);
      console.warn(`[Webhook] This likely means another instance is running. Webhooks will be handled by that instance.`);
    } else {
      console.error(`[Webhook] Server error:`, error);
    }
  });

  server.listen(PORT, () => {
    console.log(`[Webhook] Server listening on port ${PORT}`);
    console.log(`[Webhook] Vercel endpoint: http://localhost:${PORT}/webhook/vercel`);
    console.log(`[Webhook] GitHub endpoint: http://localhost:${PORT}/webhook/github`);
  });

  // Store server reference for cleanup
  app.on('before-quit', () => {
    server.close();
  });

  return server;
}

/**
 * Transform Vercel deployment status to our status enum
 */
function transformVercelStatus(vercelStatus) {
  const statusMap = {
    'BUILDING': 'building',
    'READY': 'success',
    'ERROR': 'failed',
    'CANCELED': 'cancelled',
    'QUEUED': 'building',
    'INITIALIZING': 'building'
  };
  return statusMap[vercelStatus] || 'building';
}

// Global error handlers to prevent app crashes from EPIPE and other uncaught exceptions
process.on('uncaughtException', (error) => {
  // Ignore EPIPE errors (broken pipe) which happen when child processes exit
  if (error.code === 'EPIPE' || error.errno === 'EPIPE') {
    console.warn('[Process] Ignoring EPIPE error (broken pipe)');
    return;
  }

  // Log other uncaught exceptions
  console.error('[Process] Uncaught Exception:', error);

  // Don't exit the app for most errors
  // Only exit for critical errors
  if (error.code === 'ERR_CRITICAL') {
    app.quit();
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Prevent default Electron crash behavior
app.on('render-process-gone', (event, webContents, details) => {
  console.error('[App] Render process gone:', details);
});

app.whenReady().then(async () => {
  console.log('[main.cjs] ===== APP READY =====');

  // Initialize conversation storage BEFORE creating windows
  console.log('[main.cjs] Initializing conversation handlers...');
  try {
    console.log('[main.cjs] Requiring conversationHandlers...');
    const { initializeConversationStorage, registerConversationHandlers } = require('../dist-electron/conversationHandlers.js');
    console.log('[main.cjs] Require successful, initializing storage...');
    await initializeConversationStorage();
    console.log('[main.cjs] Storage initialized, registering handlers...');
    registerConversationHandlers();
    console.log('[main.cjs] ✅ Conversation handlers registered successfully');

    // Register agent handlers (requires storage to be initialized)
    console.log('[main.cjs] Registering agent handlers...');
    const { registerAgentHandlers } = require('../dist-electron/agentHandlers.js');
    registerAgentHandlers();
    console.log('[main.cjs] ✅ Agent handlers registered successfully');

    // Register file system handlers
    console.log('[main.cjs] Registering file system handlers...');
    const { registerFileSystemHandlers } = require('../dist-electron/fileSystemHandlers.js');
    registerFileSystemHandlers();
    console.log('[main.cjs] ✅ File system handlers registered successfully');
  } catch (error) {
    console.error('[main.cjs] ❌ CRITICAL: Failed to register handlers:', error);
    console.error('[main.cjs] Error stack:', error.stack);
  }

  console.log('[main.cjs] Creating windows...');
  createWindow();

  // Start Vercel webhook server
  startWebhookServer();

  // Initialize MCP Manager and API Server
  try {
    // Install circuit-proxy
    await installCircuitProxy();

    // Start Circuit HTTP API Server
    const apiServer = await getAPIServerInstance();
    await apiServer.start();
    console.log('Circuit API Server started');

    // Install built-in Memory server if not already installed
    const manager = await getMCPManagerInstance();
    await installMemoryServer(manager);
    await installVercelServer(manager);

    // Start MCP servers
    await manager.startAllAutoStartServers();
    console.log('Auto-start servers initialized');
  } catch (error) {
    console.error('Failed to initialize MCP/API:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================================
// MCP Server Management
// ============================================================================

class MCPServer {
  constructor(config) {
    this.config = config;
    this.process = null;
    this.status = 'stopped';
    this.pendingRequests = new Map();
    this.messageBuffer = '';
    this.nextId = 1;
    this.eventTarget = null; // Will be set to the main window
  }

  start() {
    if (this.process) {
      throw new Error('Server already running');
    }

    return new Promise((resolve, reject) => {
      let initTimeout;
      let hasExited = false;
      let stderrBuffer = '';

      const cleanup = () => {
        if (initTimeout) {
          clearTimeout(initTimeout);
        }
      };

      const rejectWithCleanup = (error) => {
        cleanup();
        this.status = 'error';
        if (this.process && !hasExited) {
          this.process.kill();
        }
        reject(error);
      };

      try {
        this.status = 'starting';

        // Spawn the MCP server process
        this.process = spawn(this.config.command, this.config.args || [], {
          env: { ...process.env, ...this.config.env },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Set initialization timeout (10 seconds)
        initTimeout = setTimeout(() => {
          rejectWithCleanup(new Error('Server initialization timeout'));
        }, 10000);

        // Handle stdout (JSON-RPC messages)
        this.process.stdout.on('data', (data) => {
          this.handleStdout(data);
        });

        // Handle stderr (logs and error detection)
        this.process.stderr.on('data', (data) => {
          const message = data.toString();
          stderrBuffer += message;

          console.error(`[MCP Server ${this.config.id}] stderr:`, message);
          this.sendToRenderer({ type: 'log', level: 'error', message });

          // Detect fatal errors
          if (this.status === 'starting') {
            const lowerMessage = message.toLowerCase();
            if (
              lowerMessage.includes('error') ||
              lowerMessage.includes('cannot find module') ||
              lowerMessage.includes('404') ||
              lowerMessage.includes('enoent')
            ) {
              // Wait a bit to collect full error message
              setTimeout(() => {
                if (this.status === 'starting') {
                  rejectWithCleanup(new Error(`Server failed to start: ${stderrBuffer.trim()}`));
                }
              }, 100);
            }
          }
        });

        // Handle process exit during initialization
        this.process.on('exit', (code) => {
          hasExited = true;
          console.log(`[MCP Server ${this.config.id}] exited with code ${code}`);

          if (this.status === 'starting') {
            rejectWithCleanup(new Error(`Server exited during initialization (code ${code})`));
          } else {
            this.status = 'stopped';
            this.process = null;
            this.sendToRenderer({ type: 'status', status: 'stopped' });
          }
        });

        // Handle process spawn errors
        this.process.on('error', (error) => {
          console.error(`[MCP Server ${this.config.id}] spawn error:`, error);
          rejectWithCleanup(error);
        });

        // Send initialize request after a short delay
        // This allows the process to fully start up
        setTimeout(() => {
          if (this.status !== 'starting' || !this.process) {
            return;
          }

          this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {
              roots: { listChanged: true },
              sampling: {}
            },
            clientInfo: {
              name: 'Circuit',
              version: '0.1.0'
            }
          }).then((result) => {
            cleanup();
            this.status = 'running';
            this.sendToRenderer({
              type: 'initialized',
              capabilities: result.capabilities,
              serverInfo: result.serverInfo
            });
            resolve(result);
          }).catch((error) => {
            rejectWithCleanup(error);
          });
        }, 100);

      } catch (error) {
        rejectWithCleanup(error);
      }
    });
  }

  stop() {
    if (!this.process) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.process.once('exit', () => {
        this.process = null;
        this.status = 'stopped';
        this.pendingRequests.clear();
        resolve();
      });

      this.process.kill();

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  handleStdout(data) {
    this.messageBuffer += data.toString();

    // Try to parse complete JSON-RPC messages
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        console.error('[MCP Server] Failed to parse message:', line, error);
      }
    }
  }

  handleMessage(message) {
    // Handle response
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);

        const latency = Date.now() - pending.timestamp;

        if (message.error) {
          pending.reject(message.error);
          this.sendToRenderer({
            type: 'message',
            message: {
              id: message.id,
              type: 'error',
              method: pending.method,
              data: message.error,
              timestamp: Date.now(),
              latency
            }
          });
        } else {
          pending.resolve(message.result);
          this.sendToRenderer({
            type: 'message',
            message: {
              id: message.id,
              type: 'response',
              method: pending.method,
              data: message.result,
              timestamp: Date.now(),
              latency
            }
          });
        }
      }
    }
    // Handle notification
    else if (message.method && message.id === undefined) {
      this.sendToRenderer({
        type: 'message',
        message: {
          id: `notif-${Date.now()}`,
          type: 'notification',
          method: message.method,
          data: message.params,
          timestamp: Date.now()
        }
      });
    }
  }

  sendRequest(method, params) {
    if (!this.process) {
      return Promise.reject(new Error('Server not running'));
    }

    const id = this.nextId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve,
        reject,
        method,
        timestamp: Date.now()
      });

      // Send to renderer for logging
      this.sendToRenderer({
        type: 'message',
        message: {
          id,
          type: 'request',
          method,
          data: params,
          timestamp: Date.now()
        }
      });

      const message = JSON.stringify(request) + '\n';
      this.process.stdin.write(message);

      // Timeout after 5 seconds (reduced from 30)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout for method: ${method}`));
        }
      }, 5000);
    });
  }

  sendToRenderer(data) {
    const payload = {
      serverId: this.config.id,
      ...data
    };

    // Send to main window (Developer tab)
    if (this.eventTarget) {
      this.eventTarget.webContents.send('mcp-event', payload);
    }
  }
}

// Active servers
const activeServers = new Map();

// IPC Handlers
ipcMain.handle('mcp:start-server', async (event, config) => {
  try {
    if (activeServers.has(config.id)) {
      throw new Error('Server already running');
    }

    const server = new MCPServer(config);
    server.eventTarget = BrowserWindow.fromWebContents(event.sender);
    activeServers.set(config.id, server);

    const result = await server.start();
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mcp:stop-server', async (event, serverId) => {
  try {
    const server = activeServers.get(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    await server.stop();
    activeServers.delete(serverId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mcp:send-request', async (event, serverId, method, params) => {
  try {
    const server = activeServers.get(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    const result = await server.sendRequest(method, params);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mcp:get-server-status', async (event, serverId) => {
  const server = activeServers.get(serverId);
  return {
    status: server ? server.status : 'stopped'
  };
});

// ============================================================================
// Deployments - Test Webhook Sender
// ============================================================================

/**
 * Send test deployment webhook to peek panel
 */
ipcMain.handle('deployments:send-test-webhook', async (event, status) => {
  try {
    // Generate sample deployment data based on status
    const sampleData = {
      building: {
        type: 'deployment',
        source: 'vercel',
        status: 'building',
        projectName: 'my-awesome-app',
        branch: 'main',
        commit: 'abc1234',
        timestamp: Date.now(),
        url: 'https://my-awesome-app-abc123.vercel.app',
        logUrl: 'https://vercel.com/logs/abc123'
      },
      success: {
        type: 'deployment',
        source: 'vercel',
        status: 'success',
        projectName: 'my-awesome-app',
        branch: 'main',
        commit: 'abc1234',
        timestamp: Date.now(),
        duration: 45000,
        url: 'https://my-awesome-app-abc123.vercel.app',
        logUrl: 'https://vercel.com/logs/abc123'
      },
      failed: {
        type: 'deployment',
        source: 'vercel',
        status: 'failed',
        projectName: 'my-awesome-app',
        branch: 'feature-new-ui',
        commit: 'def9876',
        timestamp: Date.now(),
        duration: 32000,
        url: 'https://my-awesome-app-def987.vercel.app',
        logUrl: 'https://vercel.com/logs/def987',
        error: {
          message: 'Build failed: Module not found'
        }
      }
    };

    const deploymentData = sampleData[status];

    if (!deploymentData) {
      return {
        success: false,
        error: `Invalid status: ${status}`
      };
    }

    // Send event to main window
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// GitHub - Test Webhook Sender
// ============================================================================

/**
 * Send test GitHub webhook to peek panel
 */
ipcMain.handle('github:send-test-webhook', async (event, eventType) => {
  try {
    // Generate sample GitHub data based on event type
    const sampleData = {
      push: {
        type: 'github',
        eventType: 'push',
        repository: 'user/my-awesome-app',
        timestamp: Date.now(),
        push: {
          ref: 'main',
          pusher: 'john',
          commits: [
            {
              sha: 'abc1234',
              message: 'Add new feature',
              author: 'john'
            },
            {
              sha: 'def5678',
              message: 'Fix typo',
              author: 'john'
            }
          ],
          compareUrl: 'https://github.com/user/repo/compare/abc...def'
        }
      },
      pull_request: {
        type: 'github',
        eventType: 'pull_request',
        repository: 'user/my-awesome-app',
        timestamp: Date.now(),
        pullRequest: {
          number: 123,
          title: 'Add dark mode',
          action: 'opened',
          author: 'alice',
          state: 'open',
          merged: false,
          mergeable: true,
          url: 'https://github.com/user/repo/pull/123'
        }
      },
      check_run: {
        type: 'github',
        eventType: 'check_run',
        repository: 'user/my-awesome-app',
        timestamp: Date.now(),
        checkRun: {
          name: 'tests',
          status: 'completed',
          conclusion: 'success',
          branch: 'main',
          commit: 'abc1234',
          detailsUrl: 'https://github.com/user/repo/runs/456'
        }
      }
    };

    const githubData = sampleData[eventType];

    if (!githubData) {
      return {
        success: false,
        error: `Invalid event type: ${eventType}`
      };
    }

    // Send to peek panel
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// ============================================================================
// Circuit Test-Fix Loop - Phase 1: Project Path Detection
// ============================================================================

/**
 * Get the actual project path from the Conductor workspace
 * Resolves from: /path/to/project/.conductor/workspace/circuit/electron
 * To: /path/to/project
 */
ipcMain.handle('circuit:get-project-path', async () => {
  try {
    // Get the electron directory path
    // e.g., /Users/williamjung/conductor/circuit-1/.conductor/hyderabad/circuit/electron
    const electronDir = __dirname;

    // Navigate up to find the actual project root
    // From: /Users/.../circuit-1/.conductor/hyderabad/circuit/electron
    // To:   /Users/.../circuit-1
    // That's 5 levels up: electron -> circuit -> hyderabad -> .conductor -> circuit-1
    const projectPath = path.resolve(electronDir, '../../../..');

    console.log('[Circuit] Electron dir:', electronDir);
    console.log('[Circuit] Resolved project path:', projectPath);

    return { success: true, projectPath };
  } catch (error) {
    console.error('[Circuit] Failed to get project path:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// Workspace Context Tracking
// ============================================================================

/**
 * Start tracking context for a workspace
 */
ipcMain.handle('workspace:context-start', async (event, workspaceId, workspacePath) => {
  try {
    console.log('[Circuit] Starting context tracking for workspace:', workspaceId, workspacePath);
    const tracker = await getWorkspaceContextTrackerInstance();

    // Event listeners are set up globally in getWorkspaceContextTrackerInstance()
    // No need to add them here - this prevents memory leaks

    // Start tracking
    const context = await tracker.startTracking(workspaceId, workspacePath);

    if (!context) {
      // No context yet - we're in "waiting for session" mode
      // This is NOT an error, it's a valid state
      console.log('[Circuit] Workspace is waiting for Claude Code session to start');
      return { success: true, waiting: true, context: null };
    }

    // Context found immediately
    return { success: true, waiting: false, context };
  } catch (error) {
    console.error('[Circuit] Failed to start context tracking:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get current context for a workspace (without starting tracking)
 */
ipcMain.handle('workspace:context-get', async (event, workspaceId, workspacePath) => {
  try {
    const tracker = await getWorkspaceContextTrackerInstance();
    const context = await tracker.getContext(workspaceId, workspacePath);

    if (!context) {
      return { success: false, error: 'No active Claude Code session for this workspace' };
    }

    return { success: true, context };
  } catch (error) {
    console.error('[Circuit] Failed to get context:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Stop tracking context for a workspace
 */
ipcMain.handle('workspace:context-stop', async (event, workspaceId) => {
  try {
    const tracker = await getWorkspaceContextTrackerInstance();
    await tracker.stopTracking(workspaceId);
    return { success: true };
  } catch (error) {
    console.error('[Circuit] Failed to stop context tracking:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Search in files across workspace
 * Uses ripgrep if available, falls back to Node.js fs
 */
ipcMain.handle('workspace:search-in-files', async (event, workspacePath, query, options = {}) => {
  try {
    const {
      maxResults = 100,
      maxColumns = 200,
      contextLines = 1,
      ignoreCase = true,
    } = options;

    // Try using ripgrep first (faster)
    try {
      const rgArgs = [
        '--json',
        '--max-count', String(maxResults),
        '--max-columns', String(maxColumns),
        '--context', String(contextLines),
      ];

      if (ignoreCase) {
        rgArgs.push('--ignore-case');
      }

      rgArgs.push(query, workspacePath);

      const { stdout } = await execAsync(`rg ${rgArgs.join(' ')}`, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // Parse ripgrep JSON output
      const lines = stdout.trim().split('\n');
      const results = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'match') {
            results.push({
              path: parsed.data.path.text,
              lineNumber: parsed.data.line_number,
              lineContent: parsed.data.lines.text.trim(),
              matchStart: parsed.data.submatches[0].start,
              matchEnd: parsed.data.submatches[0].end,
            });
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }

      return {
        success: true,
        results,
        totalMatches: results.length,
        method: 'ripgrep'
      };
    } catch (rgError) {
      // Ripgrep not available or failed, use Node.js fallback
      console.log('[Search] Ripgrep unavailable, using Node.js fallback');

      const results = [];
      const { readdir, stat, readFile } = fs;

      // Recursive file search
      async function searchDirectory(dirPath) {
        if (results.length >= maxResults) return;

        const entries = await readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults) break;

          const fullPath = path.join(dirPath, entry.name);

          // Skip common ignore patterns
          if (entry.name === 'node_modules' ||
              entry.name === '.git' ||
              entry.name === 'dist' ||
              entry.name === 'build' ||
              entry.name === '.next') {
            continue;
          }

          if (entry.isDirectory()) {
            await searchDirectory(fullPath);
          } else if (entry.isFile()) {
            // Only search text files (basic check)
            const ext = path.extname(entry.name).toLowerCase();
            const textExtensions = [
              '.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go', '.rs',
              '.java', '.c', '.cpp', '.h', '.hpp', '.css', '.scss', '.html',
              '.json', '.yaml', '.yml', '.md', '.txt', '.sh', '.bash'
            ];

            if (textExtensions.includes(ext)) {
              try {
                const content = await readFile(fullPath, 'utf-8');
                const lines = content.split('\n');

                for (let i = 0; i < lines.length; i++) {
                  if (results.length >= maxResults) break;

                  const line = lines[i];
                  const searchRegex = new RegExp(
                    query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                    ignoreCase ? 'gi' : 'g'
                  );
                  const match = searchRegex.exec(line);

                  if (match) {
                    results.push({
                      path: path.relative(workspacePath, fullPath),
                      lineNumber: i + 1,
                      lineContent: line.trim(),
                      matchStart: match.index,
                      matchEnd: match.index + match[0].length,
                    });
                  }
                }
              } catch (fileError) {
                // Skip files that can't be read
                continue;
              }
            }
          }
        }
      }

      await searchDirectory(workspacePath);

      return {
        success: true,
        results,
        totalMatches: results.length,
        method: 'nodejs'
      };
    }
  } catch (error) {
    console.error('[Search] Error:', error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
});

/**
 * Search file names in workspace (for Quick Open / Cmd+P)
 * Fast file path search with fuzzy matching
 */
ipcMain.handle('workspace:search-files', async (event, workspacePath, query, options = {}) => {
  try {
    const {
      maxResults = 50,
      fuzzy = true,
    } = options;

    const results = [];
    const { readdir, stat } = fs;

    // Recursively collect all files
    async function collectFiles(dirPath, relativePath = '') {
      if (results.length >= maxResults * 10) return; // Collect more than needed for fuzzy ranking

      try {
        const entries = await readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relPath = path.join(relativePath, entry.name);

          // Skip common ignore patterns
          if (entry.name === 'node_modules' ||
              entry.name === '.git' ||
              entry.name === 'dist' ||
              entry.name === 'dist-electron' ||
              entry.name === 'build' ||
              entry.name === '.next' ||
              entry.name === '.conductor' ||
              entry.name === 'coverage' ||
              entry.name === '.cache') {
            continue;
          }

          if (entry.isDirectory()) {
            await collectFiles(fullPath, relPath);
          } else if (entry.isFile()) {
            results.push({
              path: relPath,
              fullPath: fullPath,
              name: entry.name,
              dir: relativePath
            });
          }
        }
      } catch (error) {
        // Skip directories we can't read
        console.warn('[Search Files] Cannot read directory:', dirPath, error.message);
      }
    }

    // Collect all files
    await collectFiles(workspacePath);

    // If no query, return most recent files (TODO: add recent files tracking)
    if (!query || query.trim() === '') {
      return {
        success: true,
        files: results.slice(0, maxResults),
        totalFiles: results.length,
      };
    }

    // Fuzzy search using simple scoring
    // We'll use a basic implementation here since we want to avoid adding dependencies
    const scored = results.map(file => {
      const score = calculateFuzzyScore(file.path, query);
      return { ...file, score };
    }).filter(file => file.score > 0);

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    return {
      success: true,
      files: scored.slice(0, maxResults).map(f => ({
        path: f.path,
        fullPath: f.fullPath,
        name: f.name,
        dir: f.dir,
        score: f.score
      })),
      totalFiles: scored.length,
    };
  } catch (error) {
    console.error('[Search Files] Error:', error);
    return {
      success: false,
      error: error.message,
      files: []
    };
  }
});

/**
 * Simple fuzzy matching scorer
 * Returns score > 0 if match found, 0 otherwise
 * Higher score = better match
 */
function calculateFuzzyScore(text, query) {
  text = text.toLowerCase();
  query = query.toLowerCase();

  // Exact match gets highest score
  if (text === query) return 1000;
  if (text.includes(query)) return 500;

  // Fuzzy matching: all characters must appear in order
  let textIndex = 0;
  let queryIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;

  while (textIndex < text.length && queryIndex < query.length) {
    if (text[textIndex] === query[queryIndex]) {
      queryIndex++;
      consecutiveMatches++;
      // Bonus for consecutive matches
      score += 10 + (consecutiveMatches * 2);
    } else {
      consecutiveMatches = 0;
      // Penalty for gaps
      score -= 1;
    }
    textIndex++;
  }

  // If we didn't match all query characters, no match
  if (queryIndex < query.length) return 0;

  // Bonus for matching file name vs full path
  const fileName = text.split('/').pop() || '';
  if (fileName.includes(query)) {
    score += 100;
  }

  // Bonus for shorter paths (prefer files closer to root)
  const pathDepth = text.split('/').length;
  score -= pathDepth * 2;

  return Math.max(score, 1); // Minimum score of 1 if matched
}

/**
 * Get TypeScript diagnostics for workspace
 * Returns all TypeScript errors and warnings
 */
ipcMain.handle('typescript:get-diagnostics', async (event, workspacePath) => {
  try {
    const ts = require('typescript');
    const fsSync = require('fs');

    // Find tsconfig.json
    const configPath = path.join(workspacePath, 'tsconfig.json');

    let parsedConfig;
    let hasTsConfig = false;

    // Check if tsconfig exists
    try {
      await fs.access(configPath);
      hasTsConfig = true;
    } catch {
      // tsconfig.json not found - use fallback
      hasTsConfig = false;
    }

    if (hasTsConfig) {
      // Read and parse tsconfig
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

      if (configFile.error) {
        return {
          success: false,
          error: `Failed to read tsconfig.json: ${configFile.error.messageText}`,
          diagnostics: [],
          totalErrors: 0,
          totalWarnings: 0,
        };
      }

      parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        workspacePath
      );
    } else {
      // Fallback: scan for TypeScript and JavaScript files
      const fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];
      const filesToCheck = [];

      // Recursively find files
      function findFiles(dir) {
        try {
          const entries = fsSync.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            // Skip common ignore patterns
            if (entry.name === 'node_modules' ||
                entry.name === '.git' ||
                entry.name === 'dist' ||
                entry.name === 'dist-electron' ||
                entry.name === 'build' ||
                entry.name === '.next' ||
                entry.name === '.conductor' ||
                entry.name === 'coverage') {
              continue;
            }

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
              findFiles(fullPath);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name);
              if (fileExtensions.includes(ext)) {
                filesToCheck.push(fullPath);
              }
            }
          }
        } catch (error) {
          // Skip directories we can't read
        }
      }

      findFiles(workspacePath);

      // Create default config
      parsedConfig = {
        fileNames: filesToCheck,
        options: {
          allowJs: true,
          checkJs: false, // Don't check JS files by default
          jsx: ts.JsxEmit.React,
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          skipLibCheck: true,
          noEmit: true,
        },
      };
    }

    // Create TypeScript program
    const program = ts.createProgram({
      rootNames: parsedConfig.fileNames,
      options: parsedConfig.options,
    });

    const diagnostics = [];

    // Get all diagnostics
    const allDiagnostics = [
      ...program.getSemanticDiagnostics(),
      ...program.getSyntacticDiagnostics(),
      ...program.getDeclarationDiagnostics(),
    ];

    // Process diagnostics
    for (const diagnostic of allDiagnostics) {
      if (diagnostic.file) {
        // Skip node_modules
        if (diagnostic.file.fileName.includes('node_modules')) {
          continue;
        }

        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start || 0
        );

        // Determine severity
        let severity = 'error';
        if (diagnostic.category === ts.DiagnosticCategory.Warning) {
          severity = 'warning';
        } else if (diagnostic.category === ts.DiagnosticCategory.Message) {
          severity = 'info';
        } else if (diagnostic.category === ts.DiagnosticCategory.Suggestion) {
          severity = 'hint';
        }

        diagnostics.push({
          severity,
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          file: path.relative(workspacePath, diagnostic.file.fileName),
          line: line + 1,
          character: character + 1,
          code: diagnostic.code,
        });
      }
    }

    const totalErrors = diagnostics.filter(d => d.severity === 'error').length;
    const totalWarnings = diagnostics.filter(d => d.severity === 'warning').length;

    return {
      success: true,
      diagnostics,
      totalErrors,
      totalWarnings,
    };
  } catch (error) {
    console.error('[TypeScript] Diagnostics error:', error);
    return {
      success: false,
      error: error.message,
      diagnostics: [],
      totalErrors: 0,
      totalWarnings: 0,
    };
  }
});

/**
 * Get TypeScript outline/symbols for a file
 * Returns structure of functions, classes, interfaces, etc.
 */
ipcMain.handle('typescript:get-outline', async (event, filePath) => {
  try {
    const ts = require('typescript');
    const fsSync = require('fs');

    // Read file
    const sourceCode = fsSync.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      path.basename(filePath),
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const symbols = [];

    // Recursively visit AST nodes
    function visit(node, parent = null) {
      let symbol = null;

      // Function Declaration
      if (ts.isFunctionDeclaration(node) && node.name) {
        symbol = {
          name: node.name.text,
          kind: 'function',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Arrow Function with variable
      else if (ts.isVariableDeclaration(node) && node.initializer &&
               (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
               ts.isIdentifier(node.name)) {
        symbol = {
          name: node.name.text,
          kind: 'function',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Class Declaration
      else if (ts.isClassDeclaration(node) && node.name) {
        symbol = {
          name: node.name.text,
          kind: 'class',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Interface Declaration
      else if (ts.isInterfaceDeclaration(node)) {
        symbol = {
          name: node.name.text,
          kind: 'interface',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Type Alias
      else if (ts.isTypeAliasDeclaration(node)) {
        symbol = {
          name: node.name.text,
          kind: 'type',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Method Declaration
      else if (ts.isMethodDeclaration(node) && node.name) {
        const name = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sourceFile);
        symbol = {
          name,
          kind: 'method',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Property Declaration
      else if (ts.isPropertyDeclaration(node) && node.name) {
        const name = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sourceFile);
        symbol = {
          name,
          kind: 'property',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Enum Declaration
      else if (ts.isEnumDeclaration(node)) {
        symbol = {
          name: node.name.text,
          kind: 'enum',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }

      if (symbol) {
        if (parent) {
          parent.children.push(symbol);
        } else {
          symbols.push(symbol);
        }

        // Visit children with this symbol as parent
        ts.forEachChild(node, child => visit(child, symbol));
      } else {
        // Continue visiting children
        ts.forEachChild(node, child => visit(child, parent));
      }
    }

    visit(sourceFile);

    return {
      success: true,
      symbols,
    };
  } catch (error) {
    console.error('[TypeScript] Outline error:', error);
    return {
      success: false,
      error: error.message,
      symbols: [],
    };
  }
});

// ============================================================================
// Circuit Test-Fix Loop - Phase 2
// ============================================================================

/**
 * Read MCP config from local apps (Claude Desktop, Cursor, Windsurf, etc.)
 */
ipcMain.handle('circuit:read-mcp-config', async (event, configPath) => {
  try {
    // Expand ~ to home directory
    const expandedPath = configPath.replace(/^~/, os.homedir());

    // Check if file exists
    try {
      await fs.access(expandedPath);
    } catch {
      return {
        success: false,
        error: 'Config file not found'
      };
    }

    // Read and parse config
    const configContent = await fs.readFile(expandedPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Extract MCP servers from different config formats
    let servers = [];

    // Format 1: { "mcpServers": { "id": { ... } } }
    if (config.mcpServers && typeof config.mcpServers === 'object') {
      servers = Object.entries(config.mcpServers).map(([id, serverConfig]) => ({
        id,
        name: serverConfig.name || id,
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env || {}
      }));
    }
    // Format 2: { "servers": { "id": { ... } } }
    else if (config.servers && typeof config.servers === 'object') {
      servers = Object.entries(config.servers).map(([id, serverConfig]) => ({
        id,
        name: serverConfig.name || id,
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env || {}
      }));
    }
    // Format 3: { "mcp": { "servers": { ... } } }
    else if (config.mcp?.servers && typeof config.mcp.servers === 'object') {
      servers = Object.entries(config.mcp.servers).map(([id, serverConfig]) => ({
        id,
        name: serverConfig.name || id,
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env || {}
      }));
    }

    return {
      success: true,
      servers,
      raw: config
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Phase 2: Detect project type from package.json
 */
ipcMain.handle('circuit:detect-project', async (event, projectPath) => {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    return {
      success: true,
      packageJson
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Phase 2: Initialize with detected strategy
 */
ipcMain.handle('circuit:init', async (event, projectPath, strategy = 'react') => {
  try {
    // 1. Create .circuit/ directory structure
    const circuitDir = path.join(projectPath, '.circuit');
    const strategiesDir = path.join(circuitDir, 'strategies');
    const hooksDir = path.join(circuitDir, 'hooks');
    const mcpsDir = path.join(circuitDir, 'mcps');
    const historyDir = path.join(circuitDir, 'history');

    await fs.mkdir(circuitDir, { recursive: true });
    await fs.mkdir(strategiesDir, { recursive: true });
    await fs.mkdir(hooksDir, { recursive: true });
    await fs.mkdir(mcpsDir, { recursive: true });
    await fs.mkdir(historyDir, { recursive: true });

    // 2. Copy template (use detected strategy)
    const templateFilename = `${strategy}.md`;
    const templatePath = path.join(__dirname, '../templates', templateFilename);
    const strategyPath = path.join(strategiesDir, templateFilename);

    const templateContent = await fs.readFile(templatePath, 'utf-8');
    await fs.writeFile(strategyPath, templateContent);

    // 3. Create circuit.config.md
    const configContent = `# Circuit Configuration

## Project Info
- Strategy: ${strategy}
- Auto-detected: true
- Initialized: ${new Date().toISOString()}

## Settings
- Auto mode: true
- Notifications: true
- Max iterations: 5

---
_Generated by Circuit Test-Fix Loop_
`;

    const configPath = path.join(circuitDir, 'circuit.config.md');
    await fs.writeFile(configPath, configContent);

    return {
      success: true,
      message: 'Circuit initialized successfully!',
      circuitDir
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// ============================================================================
// Circuit Test-Fix Loop - Phase 3: File Change Detection
// ============================================================================

// Store active watchers (projectPath -> watcher instance)
const activeWatchers = new Map();

/**
 * Phase 3: Start watching files in project directory
 */
ipcMain.handle('circuit:watch-start', async (event, projectPath) => {
  try {
    // Stop existing watcher if any
    if (activeWatchers.has(projectPath)) {
      const oldWatcher = activeWatchers.get(projectPath);
      await oldWatcher.close();
    }

    // Extensions to watch
    const watchedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

    // Ignored patterns
    const ignored = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.circuit/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.vite/**',
      '**/*.log',
    ];

    // Create watcher
    const watcher = chokidar.watch(projectPath, {
      ignored,
      persistent: true,
      ignoreInitial: true, // Don't emit events for existing files
    });

    // File change handler
    const handleChange = (type, filePath) => {
      // Filter by extension
      const hasValidExtension = watchedExtensions.some(ext => filePath.endsWith(ext));
      if (!hasValidExtension) return;

      const changeEvent = {
        type,
        path: filePath,
        timestamp: Date.now()
      };

      // Send to renderer
      event.sender.send('circuit:file-changed', changeEvent);
    };

    watcher
      .on('add', (filePath) => handleChange('add', filePath))
      .on('change', (filePath) => handleChange('change', filePath))
      .on('unlink', (filePath) => handleChange('unlink', filePath));

    // Store watcher
    activeWatchers.set(projectPath, watcher);

    return {
      success: true,
      message: 'File watcher started'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Phase 3: Stop watching files
 */
ipcMain.handle('circuit:watch-stop', async (event, projectPath) => {
  try {
    if (activeWatchers.has(projectPath)) {
      const watcher = activeWatchers.get(projectPath);
      await watcher.close();
      activeWatchers.delete(projectPath);
    }

    return {
      success: true,
      message: 'File watcher stopped'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// ============================================================================
// Circuit Test-Fix Loop - Phase 4: Test Execution
// ============================================================================

/**
 * Phase 4: Run tests in project directory
 */
ipcMain.handle('circuit:run-test', async (event, projectPath) => {
  try {
    const startTime = Date.now();

    return new Promise((resolve) => {
      // Run npm test
      const testProcess = spawn('npm', ['test'], {
        cwd: projectPath,
        shell: true,
        env: { ...process.env, CI: 'true' } // Prevent interactive mode
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
      });

      testProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
      });

      testProcess.on('close', (code) => {
        const duration = Date.now() - startTime;

        // Parse output
        const output = stdout + '\n' + stderr;

        // Simple parsing (Jest/Vitest format)
        let passed = 0;
        let failed = 0;
        let total = 0;

        // Jest/Vitest: "Tests: 1 failed, 2 passed, 3 total"
        const testSummaryMatch = output.match(/Tests?:\s+(?:(\d+)\s+failed?,?\s*)?(?:(\d+)\s+passed?,?\s*)?(\d+)\s+total/i);
        if (testSummaryMatch) {
          failed = parseInt(testSummaryMatch[1] || '0');
          passed = parseInt(testSummaryMatch[2] || '0');
          total = parseInt(testSummaryMatch[3] || '0');
        }

        // Extract error lines
        const errorLines = output.split('\n').filter(line =>
          line.includes('FAIL') ||
          line.includes('Error:') ||
          line.includes('Expected') ||
          line.includes('Received')
        );

        const result = {
          success: code === 0,
          passed,
          failed,
          total,
          duration,
          output: output.slice(0, 10000), // Limit to 10KB
          errors: errorLines.slice(0, 10) // First 10 errors
        };

        resolve(result);
      });

      testProcess.on('error', (error) => {
        const result = {
          success: false,
          passed: 0,
          failed: 0,
          total: 0,
          duration: Date.now() - startTime,
          output: '',
          errors: [error.message]
        };

        resolve(result);
      });
    });
  } catch (error) {
    const result = {
      success: false,
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0,
      output: '',
      errors: [error.message]
    };

    return result;
  }
});

// ============================================================================
// Circuit Test-Fix Loop - Phase 5: Claude CLI Integration (Conductor-style)
// ============================================================================

const CLAUDE_CLI_PATH = path.join(os.homedir(), '.claude/local/claude');

/**
 * Phase 5: Get AI fix suggestion using Claude CLI (no API key needed!)
 */
ipcMain.handle('circuit:get-ai-fix', async (event, fixRequest) => {
  try {
    // 1. Check if Claude CLI exists
    try {
      await fs.access(CLAUDE_CLI_PATH);
    } catch (error) {
      return {
        success: false,
        error: 'Claude Code CLI not found. Please install Claude Code first.\n\nExpected location: ~/.claude/local/claude'
      };
    }

    // 2. Build prompt
    const { testError, testCode, sourceCode, projectType, testFilePath } = fixRequest;

    const prompt = `You are helping fix a failing test in a ${projectType} project.

**Test Error:**
\`\`\`
${testError}
\`\`\`

${testCode ? `**Test Code (${testFilePath || 'test file'}):**
\`\`\`javascript
${testCode}
\`\`\`
` : ''}

${sourceCode ? `**Source Code:**
\`\`\`javascript
${sourceCode}
\`\`\`
` : ''}

Please analyze the error and suggest a fix.

**Response Format:**
Provide your response in this EXACT format:

## Root Cause
[Brief explanation of what's causing the test to fail]

## Fixed Code
\`\`\`javascript
[Complete fixed version of the test file]
\`\`\`

## Explanation
[Brief explanation of why this fix works]

IMPORTANT: In the "Fixed Code" section, provide the COMPLETE corrected file content, not just the changed lines.`;

    // 3. Prepare Claude CLI subprocess
    const claude = spawn(CLAUDE_CLI_PATH, [
      '--print',
      '--output-format', 'json',
      '--model', 'sonnet'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 4. Send prompt to stdin
    const input = JSON.stringify({
      role: 'user',
      content: prompt
    });

    claude.stdin.write(input);
    claude.stdin.end();

    // 5. Collect stdout and stderr
    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // 6. Wait for process to complete
    return new Promise((resolve) => {
      claude.on('close', (code) => {
        if (code !== 0) {
          return resolve({
            success: false,
            error: `Claude CLI failed with code ${code}:\n${stderr}`
          });
        }

        try {
          // Parse JSON response
          const response = JSON.parse(stdout);

          if (response.type === 'result' && response.subtype === 'success') {
            return resolve({
              success: true,
              fix: response.result,
              cost_usd: response.total_cost_usd,
              session_id: response.session_id
            });
          } else {
            return resolve({
              success: false,
              error: 'Unexpected response from Claude CLI'
            });
          }
        } catch (parseError) {
          return resolve({
            success: false,
            error: `Failed to parse Claude CLI response: ${parseError.message}`
          });
        }
      });

      claude.on('error', (error) => {
        return resolve({
          success: false,
          error: `Failed to spawn Claude CLI: ${error.message}`
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// ============================================================================
// Circuit Test-Fix Loop - Phase 6: Apply AI Fix
// ============================================================================

/**
 * Phase 6: Apply AI-suggested fix to file
 */
ipcMain.handle('circuit:apply-fix', async (event, applyRequest) => {
  try {
    const { filePath, fixedCode } = applyRequest;

    // 1. Verify file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return {
        success: false,
        error: `File not found: ${filePath}`
      };
    }

    // 2. Create backup (optional but recommended)
    const backupPath = `${filePath}.backup`;
    try {
      const originalContent = await fs.readFile(filePath, 'utf-8');
      await fs.writeFile(backupPath, originalContent, 'utf-8');
    } catch (backupError) {
      // Continue anyway - backup is optional
    }

    // 3. Write fixed code to file
    await fs.writeFile(filePath, fixedCode, 'utf-8');

    return {
      success: true,
      message: 'Fix applied successfully',
      backupPath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// ============================================================================
// MCP Runtime Manager - New Architecture
// ============================================================================

/**
 * Install a new MCP server
 */
ipcMain.handle('circuit:mcp-install', async (event, packageId, config) => {
  console.log('[IPC] circuit:mcp-install called with:', packageId, config);
  try {
    console.log('[IPC] Getting MCP Manager instance...');
    const manager = await getMCPManagerInstance();
    console.log('[IPC] MCP Manager obtained, calling install...');
    const serverId = await manager.install(packageId, config);
    console.log('[IPC] Install completed successfully, serverId:', serverId);
    return { success: true, serverId };
  } catch (error) {
    console.error('[IPC] MCP install error:', error);
    console.error('[IPC] Error stack:', error.stack);
    return { success: false, error: error.message };
  }
});
console.log('[main.cjs] circuit:mcp-install handler registered');

/**
 * Uninstall an MCP server
 */
ipcMain.handle('circuit:mcp-uninstall', async (event, serverId) => {
  try {
    const manager = await getMCPManagerInstance();
    await manager.uninstall(serverId);
    return { success: true };
  } catch (error) {
    console.error('MCP uninstall error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Start an MCP server
 */
ipcMain.handle('circuit:mcp-start', async (event, serverId) => {
  try {
    const manager = await getMCPManagerInstance();
    await manager.start(serverId);
    return { success: true };
  } catch (error) {
    console.error('MCP start error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Stop an MCP server
 */
ipcMain.handle('circuit:mcp-stop', async (event, serverId) => {
  try {
    const manager = await getMCPManagerInstance();
    await manager.stop(serverId);
    return { success: true };
  } catch (error) {
    console.error('MCP stop error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Restart an MCP server
 */
ipcMain.handle('circuit:mcp-restart', async (event, serverId) => {
  try {
    const manager = await getMCPManagerInstance();
    await manager.restart(serverId);
    return { success: true };
  } catch (error) {
    console.error('MCP restart error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * List tools from a server
 */
ipcMain.handle('circuit:mcp-list-tools', async (event, serverId) => {
  try {
    const manager = await getMCPManagerInstance();
    const tools = await manager.listTools(serverId);
    return { success: true, tools };
  } catch (error) {
    console.error('MCP list tools error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Call a tool
 */
ipcMain.handle('circuit:mcp-call-tool', async (event, serverId, toolName, args) => {
  try {
    const manager = await getMCPManagerInstance();
    const result = await manager.callTool(serverId, toolName, args);
    return { success: true, result };
  } catch (error) {
    console.error('MCP call tool error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get status of a specific server
 */
ipcMain.handle('circuit:mcp-get-status', async (event, serverId) => {
  try {
    const manager = await getMCPManagerInstance();
    const status = await manager.getStatus(serverId);
    return { success: true, status };
  } catch (error) {
    console.error('MCP get status error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get status of all servers
 */
ipcMain.handle('circuit:mcp-get-all-status', async (event) => {
  try {
    const manager = await getMCPManagerInstance();
    const statuses = await manager.getAllStatuses();
    return { success: true, statuses };
  } catch (error) {
    console.error('MCP get all status error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get logs for a server
 */
ipcMain.handle('circuit:mcp-get-logs', async (event, serverId, lines = 100) => {
  try {
    const manager = await getMCPManagerInstance();
    const logs = await manager.getLogs(serverId, lines);
    return { success: true, logs };
  } catch (error) {
    console.error('MCP get logs error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('circuit:reload-claude-code', async (event, openVSCode = true) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    // Try to reload VS Code using the 'code' CLI
    try {
      await execPromise('code --command workbench.action.reloadWindow');
      console.log('[Circuit] Claude Code reload command sent');
      return { success: true };
    } catch (cliError) {
      // If 'code' CLI is not available, try AppleScript
      console.log('[Circuit] Code CLI not available, trying AppleScript...');

      if (openVSCode) {
        // Option 1: Activate VS Code and reload
        const script = `
          tell application "Visual Studio Code"
            activate
          end tell
          delay 0.5
          tell application "System Events"
            tell process "Code"
              keystroke "r" using {command down, shift down}
            end tell
          end tell
          return "success"
        `;

        try {
          await execPromise(`osascript -e '${script}'`);
          console.log('[Circuit] VS Code activated and reloaded via AppleScript');
          return { success: true };
        } catch (err) {
          console.error('[Circuit] AppleScript failed:', err);
          return { success: false, error: 'Failed to activate VS Code' };
        }
      } else {
        // Option 2: Reload only if VS Code is already running
        const script = `
          tell application "System Events"
            if exists (process "Code") then
              tell process "Code"
                keystroke "r" using {command down, shift down}
              end tell
              return "success"
            else
              return "Code not running"
            end if
          end tell
        `;

        const { stdout } = await execPromise(`osascript -e '${script}'`);
        if (stdout.trim() === 'success') {
          console.log('[Circuit] Claude Code reload via AppleScript (no activation)');
          return { success: true };
        } else {
          return { success: false, error: 'VS Code is not running' };
        }
      }
    }
  } catch (error) {
    console.error('[Circuit] Failed to reload Claude Code:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// MCP Call History
// ============================================================================

// Register history IPC handlers
(async () => {
  try {
    const { registerHistoryHandlers } = await import('../dist-electron/historyHandlers.js');
    registerHistoryHandlers();
    console.log('[main.cjs] History handlers registered');
  } catch (error) {
    console.error('[main.cjs] Failed to register history handlers:', error);
  }
})();

// ============================================================================
// Project Memory
// ============================================================================

// Register memory IPC handlers
(async () => {
  try {
    const { registerMemoryHandlers } = await import('../dist-electron/memoryHandlers.js');
    registerMemoryHandlers();
    console.log('[main.cjs] Memory handlers registered');
  } catch (error) {
    console.error('[main.cjs] Failed to register memory handlers:', error);
  }
})();

// ============================================================================
// Repository Management
// ============================================================================

// Register repository IPC handlers and auto-register project path
(async () => {
  try {
    const { registerRepositoryHandlers, autoRegisterProjectPath } = await import('../dist-electron/repositoryHandlers.js');
    registerRepositoryHandlers();
    console.log('[main.cjs] Repository handlers registered');

    // Auto-register the project path as a repository
    const projectPath = path.resolve(__dirname, '../../../..');
    await autoRegisterProjectPath(projectPath);
    console.log('[main.cjs] Project path auto-registered');
  } catch (error) {
    console.error('[main.cjs] Failed to register repository handlers:', error);
  }
})();

// ============================================================================
// Git Handlers
// ============================================================================

// Register git IPC handlers
(async () => {
  try {
    const { registerGitHandlers } = await import('../dist-electron/gitHandlers.js');
    registerGitHandlers();
    console.log('[main.cjs] Git handlers registered');
  } catch (error) {
    console.error('[main.cjs] Failed to register git handlers:', error);
  }
})();

// Register Monaco/Language Server handlers
(async () => {
  try {
    const { registerMonacoHandlers } = await import('../dist-electron/monacoHandlers.js');
    registerMonacoHandlers();
    console.log('[main.cjs] Monaco handlers registered');
  } catch (error) {
    console.error('[main.cjs] Failed to register monaco handlers:', error);
  }
})();

// Register LSP handlers
(async () => {
  try {
    const { registerLSPHandlers } = await import('../dist-electron/lspHandlers.js');
    registerLSPHandlers();
    console.log('[main.cjs] LSP handlers registered');
  } catch (error) {
    console.error('[main.cjs] Failed to register LSP handlers:', error);
  }
})();

// Register compact handlers
(async () => {
  try {
    const { registerCompactHandlers } = await import('../dist-electron/compactHandlers.js');
    registerCompactHandlers();
    console.log('[main.cjs] Compact handlers registered');
  } catch (error) {
    console.error('[main.cjs] Failed to register compact handlers:', error);
  }
})();

// Cleanup on app quit
app.on('before-quit', async () => {
  try {
    // Stop API server
    const apiServer = await getAPIServerInstance();
    await apiServer.stop();
    console.log('Circuit API Server stopped');

    // Cleanup MCP manager
    const manager = await getMCPManagerInstance();
    await manager.cleanup();

    // Cleanup terminal sessions
    if (terminalManagerPromise) {
      const terminalManager = await getTerminalManagerInstance();
      terminalManager.destroyAllSessions();
      console.log('Terminal sessions destroyed');
    }

    // Cleanup LSP clients
    try {
      const { cleanupLSPHandlers } = await import('../dist-electron/lspHandlers.js');
      await cleanupLSPHandlers();
      console.log('LSP clients stopped');
    } catch (error) {
      console.error('LSP cleanup error:', error);
    }

    // Cleanup compact handlers
    try {
      const { cleanupCompactHandlers } = await import('../dist-electron/compactHandlers.js');
      await cleanupCompactHandlers();
      console.log('Compact handlers stopped');
    } catch (error) {
      console.error('Compact cleanup error:', error);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
});

// MCP/API initialization is now handled in the main app.whenReady() block above

// ============================================================================
// Git Worktree - Workspace Management
// ============================================================================

// Animal names for workspace naming
const ANIMALS = [
  'aardvark', 'albatross', 'alligator', 'alpaca', 'ant', 'anteater', 'antelope', 'armadillo',
  'baboon', 'badger', 'barracuda', 'bat', 'bear', 'beaver', 'bee', 'bison', 'boar', 'buffalo',
  'camel', 'capybara', 'caribou', 'cassowary', 'cat', 'caterpillar', 'cheetah', 'chicken', 'chimpanzee', 'chinchilla', 'chipmunk', 'cobra', 'cod', 'coyote', 'crab', 'crane', 'crocodile', 'crow',
  'deer', 'dingo', 'dog', 'dolphin', 'donkey', 'dove', 'dragonfly', 'duck', 'dugong',
  'eagle', 'echidna', 'eel', 'elephant', 'elk', 'emu', 'ermine',
  'falcon', 'ferret', 'finch', 'fish', 'flamingo', 'fox', 'frog',
  'gazelle', 'gecko', 'gerbil', 'giraffe', 'gnu', 'goat', 'goldfish', 'goose', 'gorilla', 'grasshopper', 'grizzly', 'gull',
  'hamster', 'hare', 'hawk', 'hedgehog', 'heron', 'hippo', 'hornet', 'horse', 'hummingbird', 'hyena',
  'ibex', 'ibis', 'iguana', 'impala',
  'jackal', 'jaguar', 'jay', 'jellyfish',
  'kangaroo', 'koala', 'kookaburra', 'krill',
  'ladybug', 'lemur', 'leopard', 'lion', 'lizard', 'llama', 'lobster', 'locust', 'lynx',
  'macaw', 'magpie', 'mallard', 'manatee', 'mandrill', 'mantis', 'meerkat', 'mink', 'mole', 'mongoose', 'monkey', 'moose', 'mosquito', 'moth', 'mouse', 'mule',
  'narwhal', 'newt', 'nightingale',
  'octopus', 'okapi', 'opossum', 'orangutan', 'orca', 'ostrich', 'otter', 'owl', 'ox', 'oyster',
  'panda', 'panther', 'parrot', 'peacock', 'pelican', 'penguin', 'pheasant', 'pig', 'pigeon', 'platypus', 'pony', 'porcupine', 'possum', 'prairie-dog', 'puffin', 'puma', 'python',
  'quail', 'quokka',
  'rabbit', 'raccoon', 'ram', 'rat', 'raven', 'reindeer', 'rhino', 'robin', 'rooster',
  'salamander', 'salmon', 'sandpiper', 'sardine', 'scorpion', 'seahorse', 'seal', 'shark', 'sheep', 'shrew', 'shrimp', 'skunk', 'sloth', 'snail', 'snake', 'sparrow', 'spider', 'squid', 'squirrel', 'starfish', 'stingray', 'stork', 'swallow', 'swan',
  'tapir', 'tarsier', 'tiger', 'toad', 'tortoise', 'toucan', 'trout', 'tuna', 'turkey', 'turtle',
  'viper', 'vulture',
  'wallaby', 'walrus', 'wasp', 'weasel', 'whale', 'wildcat', 'wolf', 'wolverine', 'wombat', 'woodpecker', 'worm',
  'yak',
  'zebra'
];

function getAvailableAnimalName(usedNames = []) {
  const availableAnimals = ANIMALS.filter(animal => !usedNames.includes(animal));

  if (availableAnimals.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableAnimals.length);
    return availableAnimals[randomIndex];
  }

  // If all animal names are used, add a numeric suffix
  let suffix = 2;
  while (true) {
    const randomAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const nameWithSuffix = `${randomAnimal}-${suffix}`;

    if (!usedNames.includes(nameWithSuffix)) {
      return nameWithSuffix;
    }

    suffix++;

    if (suffix > 1000) {
      return `workspace-${Date.now()}`;
    }
  }
}

/**
 * Get all existing branch names in the repository
 */
async function getExistingBranches(projectPath) {
  try {
    const { stdout } = await execAsync('git branch --all --format="%(refname:short)"', {
      cwd: projectPath
    });

    return stdout
      .split('\n')
      .map(b => b.trim())
      .filter(Boolean)
      .map(b => b.replace(/^origin\//, '')); // Remove 'origin/' prefix
  } catch (error) {
    console.error('[Workspace] Failed to get branches:', error);
    return [];
  }
}

/**
 * Generate a unique workspace name using animal names
 */
async function generateWorkspaceName(projectPath) {
  const existingBranches = await getExistingBranches(projectPath);
  return getAvailableAnimalName(existingBranches);
}

/**
 * Get workspace metadata (archived status, etc.)
 */
async function getWorkspaceMetadata(projectPath) {
  try {
    const metadataPath = path.join(projectPath, '.conductor', 'workspace-metadata.json');
    const data = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty metadata
    return {};
  }
}

/**
 * Save workspace metadata
 */
async function saveWorkspaceMetadata(projectPath, metadata) {
  try {
    const conductorDir = path.join(projectPath, '.conductor');
    await fs.mkdir(conductorDir, { recursive: true });

    const metadataPath = path.join(conductorDir, 'workspace-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[Workspace] Failed to save metadata:', error);
    throw error;
  }
}

/**
 * Create a new Git worktree workspace
 */
async function createWorktree(projectPath, branchName) {
  try {
    const workspacesDir = path.join(projectPath, '.conductor', 'workspaces');
    await fs.mkdir(workspacesDir, { recursive: true });

    const worktreePath = path.join(workspacesDir, branchName);

    // Check if worktree already exists
    try {
      await fs.access(worktreePath);
      throw new Error(`Workspace ${branchName} already exists`);
    } catch (err) {
      // Good - it doesn't exist
    }

    // Ensure main branch is up-to-date before creating new workspace
    console.log('[Workspace] Updating main branch...');
    try {
      // Fetch latest changes
      await execAsync('git fetch origin', { cwd: projectPath });

      // Update main branch (without checking it out)
      await execAsync('git fetch origin main:main', { cwd: projectPath });
      console.log('[Workspace] ✓ Main branch updated');
    } catch (error) {
      console.warn('[Workspace] Warning: Could not update main branch:', error.message);
      // Continue anyway - better to create workspace with potentially old main than fail
    }

    // Create new worktree from main branch
    await execAsync(`git worktree add -b ${branchName} "${worktreePath}" main`, {
      cwd: projectPath
    });

    // Initialize metadata with archived: false
    const metadata = await getWorkspaceMetadata(projectPath);
    metadata[branchName] = {
      archived: false,
      archivedAt: null
    };
    await saveWorkspaceMetadata(projectPath, metadata);

    return {
      id: branchName,
      name: branchName,
      branch: branchName,
      path: worktreePath,
      createdAt: new Date().toISOString(),
      isActive: false,
      archived: false
    };
  } catch (error) {
    throw new Error(`Failed to create workspace: ${error.message}`);
  }
}

/**
 * List all Git worktrees
 */
async function listWorktrees(projectPath) {
  try {
    const { stdout } = await execAsync('git worktree list --porcelain', {
      cwd: projectPath
    });

    const worktrees = [];
    const lines = stdout.split('\n');
    let current = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current);
        }
        current = { path: line.substring(9) };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        const branchRef = line.substring(7);
        current.branch = branchRef.replace('refs/heads/', '');
      } else if (line === '') {
        if (current.path) {
          worktrees.push(current);
          current = {};
        }
      }
    }

    // Load metadata
    const metadata = await getWorkspaceMetadata(projectPath);

    // Transform to our workspace format
    const workspacePromises = worktrees
      .filter(wt => wt.path.includes('.conductor/workspaces'))
      .map(async wt => {
        // Get directory creation time as fallback for createdAt
        let createdAt = new Date().toISOString();
        try {
          const stats = await fs.stat(wt.path);
          createdAt = stats.birthtime.toISOString();
        } catch (err) {
          console.warn('[Workspace] Could not get creation time for', wt.path);
        }

        const workspaceId = wt.branch || path.basename(wt.path);
        const workspaceMeta = metadata[workspaceId] || { archived: false };

        return {
          id: workspaceId,
          name: workspaceId,
          branch: wt.branch || 'detached',
          path: wt.path,
          createdAt,
          isActive: false, // Will be determined by current workspace
          archived: workspaceMeta.archived || false,
          archivedAt: workspaceMeta.archivedAt || undefined
        };
      });

    return await Promise.all(workspacePromises);
  } catch (error) {
    console.error('[Workspace] Failed to list worktrees:', error);
    return [];
  }
}

/**
 * Delete a Git worktree
 */
async function deleteWorktree(projectPath, branchName) {
  try {
    const worktreePath = path.join(projectPath, '.conductor', 'workspaces', branchName);

    // Remove worktree
    await execAsync(`git worktree remove "${worktreePath}" --force`, {
      cwd: projectPath
    });

    // Delete branch
    try {
      await execAsync(`git branch -D ${branchName}`, {
        cwd: projectPath
      });
    } catch (branchError) {
      console.warn('[Workspace] Failed to delete branch (may not exist):', branchError.message);
    }

    // Remove from metadata
    const metadata = await getWorkspaceMetadata(projectPath);
    if (metadata[branchName]) {
      delete metadata[branchName];
      await saveWorkspaceMetadata(projectPath, metadata);
    }

    return true;
  } catch (error) {
    throw new Error(`Failed to delete workspace: ${error.message}`);
  }
}

/**
 * Archive a workspace
 */
async function archiveWorkspace(projectPath, workspaceId) {
  try {
    const metadata = await getWorkspaceMetadata(projectPath);

    if (!metadata[workspaceId]) {
      metadata[workspaceId] = {};
    }

    metadata[workspaceId].archived = true;
    metadata[workspaceId].archivedAt = new Date().toISOString();

    await saveWorkspaceMetadata(projectPath, metadata);
    return true;
  } catch (error) {
    console.error('[Archive] Error:', error);
    throw new Error(`Failed to archive workspace: ${error.message}`);
  }
}

/**
 * Unarchive a workspace
 */
async function unarchiveWorkspace(projectPath, workspaceId) {
  try {
    const metadata = await getWorkspaceMetadata(projectPath);

    if (!metadata[workspaceId]) {
      metadata[workspaceId] = {};
    }

    metadata[workspaceId].archived = false;
    metadata[workspaceId].archivedAt = null;

    await saveWorkspaceMetadata(projectPath, metadata);
    return true;
  } catch (error) {
    throw new Error(`Failed to unarchive workspace: ${error.message}`);
  }
}

/**
 * Get Git status for a worktree
 */
async function getWorktreeStatus(worktreePath) {
  try {
    // 1. Check dirty status
    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: worktreePath
    });

    const lines = statusOutput.split('\n').filter(Boolean);
    const isDirty = lines.length > 0;

    // 2. Get current branch
    const { stdout: branchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: worktreePath
    });
    const branch = branchOutput.trim();

    // 3. Check ahead/behind (requires remote tracking)
    let ahead = 0;
    let behind = 0;
    let hasRemote = false;

    try {
      // Fetch to get latest remote info
      await execAsync('git fetch origin', { cwd: worktreePath });

      // Check if remote branch exists
      const { stdout: remoteCheck } = await execAsync(`git rev-parse --verify origin/${branch}`, {
        cwd: worktreePath
      });

      if (remoteCheck.trim()) {
        hasRemote = true;

        // Get ahead/behind counts
        const { stdout: revList } = await execAsync(`git rev-list --left-right --count origin/${branch}...HEAD`, {
          cwd: worktreePath
        });

        const [behindStr, aheadStr] = revList.trim().split('\t');
        behind = parseInt(behindStr) || 0;
        ahead = parseInt(aheadStr) || 0;
      }
    } catch (e) {
      // Remote branch doesn't exist or fetch failed
      hasRemote = false;
    }

    // 4. Check PR status (using gh CLI)
    let prStatus = null;
    let prUrl = null;

    try {
      const { stdout: prOutput } = await execAsync(`gh pr list --head ${branch} --json state,url,title`, {
        cwd: worktreePath
      });

      const prs = JSON.parse(prOutput);
      if (prs.length > 0) {
        const pr = prs[0];
        prStatus = pr.state; // "OPEN", "CLOSED", "MERGED"
        prUrl = pr.url;
      }
    } catch (e) {
      // No PR or gh CLI error
    }

    // Determine overall status
    let status = 'unknown';

    if (prStatus === 'MERGED') {
      status = 'merged';
    } else if (isDirty) {
      status = 'working';
    } else if (ahead > 0 && behind > 0) {
      status = 'diverged';
    } else if (ahead > 0) {
      status = 'ahead';
    } else if (behind > 0) {
      status = 'behind';
    } else if (!hasRemote) {
      status = 'local';
    } else {
      status = 'synced';
    }

    return {
      clean: !isDirty,
      modified: lines.filter(l => l.startsWith(' M')).length,
      added: lines.filter(l => l.startsWith('A')).length,
      deleted: lines.filter(l => l.startsWith(' D')).length,
      untracked: lines.filter(l => l.startsWith('??')).length,
      ahead,
      behind,
      hasRemote,
      prStatus,
      prUrl,
      status, // 'merged', 'working', 'diverged', 'ahead', 'behind', 'local', 'synced'
      branch
    };
  } catch (error) {
    console.error('[Workspace] Failed to get status:', error);
    return {
      clean: true,
      modified: 0,
      added: 0,
      deleted: 0,
      untracked: 0,
      ahead: 0,
      behind: 0,
      hasRemote: false,
      prStatus: null,
      prUrl: null,
      status: 'unknown',
      branch: 'unknown'
    };
  }
}

/**
 * Get file tree for a workspace
 */
async function getFileTree(worktreePath) {
  try {
    // Get git status to mark modified/added files
    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: worktreePath
    });

    // Parse git status to get file statuses
    const fileStatuses = new Map();
    const lines = statusOutput.split('\n').filter(Boolean);
    for (const line of lines) {
      const status = line.substring(0, 2);
      const filePath = line.substring(3);

      if (status.includes('M')) {
        fileStatuses.set(filePath, 'modified');
      } else if (status.includes('A')) {
        fileStatuses.set(filePath, 'added');
      }
    }

    // Recursively build file tree
    async function buildTree(dirPath, relativePath = '') {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const nodes = [];

      for (const entry of entries) {
        // Skip .git and node_modules
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.conductor') {
          continue;
        }

        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          const children = await buildTree(entryPath, entryRelativePath);
          nodes.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'folder',
            children
          });
        } else {
          const status = fileStatuses.get(entryRelativePath);
          nodes.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'file',
            modified: status === 'modified',
            added: status === 'added'
          });
        }
      }

      // Sort: folders first, then files, alphabetically
      return nodes.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
    }

    const fileTree = await buildTree(worktreePath);
    return fileTree;
  } catch (error) {
    console.error('[Workspace] Failed to get file tree:', error);
    return [];
  }
}

// IPC Handlers for Workspace Management

/**
 * Create a new workspace with auto-generated animal name
 */
ipcMain.handle('workspace:create', async (event, repositoryPath) => {
  try {
    // Use provided repository path, fallback to default for backward compatibility
    const projectPath = repositoryPath || path.resolve(__dirname, '../../../..');

    // Generate unique branch name
    const branchName = await generateWorkspaceName(projectPath);

    // Create worktree
    const workspace = await createWorktree(projectPath, branchName);

    return { success: true, workspace };
  } catch (error) {
    console.error('[Workspace] Create error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * List all workspaces
 */
ipcMain.handle('workspace:list', async (event, repositoryPath) => {
  try {
    // Use provided repository path, fallback to default for backward compatibility
    const projectPath = repositoryPath || path.resolve(__dirname, '../../../..');
    const workspaces = await listWorktrees(projectPath);

    return { success: true, workspaces };
  } catch (error) {
    console.error('[Workspace] List error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Delete a workspace
 */
ipcMain.handle('workspace:delete', async (event, workspaceId, repositoryPath) => {
  try {
    // Use provided repository path, fallback to default for backward compatibility
    const projectPath = repositoryPath || path.resolve(__dirname, '../../../..');
    await deleteWorktree(projectPath, workspaceId);

    return { success: true };
  } catch (error) {
    console.error('[Workspace] Delete error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Archive a workspace
 */
ipcMain.handle('workspace:archive', async (event, workspaceId, repositoryPath) => {
  try {
    // Validate workspaceId to prevent path traversal
    if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.includes('..') || workspaceId.includes('/') || workspaceId.includes('\\')) {
      return { success: false, error: 'Invalid workspace ID' };
    }

    // Use provided repository path, fallback to default for backward compatibility
    const projectPath = repositoryPath || path.resolve(__dirname, '../../../..');
    await archiveWorkspace(projectPath, workspaceId);

    return { success: true };
  } catch (error) {
    console.error('[Workspace] Archive error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Unarchive a workspace
 */
ipcMain.handle('workspace:unarchive', async (event, workspaceId) => {
  try {
    // Validate workspaceId to prevent path traversal
    if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.includes('..') || workspaceId.includes('/') || workspaceId.includes('\\')) {
      return { success: false, error: 'Invalid workspace ID' };
    }

    const projectPath = path.resolve(__dirname, '../../../..');
    await unarchiveWorkspace(projectPath, workspaceId);

    return { success: true };
  } catch (error) {
    console.error('[Workspace] Unarchive error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get workspace status (Git status)
 */
ipcMain.handle('workspace:get-status', async (event, workspacePath) => {
  try {
    const status = await getWorktreeStatus(workspacePath);
    return { success: true, status };
  } catch (error) {
    console.error('[Workspace] Get status error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get file tree for a workspace
 */
ipcMain.handle('workspace:get-file-tree', async (event, workspacePath) => {
  try {
    const fileTree = await getFileTree(workspacePath);
    return { success: true, fileTree };
  } catch (error) {
    console.error('[Workspace] Get file tree error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// Claude CLI - Workspace Session Management
// ============================================================================

// Active Claude sessions for each workspace
const activeSessions = new Map();

/**
 * Start a Claude CLI session for a workspace
 */
ipcMain.handle('claude:start-session', async (event, workspacePath) => {
  try {
    const sessionId = `session-${Date.now()}`;

    console.log('[Claude] Starting session:', sessionId, 'at', workspacePath);

    // Check if Claude CLI exists
    try {
      await fs.access(CLAUDE_CLI_PATH);
    } catch (error) {
      return {
        success: false,
        error: 'Claude Code CLI not found. Please install Claude Code first.'
      };
    }

    // Store session info
    activeSessions.set(sessionId, {
      workspacePath,
      messages: [],
      createdAt: Date.now(),
      claudeProcess: null,  // Will be set when sending messages
      isRunning: false      // Track if Claude is currently processing
    });

    return {
      success: true,
      sessionId
    };
  } catch (error) {
    console.error('[Claude] Failed to start session:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Send message to Claude and get response
 */
ipcMain.on('claude:send-message', async (event, sessionId, userMessage, attachments = [], thinkingMode = 'normal', architectMode = false, aiRulesSystemPrompt = undefined) => {
  try {
    const session = activeSessions.get(sessionId);

    if (!session) {
      console.error('[Claude] Session not found:', sessionId);
      event.sender.send('claude:response-error', {
        success: false,
        error: 'Session not found'
      });
      return;
    }

    // Log architect mode status
    if (architectMode && aiRulesSystemPrompt) {
      console.log('[Claude] 🏗️ Architect Mode ENABLED - AI rules will be applied as system prompt');
      console.log('[Claude] AI Rules length:', aiRulesSystemPrompt.length, 'characters');
    }

    // Validate thinkingMode
    const validModes = ['normal', 'think', 'megathink', 'ultrathink', 'plan'];
    if (!validModes.includes(thinkingMode)) {
      thinkingMode = 'normal';
    }

    // Build multimodal content array
    const content = [];

    // Build instruction prefix with architect mode + thinking mode
    let instructionPrefix = '';
    const languageInstruction = 'IMPORTANT: Always think and analyze in ENGLISH internally, but respond in THE SAME LANGUAGE as the user\'s input (Korean→Korean, Japanese→Japanese, English→English).';

    // Add Architect Mode AI rules as system instruction if enabled
    if (architectMode && aiRulesSystemPrompt) {
      instructionPrefix = `${aiRulesSystemPrompt}\n\n---\n\n`;
      console.log('[Claude] 🏗️ Added Architect Mode instructions to message');
    }

    // Add thinking mode instructions
    let thinkingInstruction = '';
    if (thinkingMode === 'think') {
      thinkingInstruction = `<thinking_instruction>Think carefully and systematically about this request before responding. Take your time to reason through the problem.\n\n${languageInstruction}</thinking_instruction>\n\n`;
    } else if (thinkingMode === 'megathink') {
      thinkingInstruction = `<thinking_instruction>Think very deeply about this request. Consider multiple approaches, potential edge cases, and implications. Reason through each step carefully and thoroughly.\n\n${languageInstruction}</thinking_instruction>\n\n`;
    } else if (thinkingMode === 'ultrathink') {
      thinkingInstruction = `<thinking_instruction>Think comprehensively and exhaustively about this request. Explore all possible approaches, consider every edge case, analyze all implications, and reason through the problem with maximum depth and rigor. Take as much time as needed to fully understand and solve the problem.\n\n${languageInstruction}</thinking_instruction>\n\n`;
    } else if (thinkingMode === 'plan') {
      thinkingInstruction = `<thinking_instruction>
# Plan Mode - Mandatory Planning Workflow

⚠️ CRITICAL: You are in PLAN MODE. You MUST create a plan in JSON format. Failure to do so will result in an automatic retry.

DO NOT proceed with any work until you have output a valid JSON plan.

## ABSOLUTELY REQUIRED: JSON Plan Output

### 1. Comprehensive Analysis (Required)
Read and analyze ALL relevant code:
- Current implementation files
- Type definitions and interfaces
- Related components and dependencies
- Potential impact areas

Use Read, Glob, or Grep tools extensively to understand the full scope.

### 2. Create Plan in JSON Format (ABSOLUTELY REQUIRED - NO EXCEPTIONS)

⚠️ THIS IS NOT OPTIONAL. YOUR FIRST OUTPUT MUST BE A JSON PLAN.

After analyzing the codebase, you MUST output your plan in the following JSON format within a code block.

The JSON plan MUST be your FIRST output, before any explanation.

Plan structure:
{
  "todos": [
    {
      "content": "What to do (imperative form)",
      "activeForm": "What you're doing (present continuous)",
      "status": "pending",
      "complexity": "trivial" | "simple" | "moderate" | "complex" | "very_complex",
      "priority": "low" | "medium" | "high" | "critical",
      "estimatedDuration": 30,  // minutes
      "order": 0,
      "depth": 0
    }
  ]
}

Example plan output (wrap in triple-backticks with 'json' language marker):

{
  "todos": [
    {
      "content": "Analyze current theme implementation in design-tokens.css",
      "activeForm": "Analyzing current theme implementation",
      "status": "pending",
      "complexity": "simple",
      "priority": "high",
      "estimatedDuration": 900,
      "order": 0,
      "depth": 0
    },
    {
      "content": "Add green-light color palette with OKLCH values",
      "activeForm": "Adding green-light color palette",
      "status": "pending",
      "complexity": "moderate",
      "priority": "high",
      "estimatedDuration": 20,
      "order": 1,
      "depth": 0
    },
    {
      "content": "Update TypeScript types for green theme variants",
      "activeForm": "Updating TypeScript types",
      "status": "pending",
      "complexity": "trivial",
      "priority": "medium",
      "estimatedDuration": 5,
      "order": 2,
      "depth": 0
    }
  ]
}

⚠️ CRITICAL FORMAT REQUIREMENT ⚠️
The JSON block MUST be wrapped in triple backticks (\`\`\`) with the "json" language identifier.

Example:
\`\`\`json
{
  "todos": [...]
}
\`\`\`

If you fail to output JSON in this exact format, the system will automatically request a retry.

### 3. Present Plan to User
After outputting the JSON plan, EXPLAIN the plan in natural language.

IMPORTANT - Language Guidelines:
- Always think and analyze in ENGLISH internally
- Detect the user's input language from their prompt
- Output your explanation in THE SAME LANGUAGE as the user's input
- If user wrote in Korean, respond in Korean
- If user wrote in Japanese, respond in Japanese
- If user wrote in English, respond in English
- The JSON plan structure always stays in English (field names, etc.)

In your explanation, include:
- Summary of what you analyzed
- Total number of tasks
- Estimated total time
- Key steps and approach
- Any potential risks or considerations

The system will automatically detect the JSON plan and show it to the user for approval.

Then STOP and WAIT for user approval. Do NOT proceed with implementation.

The user will review the plan and either:
- Approve it ("Start Tasks" button) → You'll receive confirmation to proceed
- Edit it and then approve
- Cancel and provide new instructions

### 4. Execute Plan (After Approval)
Once the user approves (you'll receive their approval message), work through todos sequentially:

For each todo:
1. Announce which task you're starting
2. Perform the actual work (Read, Edit, Write, Bash, etc.)
3. Confirm completion before moving to next task

Example execution after approval:
"Starting task 1: Analyzing current theme implementation..."

<Read file_path="design-tokens.css" />
... analyze the file ...

"Task 1 complete. Starting task 2: Adding green-light color palette..."

<Edit file_path="design-tokens.css" .../>
... make changes ...

### 5. Apply Development Principles
Throughout execution, follow these core principles:

1. **Define Goal and Approach First**
   - Understand the "why" before the "how"
   - Plan the technical approach before coding

2. **Prioritize Readability and Simplicity**
   - Write clean, understandable code
   - Avoid over-engineering
   - Use clear variable/function names

3. **Commit with Clarity and Purpose**
   - Make logical, atomic changes
   - Explain what and why in each step

4. **Build Confidence with Tests**
   - Verify changes work as expected
   - Consider edge cases
   - Test before marking complete

## Important Rules:

- ❌ CANNOT skip the JSON plan output in Plan Mode - it is MANDATORY
- ❌ CANNOT start implementation before user approval
- ❌ CANNOT output the plan in any other format (no markdown tables, no plain text lists)
- ✅ MUST analyze code comprehensively before planning
- ✅ MUST output plan as JSON code block with \`\`\`json wrapper
- ✅ MUST create specific, actionable todos with estimated durations in SECONDS
- ✅ MUST wait for explicit user approval before starting work
- ✅ MUST follow the core development principles

Plan Mode ensures structured, thoughtful development. Take your time to plan well.
</thinking_instruction>\n\n`;
    }

    // Combine architect mode prefix + thinking instruction + user message
    const fullPrefix = instructionPrefix + thinkingInstruction;

    // Add text message with combined prefix
    if (userMessage && userMessage.trim()) {
      content.push({
        type: 'text',
        text: fullPrefix + userMessage
      });
    } else if (fullPrefix.trim()) {
      // If no user message but instructions exist, add them anyway
      content.push({
        type: 'text',
        text: fullPrefix.trim()
      });
    }

    // Process attachments
    for (const file of attachments) {
      console.log('[Claude] Processing attachment:', file.name, file.type);

      if (file.type.startsWith('image/')) {
        // Image attachment - extract base64 from data URL
        const base64Match = file.url.match(/^data:([^;]+);base64,(.+)$/);
        if (base64Match) {
          const mediaType = base64Match[1];
          const base64Data = base64Match[2];

          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data
            }
          });
          console.log('[Claude] Added image attachment:', file.name);
        }

      } else if (file.type === 'application/pdf') {
        // PDF attachment - extract base64 from data URL
        const base64Match = file.url.match(/^data:([^;]+);base64,(.+)$/);
        if (base64Match) {
          const base64Data = base64Match[2];

          content.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data
            }
          });
          console.log('[Claude] Added PDF attachment:', file.name);
        }

      } else if (file.type.startsWith('text/')) {
        // Text file - decode from data URL
        const base64Match = file.url.match(/^data:([^;]+);base64,(.+)$/);
        if (base64Match) {
          const base64Data = base64Match[2];
          const textContent = Buffer.from(base64Data, 'base64').toString('utf-8');

          content.push({
            type: 'text',
            text: `\n\n<file name="${file.name}">\n${textContent}\n</file>`
          });
          console.log('[Claude] Added text file attachment:', file.name);
        }
      }
    }

    console.log('[Claude] Built content with', content.length, 'blocks');

    // Add user message to history
    session.messages.push({
      role: 'user',
      content: content.length === 1 ? content[0].text : content
    });

    // Spawn Claude CLI with STREAMING enabled
    const claude = spawn(CLAUDE_CLI_PATH, [
      '--print',
      '--verbose',                       // Required for stream-json!
      '--output-format', 'stream-json',  // Enable real-time streaming!
      '--include-partial-messages',      // Include partial chunks
      '--model', 'sonnet',
      '--permission-mode', 'acceptEdits'  // Auto-approve file edits
    ], {
      cwd: session.workspacePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Store process reference and set running state
    session.claudeProcess = claude;
    session.isRunning = true;

    // Send message with multimodal content
    const input = JSON.stringify({
      role: 'user',
      content: content.length === 1 ? content[0].text : content
    });

    claude.stdin.write(input);
    claude.stdin.end();

    // Collect response and track progress
    let stdoutBuffer = '';  // Buffer for incomplete JSON lines
    let fullResponse = '';
    let stderr = '';
    const startTime = Date.now();
    let hasStarted = false;
    let toolCalls = [];

    claude.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;

      // DEBUG: Log every stdout event to see frequency
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`[Claude] 📥 stdout event at ${elapsed}s (${chunk.length} bytes)`);

      // Send start event on first chunk
      if (!hasStarted && event.sender && !event.sender.isDestroyed()) {
        hasStarted = true;
        console.log('[Claude] 🧠 Thinking started for session:', sessionId);
        event.sender.send('claude:thinking-start', sessionId, Date.now());
      }

      // Process complete JSON lines from stream-json format
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';  // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const msg = JSON.parse(line);
          console.log('[Claude] 📦 Message type:', msg.type);

          // Handle stream_event messages
          if (msg.type === 'stream_event' && msg.event) {
            const streamEvent = msg.event;

            // Text delta - accumulate response text
            if (streamEvent.type === 'content_block_delta' && streamEvent.delta) {
              if (streamEvent.delta.type === 'text_delta' && streamEvent.delta.text) {
                fullResponse += streamEvent.delta.text;
                console.log('[Claude] 📝 Text delta:', streamEvent.delta.text.substring(0, 50));
              }
            }

            // Tool use detected (basic detection, detailed info comes from assistant message)
            else if (streamEvent.type === 'content_block_start' && streamEvent.content_block) {
              if (streamEvent.content_block.type === 'tool_use') {
                const toolName = streamEvent.content_block.name;
                console.log('[Claude] 🔧 Tool use started:', toolName);
                toolCalls.push(toolName);
                // Detailed milestone will be sent from assistant message with full input
              }
            }

            // Message lifecycle events
            else if (streamEvent.type === 'message_start') {
              console.log('[Claude] 🚀 Message started');
            }
            else if (streamEvent.type === 'message_stop') {
              console.log('[Claude] 🏁 Message stopped');
            }
          }

          // Assistant message (contains complete message info with tool inputs)
          else if (msg.type === 'assistant' && msg.message) {
            console.log('[Claude] 💬 Assistant message:', msg.message.stop_reason);

            // Parse content blocks from assistant message (has complete input)
            if (msg.message.content && Array.isArray(msg.message.content)) {
              for (const block of msg.message.content) {
                // Text content = Claude's thinking/explanation
                if (block.type === 'text' && block.text && block.text.length > 0) {
                  const thinkingText = block.text.trim();
                  if (thinkingText.length > 0) {
                    const shortText = thinkingText.length > 100
                      ? thinkingText.substring(0, 100) + '...'
                      : thinkingText;
                    console.log('[Claude] 💭 Thinking:', shortText);

                    // Send thinking milestone to UI
                    if (event.sender && !event.sender.isDestroyed()) {
                      const milestone = {
                        type: 'thinking',
                        message: thinkingText,
                        timestamp: Date.now()
                      };
                      event.sender.send('claude:milestone', sessionId, milestone);
                    }
                  }
                }

                // Tool use content
                else if (block.type === 'tool_use' && block.name && block.input) {
                  const toolName = block.name;
                  const input = block.input;

                  // Build detailed milestone based on tool type
                  let detailedMessage = `Using ${toolName}`;
                  let metadata = { tool: toolName };

                  if (toolName === 'Read' && input.file_path) {
                    const fileName = input.file_path.split('/').pop();
                    detailedMessage = `Read ${fileName}`;
                    metadata.filePath = input.file_path;
                  }
                  else if (toolName === 'Edit' && input.file_path) {
                    const fileName = input.file_path.split('/').pop();
                    detailedMessage = `Edit ${fileName}`;
                    metadata.filePath = input.file_path;
                  }
                  else if (toolName === 'Write' && input.file_path) {
                    const fileName = input.file_path.split('/').pop();
                    detailedMessage = `Write ${fileName}`;
                    metadata.filePath = input.file_path;
                  }
                  else if (toolName === 'Bash' && input.command) {
                    const shortCmd = input.command.length > 40
                      ? input.command.substring(0, 40) + '...'
                      : input.command;
                    detailedMessage = `Bash: ${shortCmd}`;
                    metadata.command = input.command;
                  }
                  else if (toolName === 'Glob' && input.pattern) {
                    detailedMessage = `Glob: ${input.pattern}`;
                    metadata.pattern = input.pattern;
                  }
                  else if (toolName === 'Grep' && input.pattern) {
                    detailedMessage = `Grep: ${input.pattern}`;
                    metadata.pattern = input.pattern;
                  }

                  console.log('[Claude] 🔧 Tool detail:', detailedMessage);

                  // Send tool milestone to UI
                  if (event.sender && !event.sender.isDestroyed()) {
                    const milestone = {
                      type: 'tool-use',
                      tool: toolName,
                      message: detailedMessage,
                      timestamp: Date.now(),
                      ...metadata
                    };
                    event.sender.send('claude:milestone', sessionId, milestone);
                  }
                }
              }
            }
          }

          // Final result
          else if (msg.type === 'result') {
            console.log('[Claude] ✅ Final result received');
          }

        } catch (parseError) {
          console.warn('[Claude] Failed to parse stream line:', line.substring(0, 100));
        }
      }
    });

    claude.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;

      // Parse stderr for milestones (no duration calculation here)
      if (event.sender && !event.sender.isDestroyed()) {
        let milestone = null;

        if (chunk.includes('tool_use') || chunk.includes('function_call')) {
          milestone = {
            type: 'tool-call',
            message: 'Calling tools'
          };
        } else if (chunk.includes('thinking') || chunk.includes('reasoning')) {
          milestone = {
            type: 'reasoning',
            message: 'Deep reasoning'
          };
        }

        if (milestone) {
          console.log('[Claude] 📍 Milestone (stderr):', milestone.message);
          event.sender.send('claude:milestone', sessionId, milestone);
        }
      }
    });

    // Handle completion
    claude.on('close', (code) => {
      if (!event.sender || event.sender.isDestroyed()) {
        console.warn('[Claude] Cannot send response - sender destroyed');
        return;
      }

      if (code !== 0) {
        console.error('[Claude] Process failed:', stderr);
        event.sender.send('claude:response-error', {
          success: false,
          error: `Claude CLI exited with code ${code}: ${stderr}`
        });
        return;
      }

      try {
        // Parse any remaining buffer
        if (stdoutBuffer.trim()) {
          try {
            const finalEvent = JSON.parse(stdoutBuffer);
            console.log('[Claude] 📦 Final event:', finalEvent.type);
          } catch (e) {
            console.warn('[Claude] Could not parse final buffer');
          }
        }

        const totalDuration = Math.floor((Date.now() - startTime) / 1000);

        // Use accumulated response
        const assistantMessage = fullResponse || 'No response received';

        // Add to session history
        session.messages.push({
          role: 'assistant',
          content: assistantMessage
        });

        console.log('[Claude] Response received:', assistantMessage.substring(0, 100));

        // Send completion event with final stats
        const stats = {
          duration: totalDuration,
          cost: 0,  // stream-json might not include cost
          toolCalls: toolCalls.length
        };
        console.log('[Claude] ✅ Thinking complete:', stats);
        event.sender.send('claude:thinking-complete', sessionId, stats);

        // Send response complete event
        event.sender.send('claude:response-complete', {
          success: true,
          message: assistantMessage,
          sessionId,
          cost: 0,
          duration: totalDuration
        });

        // Cleanup session state
        session.isRunning = false;
        session.claudeProcess = null;
      } catch (parseError) {
        console.error('[Claude] Failed to process response:', parseError);
        event.sender.send('claude:response-error', {
          success: false,
          error: `Failed to process response: ${parseError.message}`
        });

        // Cleanup session state on error
        session.isRunning = false;
        session.claudeProcess = null;
      }
    });

    claude.on('error', (error) => {
      console.error('[Claude] Process error:', error);
      if (event.sender && !event.sender.isDestroyed()) {
        event.sender.send('claude:response-error', {
          success: false,
          error: `Failed to spawn Claude CLI: ${error.message}`
        });
      }

      // Cleanup session state on error
      session.isRunning = false;
      session.claudeProcess = null;
    });
  } catch (error) {
    console.error('[Claude] Send message error:', error);
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('claude:response-error', {
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * Cancel an ongoing Claude message
 */
ipcMain.on('claude:cancel-message', (event, sessionId) => {
  try {
    const session = activeSessions.get(sessionId);

    if (!session) {
      console.warn('[Claude] Cancel requested but session not found:', sessionId);
      return;
    }

    if (!session.isRunning || !session.claudeProcess) {
      console.warn('[Claude] Cancel requested but no process running:', sessionId);
      return;
    }

    console.log('[Claude] 🛑 Cancelling message for session:', sessionId);

    // Kill the Claude process
    try {
      // Try graceful termination first
      session.claudeProcess.kill('SIGTERM');

      // Force kill after 3 seconds if still running
      const killTimeout = setTimeout(() => {
        if (session.claudeProcess && !session.claudeProcess.killed) {
          console.log('[Claude] Force killing process (SIGKILL)');
          session.claudeProcess.kill('SIGKILL');
        }
      }, 3000);

      // Clear timeout if process exits gracefully
      session.claudeProcess.once('exit', () => {
        clearTimeout(killTimeout);
      });

    } catch (killError) {
      console.error('[Claude] Error killing process:', killError);
    }

    // Update session state
    session.isRunning = false;

    // Notify frontend
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('claude:message-cancelled', sessionId);
    }

  } catch (error) {
    console.error('[Claude] Cancel message error:', error);
  }
});

/**
 * Stop a Claude session
 */
ipcMain.handle('claude:stop-session', async (event, sessionId) => {
  try {
    if (activeSessions.has(sessionId)) {
      activeSessions.delete(sessionId);
      console.log('[Claude] Session stopped:', sessionId);
    }

    return { success: true };
  } catch (error) {
    console.error('[Claude] Stop session error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Quick explain - Fast hover explanation (optimized for speed)
 * Uses a one-shot Claude Code invocation for faster response
 */
ipcMain.handle('claude:quick-explain', async (event, data) => {
  try {
    const { word, context, language = 'typescript', aiMode = 'fast' } = data;
    const { spawn } = require('child_process');

    // Build concise prompt for fast response
    const prompt = `Briefly explain "${word}" in this code context (1-2 sentences max):

\`\`\`${language}
${context}
\`\`\`

Response in Korean if applicable. Be concise.`;

    // Configure based on AI mode
    const config = {
      fast: { maxTokens: 100, temperature: 0.3 },
      balanced: { maxTokens: 150, temperature: 0.5 },
      accurate: { maxTokens: 200, temperature: 0.7 }
    }[aiMode] || { maxTokens: 100, temperature: 0.3 };

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Timeout' });
      }, aiMode === 'fast' ? 2000 : aiMode === 'balanced' ? 3000 : 5000);

      const claudeProcess = spawn('claude-code', [
        '--no-streaming',
        '--max-tokens', config.maxTokens.toString(),
        '--temperature', config.temperature.toString()
      ], {
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      claudeProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      claudeProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      claudeProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0 && output) {
          resolve({
            success: true,
            explanation: output.trim()
          });
        } else {
          resolve({
            success: false,
            error: errorOutput || 'Failed to get explanation'
          });
        }
      });

      // Send prompt to stdin
      claudeProcess.stdin.write(prompt);
      claudeProcess.stdin.end();
    });
  } catch (error) {
    console.error('[Claude] Quick explain error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * AI Completion - Intelligent code completion
 * Uses Claude Code for context-aware suggestions
 */
ipcMain.handle('claude:ai-completion', async (event, data) => {
  try {
    const {
      prefix,           // Code before cursor
      suffix,           // Code after cursor
      context,          // Surrounding code
      language = 'typescript',
      aiMode = 'fast',
      maxTokens = 150
    } = data;

    const { spawn } = require('child_process');

    // Build prompt for completion
    const prompt = `Complete the following ${language} code. Return ONLY the completion text (no explanations):

Context:
\`\`\`${language}
${context}
\`\`\`

Code to complete:
\`\`\`${language}
${prefix}<CURSOR>${suffix}
\`\`\`

Provide a concise, single-line or multi-line completion for <CURSOR>.`;

    // Configure based on AI mode
    const config = {
      fast: { tokens: Math.min(maxTokens, 100), temperature: 0.2, timeout: 1500 },
      balanced: { tokens: Math.min(maxTokens, 150), temperature: 0.3, timeout: 2500 },
      accurate: { tokens: maxTokens, temperature: 0.4, timeout: 4000 }
    }[aiMode] || { tokens: 100, temperature: 0.2, timeout: 1500 };

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Timeout' });
      }, config.timeout);

      const claudeProcess = spawn('claude-code', [
        '--no-streaming',
        '--max-tokens', config.tokens.toString(),
        '--temperature', config.temperature.toString()
      ], {
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      claudeProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      claudeProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      claudeProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0 && output) {
          // Extract completion from output (remove markdown code blocks if present)
          let completion = output.trim();
          completion = completion.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');

          resolve({
            success: true,
            completion: completion
          });
        } else {
          resolve({
            success: false,
            error: errorOutput || 'Failed to get completion'
          });
        }
      });

      // Send prompt to stdin
      claudeProcess.stdin.write(prompt);
      claudeProcess.stdin.end();
    });
  } catch (error) {
    console.error('[Claude] AI completion error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Read file contents from a workspace
 */
ipcMain.handle('workspace:read-file', async (event, workspacePath, filePath) => {
  try {
    const fullPath = path.join(workspacePath, filePath);

    console.log('[Workspace] Reading file:', fullPath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch (error) {
      return {
        success: false,
        error: 'File not found'
      };
    }

    // Read file contents
    const content = await fs.readFile(fullPath, 'utf8');

    return {
      success: true,
      content,
      filePath
    };
  } catch (error) {
    console.error('[Workspace] Read file error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Write file contents
 */
ipcMain.handle('workspace:write-file', async (event, workspacePath, filePath, content) => {
  try {
    const fullPath = path.join(workspacePath, filePath);

    console.log('[Workspace] Writing file:', fullPath);

    // Ensure directory exists
    const dirPath = path.dirname(fullPath);
    await fs.mkdir(dirPath, { recursive: true });

    // Write file contents
    await fs.writeFile(fullPath, content, 'utf8');

    return {
      success: true,
      filePath
    };
  } catch (error) {
    console.error('[Workspace] Write file error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// ============================================================================
// Git Operations - Commit & PR
// ============================================================================

/**
 * Get git diff for workspace
 */
ipcMain.handle('workspace:git-diff', async (event, workspacePath) => {
  try {
    console.log('[Workspace] Getting git diff for:', workspacePath);

    const { stdout, stderr } = await execAsync('git diff HEAD', { cwd: workspacePath });

    return {
      success: true,
      diff: stdout
    };
  } catch (error) {
    console.error('[Workspace] Git diff error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Commit and push changes
 */
ipcMain.handle('workspace:commit-and-push', async (event, workspacePath, commitMessage) => {
  try {
    console.log('[Workspace] Committing and pushing:', workspacePath);

    // Stage all changes
    await execAsync('git add .', { cwd: workspacePath });

    // Commit with message
    const commitCmd = `git commit -m ${JSON.stringify(commitMessage)}`;
    await execAsync(commitCmd, { cwd: workspacePath });

    // Get current branch
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath });
    const branchName = branch.trim();

    // Push to origin
    await execAsync(`git push -u origin ${branchName}`, { cwd: workspacePath });

    console.log('[Workspace] Successfully committed and pushed');

    return {
      success: true,
      branch: branchName
    };
  } catch (error) {
    console.error('[Workspace] Commit and push error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Create pull request using gh CLI
 */
ipcMain.handle('workspace:create-pr', async (event, workspacePath, title, body) => {
  try {
    console.log('[Workspace] Creating PR for:', workspacePath);

    // Get current branch
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath });
    const branchName = branch.trim();

    // Create PR using gh CLI
    const prCmd = `gh pr create --title ${JSON.stringify(title)} --body ${JSON.stringify(body)} --base main`;

    try {
      const { stdout } = await execAsync(prCmd, { cwd: workspacePath });
      const prUrl = stdout.trim();
      console.log('[Workspace] PR created:', prUrl);

      return {
        success: true,
        prUrl,
        branch: branchName
      };
    } catch (prError) {
      // Check if PR already exists
      if (prError.message && prError.message.includes('already exists')) {
        console.log('[Workspace] PR already exists, fetching existing PR...');

        // Extract URL from error message if present
        const urlMatch = prError.message.match(/(https:\/\/github\.com\/[^\s]+)/);
        if (urlMatch) {
          const existingUrl = urlMatch[1];
          console.log('[Workspace] Found existing PR:', existingUrl);
          return {
            success: true,
            prUrl: existingUrl,
            branch: branchName,
            alreadyExists: true
          };
        }

        // Fallback: Use gh pr list to find the PR
        try {
          const listCmd = `gh pr list --head ${branchName} --json url --jq '.[0].url'`;
          const { stdout: existingUrl } = await execAsync(listCmd, { cwd: workspacePath });
          console.log('[Workspace] Found existing PR via list:', existingUrl.trim());

          return {
            success: true,
            prUrl: existingUrl.trim(),
            branch: branchName,
            alreadyExists: true
          };
        } catch (listError) {
          console.error('[Workspace] Failed to find existing PR:', listError);
          throw new Error('PR already exists but could not retrieve URL');
        }
      }

      // Other error - re-throw
      throw prError;
    }
  } catch (error) {
    console.error('[Workspace] Create PR error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Sync workspace with main branch (merge main into workspace)
 */
ipcMain.handle('workspace:sync-with-main', async (event, workspacePath) => {
  try {
    console.log('[Workspace] Syncing with main:', workspacePath);

    // Check for uncommitted changes
    const { stdout: statusCheck } = await execAsync('git status --porcelain', { cwd: workspacePath });

    if (statusCheck.trim()) {
      console.log('[Workspace] Uncommitted changes detected');

      // Parse modified files
      const modifiedFiles = statusCheck.trim().split('\n')
        .map(line => line.substring(3)) // Remove status prefix
        .filter(f => f);

      return {
        success: false,
        hasUncommittedChanges: true,
        modifiedFiles,
        error: 'You have uncommitted changes. Please commit or stash them before syncing.'
      };
    }

    // Fetch latest main
    await execAsync('git fetch origin main', { cwd: workspacePath });

    // Try to merge main into current branch
    try {
      await execAsync('git merge origin/main --no-edit', { cwd: workspacePath });

      console.log('[Workspace] Successfully merged main');

      // Get current branch
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: workspacePath });
      const branchName = branch.trim();

      // Push the merged changes
      await execAsync(`git push origin ${branchName}`, { cwd: workspacePath });

      console.log('[Workspace] Successfully synced and pushed');

      return {
        success: true,
        hasConflicts: false
      };
    } catch (mergeError) {
      // Check if it's a conflict
      const { stdout: statusOutput } = await execAsync('git status', { cwd: workspacePath });

      if (statusOutput.includes('Unmerged paths') || statusOutput.includes('both modified')) {
        console.log('[Workspace] Merge conflicts detected');

        // Get list of conflicted files
        const { stdout: conflictFiles } = await execAsync('git diff --name-only --diff-filter=U', { cwd: workspacePath });

        // DON'T abort - leave conflicts in place for analyze-conflicts to read

        return {
          success: false,
          hasConflicts: true,
          conflictFiles: conflictFiles.trim().split('\n').filter(f => f),
          error: 'Merge conflicts detected. Please resolve manually.'
        };
      } else {
        // Other error
        throw mergeError;
      }
    }
  } catch (error) {
    console.error('[Workspace] Sync with main error:', error);
    return {
      success: false,
      hasConflicts: false,
      error: error.message
    };
  }
});

/**
 * Get list of conflicted files
 */
ipcMain.handle('workspace:get-conflict-files', async (event, workspacePath) => {
  try {
    console.log('[Workspace] Getting conflict files:', workspacePath);
    const { stdout: conflictFiles } = await execAsync('git diff --name-only --diff-filter=U', { cwd: workspacePath });
    const files = conflictFiles.trim().split('\n').filter(f => f);

    return {
      success: true,
      files
    };
  } catch (error) {
    console.error('[Workspace] Get conflict files error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Analyze single file conflict using Claude
 */
ipcMain.handle('workspace:analyze-file-conflict', async (event, workspacePath, file) => {
  try {
    console.log('[Workspace] Analyzing file conflict:', file);

    // Read file with conflict markers
    const filePath = path.join(workspacePath, file);
    const content = await fs.readFile(filePath, 'utf8');

    // Extract base, ours, theirs versions
    const conflictRegex = /<<<<<<< HEAD\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> origin\/main/g;
    const matches = [...content.matchAll(conflictRegex)];

    if (matches.length === 0) {
      return {
        success: false,
        error: 'No conflict markers found in file'
      };
    }

      // For simplicity, handle first conflict point
      const match = matches[0];
      const ours = match[1];
      const theirs = match[2];

      // Try to get base version (original before both changes)
      let base = '# circuit'; // Default for our test case
      try {
        const { stdout: baseContent } = await execAsync(`git show :1:${file}`, { cwd: workspacePath });
        base = baseContent;
      } catch (e) {
        // Base might not exist for new files
      }

      // Ask Claude to analyze
      const prompt = `Analyze this Git conflict and provide resolution options.

File: ${file}

Base (original):
\`\`\`
${base}
\`\`\`

Ours (current branch):
\`\`\`
${ours}
\`\`\`

Theirs (main branch):
\`\`\`
${theirs}
\`\`\`

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "explanation": "1-2 sentence explanation in Korean (50 chars max)",
  "options": [
    {
      "id": 1,
      "title": "내 변경사항만",
      "preview": "full resolved content here",
      "badge": null
    },
    {
      "id": 2,
      "title": "Main 브랜치만",
      "preview": "full resolved content here",
      "badge": null
    },
    {
      "id": 3,
      "title": "내 것 → Main 순서",
      "preview": "full resolved content here",
      "badge": "추천"
    },
    {
      "id": 4,
      "title": "Main → 내 것 순서",
      "preview": "full resolved content here",
      "badge": null
    },
    {
      "id": 5,
      "title": "직접 수정",
      "preview": null,
      "badge": null
    }
  ]
}`;

      // Call Claude CLI
      const claude = spawn(CLAUDE_CLI_PATH, [
        '--print',
        '--output-format', 'json',
        '--model', 'sonnet'
      ], {
        cwd: workspacePath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      claude.stdin.write(JSON.stringify({
        role: 'user',
        content: prompt
      }));
      claude.stdin.end();

      let stdout = '';
      claude.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      const claudeResponse = await new Promise((resolve, reject) => {
        claude.on('close', (code) => {
          if (code !== 0) {
            reject(new Error('Claude CLI failed'));
            return;
          }

          try {
            const response = JSON.parse(stdout);
            if (response.type === 'result' && response.subtype === 'success') {
              // Parse Claude's response (which should be JSON)
              const analysisText = response.result;
              // Extract JSON from response (Claude might wrap it in markdown)
              const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                resolve(analysis);
              } else {
                reject(new Error('Invalid JSON response from Claude'));
              }
            } else {
              reject(new Error('Unexpected Claude response'));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

    console.log('[Workspace] File conflict analysis complete');

    return {
      success: true,
      file,
      analysis: claudeResponse
    };
  } catch (error) {
    console.error('[Workspace] Analyze file conflict error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});


/**
 * Resolve conflict with selected option
 */
ipcMain.handle('workspace:resolve-conflict', async (event, workspacePath, file, resolvedContent) => {
  try {
    console.log('[Workspace] Resolving conflict:', file);

    const filePath = path.join(workspacePath, file);

    // Write resolved content
    await fs.writeFile(filePath, resolvedContent, 'utf8');

    // Git add
    await execAsync(`git add ${file}`, { cwd: workspacePath });

    console.log('[Workspace] Conflict resolved');

    return { success: true };
  } catch (error) {
    console.error('[Workspace] Resolve conflict error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Abort merge in workspace
 */
ipcMain.handle('workspace:abort-merge', async (event, workspacePath) => {
  try {
    console.log('[Workspace] Aborting merge:', workspacePath);
    await execAsync('git merge --abort', { cwd: workspacePath });
    console.log('[Workspace] Merge aborted');
    return { success: true };
  } catch (error) {
    console.error('[Workspace] Abort merge error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Terminal: Create session for workspace
 */
ipcMain.handle('terminal:create-session', async (event, workspaceId, workspacePath) => {
  try {
    console.log('[Terminal] Creating session for workspace:', workspaceId, workspacePath);
    const manager = await getTerminalManagerInstance();
    await manager.createSession(workspaceId, workspacePath);
    return { success: true };
  } catch (error) {
    console.error('[Terminal] Failed to create session:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Terminal: Write data to session
 */
ipcMain.handle('terminal:write', async (event, workspaceId, data) => {
  try {
    console.log('[Terminal] Write request:', {
      workspaceId,
      data: data.replace(/\n/g, '\\n'),
      dataLength: data.length
    });
    const manager = await getTerminalManagerInstance();
    const hasSession = manager.hasSession(workspaceId);
    console.log('[Terminal] Session exists:', hasSession);

    if (!hasSession) {
      console.error('[Terminal] No session found for workspace:', workspaceId);
      return {
        success: false,
        error: `No terminal session found for workspace: ${workspaceId}`
      };
    }

    manager.writeData(workspaceId, data);
    console.log('[Terminal] Data written successfully');
    return { success: true };
  } catch (error) {
    console.error('[Terminal] Failed to write data:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Terminal: Resize terminal
 */
ipcMain.handle('terminal:resize', async (event, workspaceId, cols, rows) => {
  try {
    const manager = await getTerminalManagerInstance();
    manager.resizeTerminal(workspaceId, cols, rows);
    return { success: true };
  } catch (error) {
    console.error('[Terminal] Failed to resize:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Terminal: Destroy session
 */
ipcMain.handle('terminal:destroy-session', async (event, workspaceId) => {
  try {
    console.log('[Terminal] Destroying session for workspace:', workspaceId);
    const manager = await getTerminalManagerInstance();
    manager.destroySession(workspaceId);
    return { success: true };
  } catch (error) {
    console.error('[Terminal] Failed to destroy session:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Terminal: Check if session exists
 */
ipcMain.handle('terminal:has-session', async (event, workspaceId) => {
  try {
    const manager = await getTerminalManagerInstance();
    const exists = manager.hasSession(workspaceId);
    return { success: true, exists };
  } catch (error) {
    console.error('[Terminal] Failed to check session:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Terminal: Check shell hooks installation status
 */
ipcMain.handle('terminal:check-shell-hooks', async (event) => {
  try {
    const { ShellHookManager } = await import('../dist-electron/shellHookManager.js');
    const manager = new ShellHookManager();

    // Detect shell type
    const shell = process.env.SHELL || '';
    let shellType = 'unknown';
    if (shell.includes('zsh')) {
      shellType = 'zsh';
    } else if (shell.includes('bash')) {
      shellType = 'bash';
    }

    // Check if hooks are installed
    let installed = false;
    if (shellType !== 'unknown') {
      installed = await manager.areHooksInstalled(shellType);
    }

    return {
      installed,
      shell: shellType
    };
  } catch (error) {
    console.error('[Terminal] Failed to check shell hooks:', error);
    return {
      installed: false,
      shell: 'unknown'
    };
  }
});

/**
 * Terminal: Install shell hooks
 */
ipcMain.handle('terminal:install-shell-hooks', async (event, shellType) => {
  try {
    const { ShellHookManager } = await import('../dist-electron/shellHookManager.js');
    const manager = new ShellHookManager();
    const result = await manager.injectHooks(shellType);
    return result;
  } catch (error) {
    console.error('[Terminal] Failed to install shell hooks:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

/**
 * Terminal: Remove shell hooks
 */
ipcMain.handle('terminal:remove-shell-hooks', async (event, shellType) => {
  try {
    const { ShellHookManager } = await import('../dist-electron/shellHookManager.js');
    const manager = new ShellHookManager();
    const result = await manager.removeHooks(shellType);
    return result;
  } catch (error) {
    console.error('[Terminal] Failed to remove shell hooks:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

/**
 * Slash Commands: List available commands in workspace
 */
ipcMain.handle('slash-commands:list', async (event, workspacePath) => {
  try {
    const commandsPath = path.join(workspacePath, '.claude', 'commands');

    // Check if directory exists
    try {
      await fs.access(commandsPath);
    } catch {
      // Directory doesn't exist, return empty list
      return { success: true, commands: [] };
    }

    // Read all files in directory
    const files = await fs.readdir(commandsPath);

    // Filter for .md files and extract command names with descriptions
    const commands = await Promise.all(
      files
        .filter(file => file.endsWith('.md'))
        .map(async file => {
          const name = file.replace(/\.md$/, '');
          let description = '';

          try {
            // Read file content to extract description
            const filePath = path.join(commandsPath, file);
            const content = await fs.readFile(filePath, 'utf-8');

            // Extract first non-empty, non-heading line as description
            const lines = content.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              // Skip empty lines, markdown headings, and frontmatter
              if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
                description = trimmed;
                // Limit description length
                if (description.length > 100) {
                  description = description.substring(0, 100) + '...';
                }
                break;
              }
            }
          } catch (err) {
            console.warn(`[Slash Commands] Could not read description for ${file}:`, err);
          }

          return {
            name,
            fileName: file,
            description,
          };
        })
    );

    return { success: true, commands };
  } catch (error) {
    console.error('[Slash Commands] Failed to list commands:', error);
    return {
      success: false,
      error: error.message,
      commands: []
    };
  }
});

/**
 * Slash Commands: Get command content
 */
ipcMain.handle('slash-commands:get', async (event, workspacePath, commandName) => {
  try {
    const commandPath = path.join(workspacePath, '.claude', 'commands', `${commandName}.md`);

    // Read file content
    const content = await fs.readFile(commandPath, 'utf-8');

    return { success: true, content };
  } catch (error) {
    console.error('[Slash Commands] Failed to read command:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
