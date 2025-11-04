/**
 * Agent Worker - MVP Version
 *
 * Executes a single Todo in the background using Claude CLI
 * Phase 1: Basic execution only (no stream parsing yet)
 */

import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

// Types
export interface AgentContext {
  conversationId: string
  workspacePath: string
  instruction: string
  relevantFiles: string[]
}

export interface AgentResult {
  success: boolean
  summary: string
  filesModified: string[]
  filesCreated: string[]
  duration: number
  tokens?: number
  cost?: number
}

export interface AgentStatus {
  todoId: string
  state: 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  currentTask: string
  startedAt: number
  duration: number
  error?: string
}

// Constants
const CLAUDE_CLI_PATH = path.join(os.homedir(), '.claude/local/claude')

/**
 * Agent Worker
 *
 * Spawns Claude CLI and executes a task
 */
export class AgentWorker {
  private todoId: string
  private context: AgentContext
  private claudeProcess: ChildProcess | null = null
  private progress = 0
  private currentTask = 'Initializing...'
  private startTime = 0
  private fullOutput = ''
  private cancelled = false

  constructor(todoId: string, context: AgentContext) {
    this.todoId = todoId
    this.context = context
  }

  /**
   * Execute the agent
   * Phase 1: Basic execution, no stream parsing
   */
  async execute(): Promise<AgentResult> {
    this.startTime = Date.now()
    console.log(`[AgentWorker] Executing todo: ${this.todoId}`)

    // Validate workspace path (security: prevent command injection)
    const resolvedPath = path.resolve(this.context.workspacePath)
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Invalid workspace path: ${this.context.workspacePath}`)
    }
    if (!fs.statSync(resolvedPath).isDirectory()) {
      throw new Error(`Workspace path is not a directory: ${this.context.workspacePath}`)
    }

    // Sanitize instruction (remove control characters)
    const sanitizedInstruction = this.context.instruction.replace(/[\x00-\x1F\x7F]/g, '')
    if (sanitizedInstruction.trim().length === 0) {
      throw new Error('Instruction cannot be empty after sanitization')
    }

    // Store sanitized instruction
    this.context.instruction = sanitizedInstruction

    return new Promise((resolve, reject) => {
      try {
        // Spawn Claude CLI
        this.claudeProcess = spawn(CLAUDE_CLI_PATH, [
          '--print',
          '--verbose',
          '--output-format', 'stream-json',
          '--include-partial-messages',
          '--model', 'sonnet',
          '--permission-mode', 'acceptEdits'
        ], {
          cwd: resolvedPath,  // Use validated path
          stdio: ['pipe', 'pipe', 'pipe']
        })

        // Build minimal context
        const input = this.buildMinimalContext()
        this.claudeProcess.stdin.write(JSON.stringify(input))
        this.claudeProcess.stdin.end()

        // Collect stdout
        this.claudeProcess.stdout.on('data', (data: Buffer) => {
          this.fullOutput += data.toString()
          console.log(`[AgentWorker] stdout chunk: ${data.length} bytes`)
        })

        // Collect stderr
        let stderrBuffer = ''
        this.claudeProcess.stderr.on('data', (data: Buffer) => {
          stderrBuffer += data.toString()
          console.error(`[AgentWorker] stderr: ${data}`)
        })

        // Handle completion
        this.claudeProcess.on('close', (code: number) => {
          if (this.cancelled) {
            reject(new Error('Agent was cancelled'))
            return
          }

          if (code !== 0) {
            reject(new Error(`Claude CLI exited with code ${code}: ${stderrBuffer}`))
            return
          }

          const duration = Date.now() - this.startTime
          console.log(`[AgentWorker] Completed in ${duration}ms`)

          // Phase 1: Simple result
          resolve({
            success: true,
            summary: this.extractSummary(),
            filesModified: [],  // TODO: Parse from output
            filesCreated: [],   // TODO: Parse from output
            duration
          })
        })

        // Handle errors
        this.claudeProcess.on('error', (error: Error) => {
          reject(new Error(`Failed to spawn Claude CLI: ${error.message}`))
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Build minimal context for Claude
   * Phase 1: Simple instruction only
   */
  private buildMinimalContext(): { role: string; content: string } {
    let content = `You are a helpful coding assistant working on a specific task.

**Your task**:
${this.context.instruction}

**Working directory**: ${this.context.workspacePath}

${this.context.relevantFiles.length > 0 ? `**Relevant files** (you may want to read these):
${this.context.relevantFiles.map(f => `- ${f}`).join('\n')}
` : ''}

**Instructions**:
1. Complete the task as described
2. Be concise and focused on this specific task only
3. When done, provide a brief summary of what you did

Start working on the task now.`

    return {
      role: 'user',
      content
    }
  }

  /**
   * Extract summary from output
   * Phase 1: Simple extraction
   */
  private extractSummary(): string {
    // Take first 300 chars as summary
    const preview = this.fullOutput.substring(0, 300)
    return preview + (this.fullOutput.length > 300 ? '...' : '')
  }

  /**
   * Cancel the agent
   */
  cancel(): void {
    console.log(`[AgentWorker] Cancelling todo: ${this.todoId}`)
    this.cancelled = true

    if (this.claudeProcess) {
      // Remove all listeners first to prevent memory leaks
      this.claudeProcess.stdout?.removeAllListeners()
      this.claudeProcess.stderr?.removeAllListeners()
      this.claudeProcess.removeAllListeners()

      // Then kill the process
      this.claudeProcess.kill('SIGTERM')

      // Force kill after 5 seconds if still running
      const process = this.claudeProcess
      setTimeout(() => {
        if (process && !process.killed) {
          console.log(`[AgentWorker] Force killing process for todo: ${this.todoId}`)
          process.kill('SIGKILL')
        }
      }, 5000)

      this.claudeProcess = null
    }
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return {
      todoId: this.todoId,
      state: 'running',
      progress: this.progress,
      currentTask: this.currentTask,
      startedAt: this.startTime,
      duration: Date.now() - this.startTime
    }
  }
}
