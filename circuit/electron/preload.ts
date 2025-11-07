/**
 * Preload Script
 *
 * Safely exposes Electron IPC to the renderer process using contextBridge.
 * This allows us to enable contextIsolation and disable nodeIntegration for security.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Define the API that will be exposed to the renderer
const electronAPI = {
  ipcRenderer: {
    /**
     * Send a message to the main process
     */
    send(channel: string, ...args: any[]): void {
      ipcRenderer.send(channel, ...args);
    },

    /**
     * Listen for messages from the main process
     * Returns a cleanup function to remove the listener
     */
    on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): () => void {
      const subscription = (event: IpcRendererEvent, ...args: any[]) => {
        listener(event, ...args);
      };
      ipcRenderer.on(channel, subscription);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },

    /**
     * Remove a listener for a channel
     */
    removeListener(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void {
      ipcRenderer.removeListener(channel, listener);
    },

    /**
     * Invoke a handler in the main process and wait for the result
     */
    invoke(channel: string, ...args: any[]): Promise<any> {
      return ipcRenderer.invoke(channel, ...args);
    },
  },

  /**
   * File system operations (safe wrappers around IPC)
   */
  fs: {
    readFile(filePath: string): Promise<string> {
      return ipcRenderer.invoke('read-file', filePath);
    },

    readDirectory(dirPath: string): Promise<string[]> {
      return ipcRenderer.invoke('read-directory', dirPath);
    },

    fileExists(filePath: string): Promise<boolean> {
      return ipcRenderer.invoke('file-exists', filePath);
    },

    directoryExists(dirPath: string): Promise<boolean> {
      return ipcRenderer.invoke('directory-exists', dirPath);
    },

    writeFile(filePath: string, content: string): Promise<void> {
      return ipcRenderer.invoke('write-file', filePath, content);
    },

    deleteFile(filePath: string): Promise<void> {
      return ipcRenderer.invoke('delete-file', filePath);
    },

    createDirectory(dirPath: string): Promise<void> {
      return ipcRenderer.invoke('create-directory', dirPath);
    },
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);

// Also expose process.platform for platform detection
contextBridge.exposeInMainWorld('platform', process.platform);

// Log successful preload
console.log('✅ Preload script loaded successfully with contextBridge');
