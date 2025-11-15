/**
 * IPC Handlers for Browser Tab Management
 *
 * Provides WebContentsView-based browser functionality for browser tabs.
 * Allows the renderer process to create, manage, and destroy embedded browsers.
 */

import { ipcMain, BrowserWindow, WebContentsView } from 'electron'

// Console log interface
interface ConsoleLog {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug'
  message: string
  timestamp: number
  source?: string
  lineNumber?: number
}

// Store active WebContentsViews by browser ID
const browserViews = new Map<string, WebContentsView>()

// Store console logs by browser ID (keep last 100 logs per browser)
const consoleLogs = new Map<string, ConsoleLog[]>()
const MAX_LOGS_PER_BROWSER = 100

// Store main window reference
let mainWindowRef: BrowserWindow | null = null

/**
 * Initialize browser handlers with main window reference
 */
export function initializeBrowserHandlers(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow
  console.log('[BrowserHandlers] Initialized with main window')
}

/**
 * Register all browser IPC handlers
 */
export function registerBrowserHandlers(): void {
  // Create a new browser view
  ipcMain.handle(
    'browser:create',
    async (event, browserId: string, url: string): Promise<{ success: boolean; error?: string }> => {
      try {
        console.log(`[BrowserHandlers] Creating browser: ${browserId} for URL: ${url}`)

        if (!mainWindowRef) {
          throw new Error('Main window not initialized')
        }

        // Check if browser already exists
        if (browserViews.has(browserId)) {
          console.warn(`[BrowserHandlers] Browser ${browserId} already exists, destroying old one`)
          await destroyBrowser(browserId)
        }

        // Create WebContentsView
        const webContentsView = new WebContentsView({
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        })

        // Store reference
        browserViews.set(browserId, webContentsView)

        // Initialize console logs array for this browser
        consoleLogs.set(browserId, [])

        // Add to main window
        mainWindowRef.contentView.addChildView(webContentsView)

        // Set initial bounds (will be updated by renderer)
        webContentsView.setBounds({ x: 0, y: 0, width: 800, height: 600 })

        // Listen for console messages
        webContentsView.webContents.on('console-message', (event, level, message, line, sourceId) => {
          const logs = consoleLogs.get(browserId) || []

          const logEntry: ConsoleLog = {
            level: ['log', 'warn', 'error', 'info', 'debug'][level] as ConsoleLog['level'] || 'log',
            message,
            timestamp: Date.now(),
            source: sourceId,
            lineNumber: line,
          }

          logs.push(logEntry)

          // Keep only last MAX_LOGS_PER_BROWSER logs
          if (logs.length > MAX_LOGS_PER_BROWSER) {
            logs.shift()
          }

          consoleLogs.set(browserId, logs)

          // Log to main process console for debugging
          console.log(`[Browser ${browserId}] ${logEntry.level.toUpperCase()}: ${message}`)
        })

        // Load URL
        await webContentsView.webContents.loadURL(url)

        console.log(`[BrowserHandlers] Browser ${browserId} created successfully`)
        return { success: true }
      } catch (error: any) {
        console.error(`[BrowserHandlers] Error creating browser ${browserId}:`, error)
        return { success: false, error: error.message }
      }
    }
  )

  // Navigate browser to URL
  ipcMain.handle(
    'browser:navigate',
    async (event, browserId: string, url: string): Promise<{ success: boolean; error?: string }> => {
      try {
        console.log(`[BrowserHandlers] Navigating browser ${browserId} to: ${url}`)

        const view = browserViews.get(browserId)
        if (!view) {
          throw new Error(`Browser ${browserId} not found`)
        }

        await view.webContents.loadURL(url)

        console.log(`[BrowserHandlers] Browser ${browserId} navigated successfully`)
        return { success: true }
      } catch (error: any) {
        console.error(`[BrowserHandlers] Error navigating browser ${browserId}:`, error)
        return { success: false, error: error.message }
      }
    }
  )

  // Set browser bounds
  ipcMain.handle(
    'browser:set-bounds',
    async (
      event,
      browserId: string,
      bounds: { x: number; y: number; width: number; height: number }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const view = browserViews.get(browserId)
        if (!view) {
          throw new Error(`Browser ${browserId} not found`)
        }

        view.setBounds(bounds)

        return { success: true }
      } catch (error: any) {
        console.error(`[BrowserHandlers] Error setting bounds for browser ${browserId}:`, error)
        return { success: false, error: error.message }
      }
    }
  )

  // Get current URL
  ipcMain.handle(
    'browser:get-url',
    async (event, browserId: string): Promise<{ success: boolean; url?: string; error?: string }> => {
      try {
        const view = browserViews.get(browserId)
        if (!view) {
          throw new Error(`Browser ${browserId} not found`)
        }

        const url = view.webContents.getURL()

        return { success: true, url }
      } catch (error: any) {
        console.error(`[BrowserHandlers] Error getting URL for browser ${browserId}:`, error)
        return { success: false, error: error.message }
      }
    }
  )

  // Destroy browser view
  ipcMain.handle(
    'browser:destroy',
    async (event, browserId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        console.log(`[BrowserHandlers] Destroying browser: ${browserId}`)
        await destroyBrowser(browserId)
        return { success: true }
      } catch (error: any) {
        console.error(`[BrowserHandlers] Error destroying browser ${browserId}:`, error)
        return { success: false, error: error.message }
      }
    }
  )

  // Show browser view
  ipcMain.handle(
    'browser:show',
    async (event, browserId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const view = browserViews.get(browserId)
        if (!view) {
          throw new Error(`Browser ${browserId} not found`)
        }

        view.setVisible(true)

        return { success: true }
      } catch (error: any) {
        console.error(`[BrowserHandlers] Error showing browser ${browserId}:`, error)
        return { success: false, error: error.message }
      }
    }
  )

  // Hide browser view
  ipcMain.handle(
    'browser:hide',
    async (event, browserId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const view = browserViews.get(browserId)
        if (!view) {
          throw new Error(`Browser ${browserId} not found`)
        }

        view.setVisible(false)

        return { success: true }
      } catch (error: any) {
        console.error(`[BrowserHandlers] Error hiding browser ${browserId}:`, error)
        return { success: false, error: error.message }
      }
    }
  )

  // Get console logs for a browser
  ipcMain.handle(
    'browser:get-console-logs',
    async (
      event,
      browserId: string
    ): Promise<{ success: boolean; logs?: ConsoleLog[]; error?: string }> => {
      try {
        const logs = consoleLogs.get(browserId) || []
        console.log(`[BrowserHandlers] Retrieved ${logs.length} console logs for browser ${browserId}`)
        return { success: true, logs }
      } catch (error: any) {
        console.error(`[BrowserHandlers] Error getting console logs for browser ${browserId}:`, error)
        return { success: false, error: error.message }
      }
    }
  )

  // Clear console logs for a browser
  ipcMain.handle(
    'browser:clear-console-logs',
    async (event, browserId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        consoleLogs.set(browserId, [])
        console.log(`[BrowserHandlers] Cleared console logs for browser ${browserId}`)
        return { success: true }
      } catch (error: any) {
        console.error(`[BrowserHandlers] Error clearing console logs for browser ${browserId}:`, error)
        return { success: false, error: error.message }
      }
    }
  )

  // List all active browser IDs
  ipcMain.handle(
    'browser:list',
    async (event): Promise<{ success: boolean; browserIds?: string[]; error?: string }> => {
      try {
        const browserIds = Array.from(browserViews.keys())
        console.log(`[BrowserHandlers] Listed ${browserIds.length} active browsers`)
        return { success: true, browserIds }
      } catch (error: any) {
        console.error(`[BrowserHandlers] Error listing browsers:`, error)
        return { success: false, error: error.message }
      }
    }
  )

  console.log('[BrowserHandlers] Browser handlers registered')
}

/**
 * Helper function to destroy a browser view
 */
async function destroyBrowser(browserId: string): Promise<void> {
  const view = browserViews.get(browserId)
  if (!view) {
    console.warn(`[BrowserHandlers] Browser ${browserId} not found for destruction`)
    return
  }

  try {
    // Remove from main window
    if (mainWindowRef && mainWindowRef.contentView) {
      mainWindowRef.contentView.removeChildView(view)
    }

    // Remove from maps
    browserViews.delete(browserId)
    consoleLogs.delete(browserId)

    console.log(`[BrowserHandlers] Browser ${browserId} destroyed successfully`)
  } catch (error: any) {
    console.error(`[BrowserHandlers] Error during browser destruction:`, error)
    throw error
  }
}

/**
 * Clean up all browser views (call on app quit)
 */
export function cleanupBrowserViews(): void {
  console.log('[BrowserHandlers] Cleaning up all browser views')

  for (const [browserId, view] of browserViews.entries()) {
    try {
      if (mainWindowRef && mainWindowRef.contentView) {
        mainWindowRef.contentView.removeChildView(view)
      }
    } catch (error) {
      console.error(`[BrowserHandlers] Error cleaning up browser ${browserId}:`, error)
    }
  }

  browserViews.clear()
  consoleLogs.clear()
  console.log('[BrowserHandlers] All browser views cleaned up')
}
