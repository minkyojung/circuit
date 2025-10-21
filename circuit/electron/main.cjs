const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;

// macOS traffic light button positioning
const HEADER_HEIGHT = 44;
const TRAFFIC_LIGHTS_HEIGHT = 14;
const TRAFFIC_LIGHTS_MARGIN = 20;

function createWindow() {
  const mainWindow = new BrowserWindow({
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
}

app.whenReady().then(() => {
  createWindow();

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
    if (this.eventTarget) {
      this.eventTarget.webContents.send('mcp-event', {
        serverId: this.config.id,
        ...data
      });
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
// Circuit Test-Fix Loop - Phase 1 Step 2
// ============================================================================

ipcMain.handle('circuit:init', async (event, projectPath) => {
  try {
    console.log('[Circuit] Initializing project:', projectPath);

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

    console.log('[Circuit] Created directory structure');

    // 2. Copy react.md template
    const templatePath = path.join(__dirname, '../templates/react.md');
    const strategyPath = path.join(strategiesDir, 'react.md');

    const templateContent = await fs.readFile(templatePath, 'utf-8');
    await fs.writeFile(strategyPath, templateContent);

    console.log('[Circuit] Copied template to', strategyPath);

    // 3. Create circuit.config.md
    const configContent = `# Circuit Configuration

## Project Info
- Strategy: react
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

    console.log('[Circuit] Created config file');

    return {
      success: true,
      message: 'Circuit initialized successfully!',
      circuitDir
    };
  } catch (error) {
    console.error('[Circuit] Initialization error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
