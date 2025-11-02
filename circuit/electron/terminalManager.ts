import * as pty from 'node-pty'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'

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
      // Spawn PTY process
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd,
        env: {
          ...process.env,
          TERM_PROGRAM: 'Conductor',
          WORKSPACE_ID: workspaceId,
        }
      })

      // Handle PTY data output
      ptyProcess.onData((data: string) => {
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
    const session = this.sessions.get(workspaceId)
    if (!session) {
      console.warn(`[TerminalManager] No session found for workspace: ${workspaceId}`)
      return
    }

    session.ptyProcess.write(data)
    session.lastActivity = Date.now()
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
