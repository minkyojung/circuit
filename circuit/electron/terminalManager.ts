import * as pty from 'node-pty'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'
import { getShellHookManager } from './shellHookManager'

interface TerminalSession {
  ptyProcess: pty.IPty
  workspaceId: string
  workspacePath: string
  lastActivity: number
}

export class TerminalManager extends EventEmitter {
  private sessions = new Map<string, TerminalSession>()
  private inactivityTimeout = 30 * 60 * 1000 // 30 minutes
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.startCleanupTimer()
  }

  /**
   * Create a new terminal session for a workspace
   */
  async createSession(workspaceId: string, workspacePath: string): Promise<void> {
    console.log(`[TerminalManager] Creating session for workspace: ${workspaceId}`)

    // Check if session already exists
    if (this.sessions.has(workspaceId)) {
      console.log(`[TerminalManager] Session already exists for workspace: ${workspaceId}`)
      return
    }

    // Validate and normalize workspace path
    let cwd = workspacePath
    try {
      // Check if path exists
      await fs.promises.access(cwd)
      // Resolve to absolute path
      cwd = path.resolve(cwd)
    } catch (error) {
      console.warn(`[TerminalManager] Workspace path not accessible: ${cwd}, falling back to home directory`)
      cwd = os.homedir()
    }

    // Determine shell
    const shell = this.getShell()
    console.log(`[TerminalManager] Using shell: ${shell}, cwd: ${cwd}`)

    try {
      // Get shell type for hook injection
      const shellHookManager = getShellHookManager()
      const shellType = shellHookManager.detectShell() || 'zsh' // Default to zsh

      console.log(`[TerminalManager] Detected shell type: ${shellType}`)
      console.log(`[TerminalManager] Shell path: ${shell}`)

      // Get environment with hooks injected
      let env: Record<string, string>
      let shellArgs: string[] = []
      let tempConfigDir: string | null = null

      try {
        tempConfigDir = await shellHookManager.createTempShellConfig(shellType)
        env = { ...process.env }

        if (shellType === 'zsh') {
          // For zsh, ZDOTDIR tells it where to find .zshrc
          env.ZDOTDIR = tempConfigDir
          console.log(`[TerminalManager] Set ZDOTDIR to: ${tempConfigDir}`)
        } else if (shellType === 'bash') {
          // For bash interactive shells, use --rcfile flag
          const rcPath = path.join(tempConfigDir, '.bashrc')
          shellArgs = ['--rcfile', rcPath]
          console.log(`[TerminalManager] Using bash --rcfile: ${rcPath}`)
        }

        console.log(`[TerminalManager] Injected shell hooks for ${shellType}`)
      } catch (error) {
        console.warn(`[TerminalManager] Failed to inject hooks, using default env:`, error)
        env = { ...process.env }
      }

      // Add Circuit-specific environment variables
      env.TERM_PROGRAM = 'Circuit'
      env.WORKSPACE_ID = workspaceId

      // Spawn PTY process with hooks-enabled environment
      console.log(`[TerminalManager] Spawning PTY with args:`, shellArgs)
      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd,
        env
      })

      // Handle PTY data output
      ptyProcess.onData((data: string) => {
        // Log if data contains OSC sequences (for debugging)
        if (data.includes('\x1b]1337')) {
          console.log('[TerminalManager] OSC sequence detected in PTY output')
          // Log the sequence type
          if (data.includes('BlockStart')) {
            console.log('[TerminalManager] → BlockStart marker found')
          }
          if (data.includes('BlockEnd')) {
            console.log('[TerminalManager] → BlockEnd marker found')
          }
          if (data.includes('BlockBoundary')) {
            console.log('[TerminalManager] → BlockBoundary marker found')
          }
        }
        this.emit('data', workspaceId, data)
      })

      // Handle PTY exit
      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`[TerminalManager] Session exited for workspace: ${workspaceId}, exitCode: ${exitCode}, signal: ${signal}`)
        this.sessions.delete(workspaceId)
        this.emit('exit', workspaceId, exitCode)
      })

      // Store session
      this.sessions.set(workspaceId, {
        ptyProcess,
        workspaceId,
        workspacePath: cwd,
        lastActivity: Date.now()
      })

      console.log(`[TerminalManager] Session created successfully for workspace: ${workspaceId}`)
    } catch (error) {
      console.error(`[TerminalManager] Failed to create session for workspace: ${workspaceId}`, error)
      throw error
    }
  }

  /**
   * Write data to a terminal session
   */
  writeData(workspaceId: string, data: string): void {
    console.log(`[TerminalManager] writeData called:`, {
      workspaceId,
      data: data.replace(/\n/g, '\\n'),
      dataLength: data.length,
      hasSession: this.sessions.has(workspaceId)
    })

    const session = this.sessions.get(workspaceId)
    if (!session) {
      console.error(`[TerminalManager] No session found for workspace: ${workspaceId}`)
      console.log(`[TerminalManager] Available sessions:`, Array.from(this.sessions.keys()))
      return
    }

    console.log(`[TerminalManager] Writing to PTY process...`)
    session.ptyProcess.write(data)
    session.lastActivity = Date.now()
    console.log(`[TerminalManager] Data written to PTY successfully`)
  }

  /**
   * Resize terminal window
   */
  resizeTerminal(workspaceId: string, cols: number, rows: number): void {
    const session = this.sessions.get(workspaceId)
    if (!session) {
      console.warn(`[TerminalManager] No session found for workspace: ${workspaceId}`)
      return
    }

    session.ptyProcess.resize(cols, rows)
    session.lastActivity = Date.now()
  }

  /**
   * Destroy a terminal session
   */
  destroySession(workspaceId: string): void {
    const session = this.sessions.get(workspaceId)
    if (!session) {
      console.log(`[TerminalManager] No session to destroy for workspace: ${workspaceId}`)
      return
    }

    console.log(`[TerminalManager] Destroying session for workspace: ${workspaceId}`)
    try {
      session.ptyProcess.kill()
    } catch (error) {
      console.error(`[TerminalManager] Error killing PTY process:`, error)
    }

    this.sessions.delete(workspaceId)
  }

  /**
   * Check if session exists for workspace
   */
  hasSession(workspaceId: string): boolean {
    return this.sessions.has(workspaceId)
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys())
  }

  /**
   * Destroy all sessions (on app quit)
   */
  destroyAllSessions(): void {
    console.log(`[TerminalManager] Destroying all sessions (${this.sessions.size} total)`)

    for (const workspaceId of this.sessions.keys()) {
      this.destroySession(workspaceId)
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Get appropriate shell for current platform
   */
  private getShell(): string {
    const platform = process.platform

    if (platform === 'win32') {
      return process.env.SHELL || 'powershell.exe'
    }

    // Try common shells in order of preference
    const shells = ['zsh', 'bash', 'sh']
    const shellPath = process.env.SHELL

    // If SHELL env var is set, try to use it
    if (shellPath) {
      try {
        fs.accessSync(shellPath, fs.constants.X_OK)
        return shellPath
      } catch (error) {
        console.warn(`[TerminalManager] SHELL env var points to inaccessible shell: ${shellPath}`)
      }
    }

    // Try each shell
    for (const shell of shells) {
      try {
        const shellPath = `/bin/${shell}`
        fs.accessSync(shellPath, fs.constants.X_OK)
        return shellPath
      } catch (error) {
        // Continue to next shell
      }
    }

    // Fallback to sh
    return 'sh'
  }

  /**
   * Start periodic cleanup of inactive sessions
   */
  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions()
    }, 5 * 60 * 1000)
  }

  /**
   * Clean up inactive sessions (optional feature)
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now()
    const inactiveSessions: string[] = []

    for (const [workspaceId, session] of this.sessions) {
      if (now - session.lastActivity > this.inactivityTimeout) {
        inactiveSessions.push(workspaceId)
      }
    }

    if (inactiveSessions.length > 0) {
      console.log(`[TerminalManager] Cleaning up ${inactiveSessions.length} inactive sessions`)
      for (const workspaceId of inactiveSessions) {
        this.destroySession(workspaceId)
      }
    }
  }
}

// Singleton instance
let terminalManager: TerminalManager | null = null

export function getTerminalManager(): TerminalManager {
  if (!terminalManager) {
    terminalManager = new TerminalManager()
  }
  return terminalManager
}
