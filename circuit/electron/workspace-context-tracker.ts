/**
 * Simplified Workspace Context Tracker
 *
 * Design principles:
 * - Single watcher per workspace (no multi-layer complexity)
 * - Incremental file reading (tail -f pattern)
 * - Built-in readline for JSONL parsing
 * - Proper async cleanup
 * - Battle-tested patterns from production systems
 */

import * as chokidar from 'chokidar';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { homedir } from 'os';
import { EventEmitter } from 'events';
import { ContextTracker, ContextMetrics } from './context-tracker.js';

interface WatcherState {
  fileWatcher?: chokidar.FSWatcher;
  directoryWatcher?: chokidar.FSWatcher;
  conversationPath?: string;
  lastPosition: number;
}

export class WorkspaceContextTracker extends EventEmitter {
  private contextTracker: ContextTracker;
  private watchers = new Map<string, WatcherState>();

  constructor() {
    super();
    this.contextTracker = new ContextTracker();
  }

  /**
   * Convert workspace path to Claude Code session directory name
   * /Users/williamjung/conductor/circuit-1/.conductor/vienna
   * → -Users-williamjung-conductor-circuit-1--conductor-vienna
   *
   * Note: Both / and . are converted to -
   */
  private pathToSessionDir(workspacePath: string): string {
    // Replace / and . with -, which naturally creates leading - from the initial /
    return workspacePath.replace(/[/.]/g, '-');
  }

  /**
   * Find the most recently active conversation file
   * Uses file modification time for reliability and performance
   */
  private async findActiveConversation(sessionDir: string): Promise<string | null> {
    try {
      const dirExists = await fs.access(sessionDir).then(() => true).catch(() => false);
      if (!dirExists) {
        return null;
      }

      const files = await fs.readdir(sessionDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      if (jsonlFiles.length === 0) {
        return null;
      }

      let latestFile: string | null = null;
      let latestTime = 0;

      for (const file of jsonlFiles) {
        const filePath = path.join(sessionDir, file);
        try {
          const stats = await fs.stat(filePath);
          const mtime = stats.mtime.getTime();

          // Prefer main conversation files (UUID pattern) over agent files
          const isMainConversation = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/.test(file);
          const timeBoost = isMainConversation ? 1000 : 0;

          if (mtime + timeBoost > latestTime) {
            latestTime = mtime + timeBoost;
            latestFile = filePath;
          }
        } catch (error) {
          console.warn(`[WorkspaceContextTracker] Error checking ${file}:`, error);
          continue;
        }
      }

      return latestFile;
    } catch (error) {
      console.error(`[WorkspaceContextTracker] Error finding conversation:`, error);
      return null;
    }
  }

  /**
   * Read new lines from file using incremental reading (tail -f pattern)
   */
  private async readNewLines(filePath: string, lastPosition: number): Promise<string[]> {
    try {
      const stats = await fs.stat(filePath);

      // No new data
      if (stats.size <= lastPosition) {
        return [];
      }

      // File was truncated or rotated - read from beginning
      if (stats.size < lastPosition) {
        console.warn(`[WorkspaceContextTracker] File truncated or rotated, reading from start`);
        lastPosition = 0;
      }

      const stream = fsSync.createReadStream(filePath, {
        start: lastPosition,
        encoding: 'utf8'
      });

      const lines: string[] = [];
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (line.trim()) {
          lines.push(line);
        }
      }

      rl.close();
      return lines;
    } catch (error) {
      console.error(`[WorkspaceContextTracker] Error reading new lines:`, error);
      return [];
    }
  }

  /**
   * Watch a conversation file for changes
   */
  private async watchFile(workspaceId: string, filePath: string): Promise<void> {

    const state = this.watchers.get(workspaceId) || { lastPosition: 0 };

    // Stop existing file watcher if any
    if (state.fileWatcher) {
      await state.fileWatcher.close();
    }

    // Get initial file size
    try {
      const stats = await fs.stat(filePath);
      state.lastPosition = stats.size;
    } catch (error) {
      console.error(`[WorkspaceContextTracker] Error getting file size:`, error);
      state.lastPosition = 0;
    }

    // Create file watcher
    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true, // Don't trigger on initial add
      usePolling: false,   // Use native fs events
      awaitWriteFinish: {  // Wait for file writes to complete
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    watcher.on('change', async () => {
      try {
        const newLines = await this.readNewLines(filePath, state.lastPosition);

        if (newLines.length === 0) {
          return;
        }

        // Update position
        const stats = await fs.stat(filePath);
        state.lastPosition = stats.size;

        // Calculate context from entire file (context-tracker handles this efficiently)
        const context = await this.contextTracker.calculateContext(filePath);
        this.emit('context-updated', workspaceId, context);
      } catch (error) {
        console.error(`[WorkspaceContextTracker] Error processing file change:`, error);
      }
    });

    watcher.on('error', (error) => {
      console.error(`[WorkspaceContextTracker] File watcher error:`, error);
    });

    state.fileWatcher = watcher;
    state.conversationPath = filePath;
    this.watchers.set(workspaceId, state);

    // Calculate initial context
    try {
      const context = await this.contextTracker.calculateContext(filePath);
      this.emit('context-updated', workspaceId, context);
    } catch (error) {
      console.error(`[WorkspaceContextTracker] Error calculating initial context:`, error);
    }
  }

  /**
   * Watch directory for new conversation files
   */
  private watchDirectory(workspaceId: string, sessionDir: string): void {

    const state = this.watchers.get(workspaceId) || { lastPosition: 0 };

    const watcher = chokidar.watch(sessionDir, {
      persistent: true,
      ignoreInitial: true, // Don't scan existing files
      depth: 0,            // Only watch direct children
      usePolling: false
    });

    watcher.on('add', async (filePath) => {
      if (!filePath.endsWith('.jsonl')) {
        return;
      }

      // Stop directory watching
      await watcher.close();
      if (state.directoryWatcher === watcher) {
        state.directoryWatcher = undefined;
      }

      // Start file watching
      await this.watchFile(workspaceId, filePath);
    });

    watcher.on('error', (error) => {
      console.error(`[WorkspaceContextTracker] Directory watcher error:`, error);
    });

    state.directoryWatcher = watcher;
    this.watchers.set(workspaceId, state);
  }

  /**
   * Start tracking context for a workspace
   */
  async startTracking(workspaceId: string, workspacePath: string): Promise<ContextMetrics | null> {
    console.log(`[WorkspaceContextTracker] Starting tracking for: ${workspaceId}`);

    const sessionDirName = this.pathToSessionDir(workspacePath);
    const sessionDir = path.join(homedir(), '.claude', 'projects', sessionDirName);

    // Try to find existing conversation file
    const conversationPath = await this.findActiveConversation(sessionDir);

    if (conversationPath) {
      // File exists - start watching it
      await this.watchFile(workspaceId, conversationPath);

      try {
        return await this.contextTracker.calculateContext(conversationPath);
      } catch (error) {
        console.error(`[WorkspaceContextTracker] Error calculating context:`, error);
        return null;
      }
    }

    // No file yet - watch directory for new files
    console.log(`[WorkspaceContextTracker] No conversation file found, watching directory`);
    this.watchDirectory(workspaceId, sessionDir);
    this.emit('context-waiting', workspaceId);

    return null;
  }

  /**
   * Stop tracking context for a workspace
   */
  async stopTracking(workspaceId: string): Promise<void> {
    console.log(`[WorkspaceContextTracker] Stopping tracking for: ${workspaceId}`);

    const state = this.watchers.get(workspaceId);
    if (!state) {
      return;
    }

    // Close file watcher
    if (state.fileWatcher) {
      await state.fileWatcher.close();
    }

    // Close directory watcher
    if (state.directoryWatcher) {
      await state.directoryWatcher.close();
    }

    // Clear state
    this.watchers.delete(workspaceId);
  }

  /**
   * Get current context for a workspace (without starting tracking)
   */
  async getContext(workspaceId: string, workspacePath: string): Promise<ContextMetrics | null> {
    const sessionDirName = this.pathToSessionDir(workspacePath);
    const sessionDir = path.join(homedir(), '.claude', 'projects', sessionDirName);
    const conversationPath = await this.findActiveConversation(sessionDir);

    if (!conversationPath) {
      return null;
    }

    try {
      return await this.contextTracker.calculateContext(conversationPath);
    } catch (error) {
      console.error(`[WorkspaceContextTracker] Error getting context:`, error);
      return null;
    }
  }

  /**
   * Cleanup all watchers
   */
  async cleanup(): Promise<void> {
    const workspaceIds = Array.from(this.watchers.keys());
    await Promise.all(workspaceIds.map(id => this.stopTracking(id)));
  }
}
