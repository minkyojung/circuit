/**
 * Logging System
 *
 * Centralized logging for debugging, monitoring, and error tracking.
 * Supports multiple log levels and can write to console and file.
 */

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const

export type LogLevel = typeof LogLevel[keyof typeof LogLevel]

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: number
  meta?: any
  error?: Error
}

class Logger {
  private currentLevel: LogLevel = LogLevel.INFO
  private logs: LogEntry[] = []
  private readonly MAX_LOGS = 1000 // Keep last 1000 logs in memory

  setLevel(level: LogLevel): void {
    this.currentLevel = level
  }

  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, message, meta)
  }

  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, message, meta)
  }

  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, message, meta)
  }

  error(message: string, error?: Error, meta?: any): void {
    this.log(LogLevel.ERROR, message, { ...meta, error })
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (level < this.currentLevel) {
      return // Skip logs below current level
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      meta,
    }

    // Store in memory (with size limit)
    this.logs.push(entry)
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift()
    }

    // Console output with colors
    const levelName = level === LogLevel.DEBUG ? 'DEBUG'
      : level === LogLevel.INFO ? 'INFO'
      : level === LogLevel.WARN ? 'WARN'
      : 'ERROR'
    const timestamp = new Date(entry.timestamp).toISOString()
    const prefix = `[${timestamp}] [${levelName}]`

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, meta)
        break
      case LogLevel.INFO:
        console.log(prefix, message, meta)
        break
      case LogLevel.WARN:
        console.warn(prefix, message, meta)
        break
      case LogLevel.ERROR:
        console.error(prefix, message, meta)
        break
    }

    // Send to Electron main process for file writing (if available)
    if (typeof window !== 'undefined' && (window as any).electron) {
      try {
        const { ipcRenderer } = (window as any).require('electron')
        ipcRenderer.send('octave:log', entry)
      } catch (error) {
        // Ignore if Electron is not available (e.g., in tests)
      }
    }
  }

  /**
   * Get recent logs (for debugging UI)
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count)
  }

  /**
   * Clear all in-memory logs
   */
  clear(): void {
    this.logs = []
  }
}

// Singleton instance
export const logger = new Logger()

// Set to DEBUG in development (safe check for import.meta)
if (import.meta.env?.DEV) {
  logger.setLevel(LogLevel.DEBUG)
}
