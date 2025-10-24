const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const os = require('os');
const http = require('http');

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

    // Check if already installed
    if (manager.servers.has(serverId)) {
      console.log('[Circuit] Memory server already installed');
      return { success: true, alreadyInstalled: true };
    }

    // Get project path from Conductor workspace (check env var) or use cwd
    const projectPath = process.env.CONDUCTOR_PROJECT_PATH || process.cwd();

    // Install Memory server
    const memoryServerPath = path.join(__dirname, 'memory-server.js');
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

// macOS traffic light button positioning
const HEADER_HEIGHT = 44;
const TRAFFIC_LIGHTS_HEIGHT = 14;
const TRAFFIC_LIGHTS_MARGIN = 20;

// Window instances
let mainWindow = null;
let peekWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
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
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Clean up reference when window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// Circuit Peek Panel - Corner-Anchored Mini Panel
// ============================================================================

/**
 * Create peek panel window
 * - Corner-anchored (bottom-right by default)
 * - Always on top, but non-intrusive
 * - Mouse events pass through when hidden/dot state
 */
function createPeekWindow() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const margin = 10;

  peekWindow = new BrowserWindow({
    width: 60,
    height: 60,
    // Start off-screen for smooth slide-in animation
    x: screenWidth + 100,
    y: screenHeight - 60 - margin,
    type: 'panel',
    frame: false,
    transparent: true,
    vibrancy: 'hud',  // macOS native glassmorphism blur
    visualEffectState: 'active',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    acceptsFirstMouse: false,
    hasShadow: false,
    show: true,  // Always visible (starts off-screen, slides in)
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // Load peek panel HTML
  if (process.env.VITE_DEV_SERVER_URL) {
    peekWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/peek`);
  } else {
    peekWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/peek' });
  }

  // Mouse events pass through by default (for peek state)
  peekWindow.setIgnoreMouseEvents(true, { forward: true });

  // After loading, slide into peek position with animation
  peekWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      resizePeekWindow('peek', null);
    }, 100);  // Short delay for smooth appearance
  });

  // Prevent window from closing, just hide instead
  peekWindow.on('close', (e) => {
    e.preventDefault();
    peekWindow.hide();
  });
}

/**
 * Resize peek window based on state
 * Uses smooth animation on macOS via setBounds with animate flag
 * Always keeps window visible with consistent slide animations
 */
function resizePeekWindow(state, data) {
  if (!peekWindow) return;

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const margin = 10;

  // Determine if we should use animation (macOS supports it)
  const shouldAnimate = process.platform === 'darwin';

  // Ensure window is always visible (no-op if already shown)
  if (!peekWindow.isVisible()) {
    peekWindow.show();
  }

  switch (state) {
    case 'peek':
      // Tab only: 60px wide, mostly off-screen, only 12px visible
      const peekBounds = {
        x: screenWidth - 12,
        y: screenHeight - 60 - margin,
        width: 60,
        height: 60
      };

      // Always use setBounds for consistent animation
      peekWindow.setBounds(peekBounds, shouldAnimate);
      peekWindow.setIgnoreMouseEvents(true, { forward: true });
      break;

    case 'compact':
      // Full content visible: 240x60 (compact Cursor-style design)
      const compactBounds = {
        x: screenWidth - 240 - margin,
        y: screenHeight - 60 - margin,
        width: 240,
        height: 60
      };

      // Always use setBounds for consistent animation
      peekWindow.setBounds(compactBounds, shouldAnimate);
      peekWindow.setIgnoreMouseEvents(false);
      break;
  }
}

/**
 * IPC Handlers for peek panel
 */
ipcMain.on('peek:resize', (event, { state, data }) => {
  resizePeekWindow(state, data);
});

ipcMain.on('peek:mouse-enter', () => {
  if (peekWindow) {
    peekWindow.setIgnoreMouseEvents(false);
  }
});

ipcMain.on('peek:mouse-leave', () => {
  if (peekWindow) {
    // Only ignore mouse events if in peek state (tab only)
    const bounds = peekWindow.getBounds();
    if (bounds.width <= 60) {
      peekWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  }
});

ipcMain.on('peek:open-in-window', (event, payload) => {
  if (mainWindow) {
    // Focus main window
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();

    // Send data to main window
    mainWindow.webContents.send('peek:data-opened', payload);
  }
});

// Debug: Manual state change from main window
ipcMain.on('peek:debug-change-state', (event, state) => {
  console.log('[Debug] Manually changing peek window state to:', state);
  resizePeekWindow(state, null);
});

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

    // Send to peek panel
    if (peekWindow) {
      peekWindow.webContents.send('deployment:event', deploymentData);
    }

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

    if (githubData && peekWindow) {
      peekWindow.webContents.send('github:event', githubData);
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

app.whenReady().then(async () => {
  createWindow();
  createPeekWindow();

  // Register global shortcut for Cmd+Shift+P (peek panel toggle)
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (peekWindow) {
      if (peekWindow.isVisible()) {
        peekWindow.webContents.send('peek:toggle');
      } else {
        peekWindow.webContents.send('peek:show');
      }
    }
  });

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
    if (!peekWindow) {
      createPeekWindow();
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

    // Also send to peek window for ambient display
    if (peekWindow && !peekWindow.isDestroyed()) {
      peekWindow.webContents.send('mcp-event', payload);
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

    // Send to peek panel
    if (peekWindow && !peekWindow.isDestroyed()) {
      peekWindow.webContents.send('deployment:event', deploymentData);
      return { success: true };
    } else {
      return {
        success: false,
        error: 'Peek panel is not available'
      };
    }
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
    if (peekWindow && !peekWindow.isDestroyed()) {
      peekWindow.webContents.send('github:event', githubData);
      return { success: true };
    } else {
      return {
        success: false,
        error: 'Peek panel is not available'
      };
    }
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

    // Notify peek panel: test started
    if (peekWindow) {
      peekWindow.webContents.send('test:started');
    }

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

        // Notify peek panel: test completed
        if (peekWindow) {
          peekWindow.webContents.send('test:completed', result);
        }

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

        // Notify peek panel: test completed (with error)
        if (peekWindow) {
          peekWindow.webContents.send('test:completed', result);
        }

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

    // Notify peek panel: test completed (with error)
    if (peekWindow) {
      peekWindow.webContents.send('test:completed', result);
    }

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
  } catch (error) {
    console.error('Cleanup error:', error);
  }
});

// MCP/API initialization is now handled in the main app.whenReady() block above
