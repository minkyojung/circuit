/**
 * Electron IPC Type Definitions
 */

interface ElectronIpcRenderer {
  send(channel: string, ...args: any[]): void
  on(channel: string, listener: (event: any, ...args: any[]) => void): () => void
  removeListener(channel: string, listener: (event: any, ...args: any[]) => void): void
  invoke(channel: string, ...args: any[]): Promise<any>
}

interface ElectronFileSystem {
  readFile(filePath: string): Promise<string>
  readDirectory(dirPath: string): Promise<string[]>
  fileExists(filePath: string): Promise<boolean>
  directoryExists(dirPath: string): Promise<boolean>
  writeFile(filePath: string, content: string): Promise<void>
  deleteFile(filePath: string): Promise<void>
  createDirectory(dirPath: string): Promise<void>
}

interface DevTools {
  resetGitHubOnboarding(): void
  resetOnboarding(): void
  resetAllOnboarding(): void
  resetAndReload(): void
  clearGitHubToken(): Promise<void>
  resetEverything(): Promise<void>
  showOnboardingStatus(): Promise<void>
  help(): void
}

interface Window {
  electron: {
    ipcRenderer: ElectronIpcRenderer
    fs: ElectronFileSystem
  }
  platform: string
  devTools: DevTools
}
