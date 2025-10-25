/**
 * Electron IPC Type Definitions
 */

interface ElectronIpcRenderer {
  send(channel: string, ...args: any[]): void
  on(channel: string, listener: (event: any, ...args: any[]) => void): void
  removeListener(channel: string, listener: (event: any, ...args: any[]) => void): void
  invoke(channel: string, ...args: any[]): Promise<any>
}

interface Window {
  electron?: {
    ipcRenderer: ElectronIpcRenderer
  }
}
