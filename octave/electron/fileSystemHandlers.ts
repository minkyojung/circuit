/**
 * IPC Handlers for File System Operations
 *
 * Provides file system access to the renderer process for project detection,
 * configuration management, and other file operations.
 */

import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Register all file system IPC handlers
 */
export function registerFileSystemHandlers(): void {
  // Check if file exists
  ipcMain.handle('file-exists', async (event, filePath: string): Promise<boolean> => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  // Check if directory exists
  ipcMain.handle('directory-exists', async (event, dirPath: string): Promise<boolean> => {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  });

  // Read file content
  ipcMain.handle('read-file', async (event, filePath: string): Promise<string> => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error: any) {
      console.error(`[FileSystemHandlers] Error reading file ${filePath}:`, error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  });

  // Write file content
  ipcMain.handle(
    'write-file',
    async (event, filePath: string, content: string): Promise<void> => {
      try {
        // Ensure parent directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Write file
        await fs.writeFile(filePath, content, 'utf-8');
      } catch (error: any) {
        console.error(`[FileSystemHandlers] Error writing file ${filePath}:`, error);
        throw new Error(`Failed to write file: ${error.message}`);
      }
    }
  );

  // Delete file
  ipcMain.handle('delete-file', async (event, filePath: string): Promise<void> => {
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      console.error(`[FileSystemHandlers] Error deleting file ${filePath}:`, error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  });

  // Create directory (recursive)
  ipcMain.handle('create-directory', async (event, dirPath: string): Promise<void> => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      console.error(`[FileSystemHandlers] Error creating directory ${dirPath}:`, error);
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  });

  // Read directory contents
  ipcMain.handle('read-directory', async (event, dirPath: string): Promise<string[]> => {
    try {
      const entries = await fs.readdir(dirPath);
      return entries;
    } catch (error: any) {
      console.error(`[FileSystemHandlers] Error reading directory ${dirPath}:`, error);
      throw new Error(`Failed to read directory: ${error.message}`);
    }
  });

  // Read directory with file info
  ipcMain.handle(
    'read-directory-detailed',
    async (
      event,
      dirPath: string
    ): Promise<Array<{ name: string; isDirectory: boolean; size: number }>> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        const detailedEntries = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = path.join(dirPath, entry.name);
            let size = 0;

            try {
              const stats = await fs.stat(fullPath);
              size = stats.size;
            } catch {
              // Ignore stat errors
            }

            return {
              name: entry.name,
              isDirectory: entry.isDirectory(),
              size,
            };
          })
        );

        return detailedEntries;
      } catch (error: any) {
        console.error(`[FileSystemHandlers] Error reading directory ${dirPath}:`, error);
        throw new Error(`Failed to read directory: ${error.message}`);
      }
    }
  );

  // Get file stats
  ipcMain.handle(
    'file-stats',
    async (
      event,
      filePath: string
    ): Promise<{
      size: number;
      isDirectory: boolean;
      isFile: boolean;
      mtime: string;
      ctime: string;
    }> => {
      try {
        const stats = await fs.stat(filePath);

        return {
          size: stats.size,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          mtime: stats.mtime.toISOString(),
          ctime: stats.ctime.toISOString(),
        };
      } catch (error: any) {
        console.error(`[FileSystemHandlers] Error getting stats for ${filePath}:`, error);
        throw new Error(`Failed to get file stats: ${error.message}`);
      }
    }
  );

  // Copy file
  ipcMain.handle(
    'copy-file',
    async (event, sourcePath: string, destPath: string): Promise<void> => {
      try {
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        await fs.mkdir(destDir, { recursive: true });

        // Copy file
        await fs.copyFile(sourcePath, destPath);
      } catch (error: any) {
        console.error(
          `[FileSystemHandlers] Error copying file ${sourcePath} to ${destPath}:`,
          error
        );
        throw new Error(`Failed to copy file: ${error.message}`);
      }
    }
  );

  // Move/rename file
  ipcMain.handle(
    'move-file',
    async (event, sourcePath: string, destPath: string): Promise<void> => {
      try {
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        await fs.mkdir(destDir, { recursive: true });

        // Move file
        await fs.rename(sourcePath, destPath);
      } catch (error: any) {
        console.error(
          `[FileSystemHandlers] Error moving file ${sourcePath} to ${destPath}:`,
          error
        );
        throw new Error(`Failed to move file: ${error.message}`);
      }
    }
  );

  console.log('[FileSystemHandlers] File system handlers registered');
}
