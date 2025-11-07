/**
 * Vitest setup file
 * Runs before all tests
 */

import { vi } from 'vitest'

// Mock Electron's ipcRenderer
const ipcRendererMock = {
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  send: vi.fn(),
  invoke: vi.fn(),
  sendSync: vi.fn(),
}

// Make ipcRenderer available globally
global.window = global.window || {}
;(global.window as any).electron = {
  ipcRenderer: ipcRendererMock,
}

// Mock window.require for Electron modules
;(global.window as any).require = vi.fn((moduleName: string) => {
  if (moduleName === 'electron') {
    return { ipcRenderer: ipcRendererMock }
  }
  return {}
})

// Export for use in tests
export { ipcRendererMock }
