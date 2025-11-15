/**
 * IPC Handlers for Browser Tab Management
 *
 * Provides WebContentsView-based browser functionality for browser tabs.
 * Allows the renderer process to create, manage, and destroy embedded browsers.
 */

import { ipcMain, BrowserWindow, WebContentsView } from 'electron'

// Store active WebContentsViews by browser ID
const browserViews = new Map<string, WebContentsView>()

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

        // Add to main window
        mainWindowRef.contentView.addChildView(webContentsView)

        // Set initial bounds (will be updated by renderer)
        webContentsView.setBounds({ x: 0, y: 0, width: 800, height: 600 })

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

    // Remove from map
    browserViews.delete(browserId)

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
  console.log('[BrowserHandlers] All browser views cleaned up')
}
