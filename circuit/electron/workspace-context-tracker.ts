/**
 * Workspace Context Tracker
 * Tracks context metrics for individual workspaces
 */

import * as chokidar from 'chokidar';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { EventEmitter } from 'events';
import { ContextTracker, ContextMetrics } from './context-tracker.js';

export class WorkspaceContextTracker extends EventEmitter {
  private contextTracker: ContextTracker;
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private conversationPaths: Map<string, string> = new Map(); // workspaceId → conversation.jsonl path

  constructor() {
    super();
    this.contextTracker = new ContextTracker();
  }

  /**
   * Convert workspace path to Claude Code session directory name
   * /Users/williamjung/conductor/circuit-1/.conductor/vienna
   * → -Users-williamjung-conductor-circuit-1--conductor-vienna
   */
  private pathToSessionDir(workspacePath: string): string {
    return '-' + workspacePath.replace(/\//g, '-');
  }

  /**
   * Find the most recently active conversation file in a session directory
   */
  private async findActiveConversation(sessionDirName: string): Promise<string | null> {
    const sessionDir = path.join(homedir(), '.claude', 'projects', sessionDirName);

    try {
      const dirExists = await fs.access(sessionDir).then(() => true).catch(() => false);
      if (!dirExists) {
        console.warn(`[WorkspaceContextTracker] Session dir not found: ${sessionDir}`);
        return null;
      }

      const files = await fs.readdir(sessionDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      if (jsonlFiles.length === 0) {
        console.warn(`[WorkspaceContextTracker] No conversation files in ${sessionDir}`);
        return null;
      }

      let latestFile: string | null = null;
      let latestTime = 0;

      for (const file of jsonlFiles) {
        const filePath = path.join(sessionDir, file);

        try {
          // Performance: only read last 8KB of file
          const stats = await fs.stat(filePath);
          const readSize = Math.min(8192, stats.size);

          const handle = await fs.open(filePath, 'r');
          const buffer = Buffer.alloc(readSize);
          await handle.read(buffer, 0, readSize, stats.size - readSize);
          await handle.close();

          const content = buffer.toString('utf-8');
          const lines = content.trim().split('\n').filter(l => l.length > 0);

          if (lines.length === 0) continue;

          const lastLine = lines[lines.length - 1];
          const lastEvent = JSON.parse(lastLine);
          const eventTime = new Date(lastEvent.timestamp).getTime();

          if (eventTime > latestTime) {
            latestTime = eventTime;
            latestFile = filePath;
          }
        } catch (error) {
          console.warn(`[WorkspaceContextTracker] Error reading ${file}:`, error);
          continue;
        }
      }

      return latestFile;
    } catch (error) {
      console.error(`[WorkspaceContextTracker] Error finding active conversation:`, error);
      return null;
    }
  }

  /**
   * Start tracking context for a workspace
   */
  async startTracking(workspaceId: string, workspacePath: string): Promise<ContextMetrics | null> {
    console.log(`[WorkspaceContextTracker] Starting tracking for ${workspaceId}`);

    // 1. Convert path to session directory name
    const sessionDirName = this.pathToSessionDir(workspacePath);
    console.log(`[WorkspaceContextTracker] Session dir: ${sessionDirName}`);

    // 2. Find active conversation file
    const conversationPath = await this.findActiveConversation(sessionDirName);

    if (!conversationPath) {
      console.warn(`[WorkspaceContextTracker] No active conversation for workspace ${workspaceId}`);
      return null;
    }

    console.log(`[WorkspaceContextTracker] Found conversation: ${conversationPath}`);

    this.conversationPaths.set(workspaceId, conversationPath);

    // 3. Start file watcher
    const watcher = chokidar.watch(conversationPath, {
      persistent: true,
      ignoreInitial: false
    });

    watcher.on('change', async () => {
      try {
        const context = await this.contextTracker.calculateContext(conversationPath);
        this.emit('context-updated', workspaceId, context);
      } catch (error) {
        console.error(`[WorkspaceContextTracker] Error calculating context:`, error);
      }
    });

    watcher.on('error', (error) => {
      console.error(`[WorkspaceContextTracker] Watcher error for ${workspaceId}:`, error);
    });

    this.watchers.set(workspaceId, watcher);

    // 4. Calculate initial context
    try {
      return await this.contextTracker.calculateContext(conversationPath);
    } catch (error) {
      console.error(`[WorkspaceContextTracker] Error calculating initial context:`, error);
      return null;
    }
  }

  /**
   * Stop tracking context for a workspace
   */
  async stopTracking(workspaceId: string): Promise<void> {
    console.log(`[WorkspaceContextTracker] Stopping tracking for ${workspaceId}`);

    const watcher = this.watchers.get(workspaceId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(workspaceId);
    }

    this.conversationPaths.delete(workspaceId);
  }

  /**
   * Get current context for a workspace (without starting tracking)
   */
  async getContext(workspaceId: string, workspacePath: string): Promise<ContextMetrics | null> {
    const sessionDirName = this.pathToSessionDir(workspacePath);
    const conversationPath = await this.findActiveConversation(sessionDirName);

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
    const promises = Array.from(this.watchers.keys()).map(id => this.stopTracking(id));
    await Promise.all(promises);
  }
}
