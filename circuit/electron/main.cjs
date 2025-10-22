const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const os = require('os');

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
// Circuit Test-Fix Loop - Phase 2
// ============================================================================

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

        resolve({
          success: code === 0,
          passed,
          failed,
          total,
          duration,
          output: output.slice(0, 10000), // Limit to 10KB
          errors: errorLines.slice(0, 10) // First 10 errors
        });
      });

      testProcess.on('error', (error) => {
        resolve({
          success: false,
          passed: 0,
          failed: 0,
          total: 0,
          duration: Date.now() - startTime,
          output: '',
          errors: [error.message]
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0,
      output: '',
      errors: [error.message]
    };
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
