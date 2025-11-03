/**
 * Git IPC Handlers
 *
 * Provides git operations for the Git Panel UI
 */

import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * File status types from git
 */
export type FileStatus = 'M' | 'A' | 'D' | 'R' | '?';

/**
 * Git file change
 */
export interface GitFileChange {
  path: string;
  status: FileStatus;
}

/**
 * Complete git status
 */
export interface GitStatus {
  currentBranch: string;
  remoteBranch: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: GitFileChange[];
}

/**
 * Parse git status output
 * Format: "M\tfile.ts" or "A\tfile.ts"
 */
function parseGitStatus(output: string): GitFileChange[] {
  if (!output.trim()) return [];

  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const parts = line.split('\t');
      const status = parts[0].trim() as FileStatus;
      const path = parts.slice(1).join('\t');

      return {
        status,
        path
      };
    });
}

/**
 * Get git status for workspace
 */
ipcMain.handle('git:status', async (event, workspacePath: string) => {
  try {
    console.log('[Git] Getting status for:', workspacePath);

    // Current branch
    const { stdout: branch } = await execAsync('git branch --show-current', { cwd: workspacePath });

    // Staged files (cached = staged)
    const { stdout: staged } = await execAsync('git diff --cached --name-status', { cwd: workspacePath });

    // Unstaged files (modified but not staged)
    const { stdout: unstaged } = await execAsync('git diff --name-status', { cwd: workspacePath });

    // Untracked files
    const { stdout: untracked } = await execAsync('git ls-files --others --exclude-standard', { cwd: workspacePath });

    // Remote tracking branch
    let remoteBranch = '';
    let ahead = 0;
    let behind = 0;

    try {
      const { stdout: remote } = await execAsync('git rev-parse --abbrev-ref @{upstream}', { cwd: workspacePath });
      remoteBranch = remote.trim();

      // Commits ahead of remote
      const { stdout: aheadCount } = await execAsync('git rev-list --count @{upstream}..HEAD', { cwd: workspacePath });
      ahead = parseInt(aheadCount.trim()) || 0;

      // Commits behind remote
      const { stdout: behindCount } = await execAsync('git rev-list --count HEAD..@{upstream}', { cwd: workspacePath });
      behind = parseInt(behindCount.trim()) || 0;
    } catch (e) {
      // No upstream branch configured - that's okay
      console.log('[Git] No upstream branch configured');
    }

    const status: GitStatus = {
      currentBranch: branch.trim(),
      remoteBranch,
      ahead,
      behind,
      staged: parseGitStatus(staged),
      unstaged: parseGitStatus(unstaged),
      untracked: untracked.trim().split('\n').filter(Boolean).map(path => ({
        path,
        status: '?' as const
      }))
    };

    console.log('[Git] Status retrieved:', {
      branch: status.currentBranch,
      staged: status.staged.length,
      unstaged: status.unstaged.length,
      untracked: status.untracked.length
    });

    return { success: true, status };
  } catch (error) {
    console.error('[Git] Failed to get status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Stage a file
 */
ipcMain.handle('git:stage', async (event, workspacePath: string, filePath: string) => {
  try {
    console.log('[Git] Staging file:', filePath);
    await execAsync(`git add "${filePath}"`, { cwd: workspacePath });
    return { success: true };
  } catch (error) {
    console.error('[Git] Failed to stage file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Unstage a file
 */
ipcMain.handle('git:unstage', async (event, workspacePath: string, filePath: string) => {
  try {
    console.log('[Git] Unstaging file:', filePath);
    await execAsync(`git reset HEAD "${filePath}"`, { cwd: workspacePath });
    return { success: true };
  } catch (error) {
    console.error('[Git] Failed to unstage file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Stage all changes
 */
ipcMain.handle('git:stage-all', async (event, workspacePath: string) => {
  try {
    console.log('[Git] Staging all changes');
    await execAsync('git add .', { cwd: workspacePath });
    return { success: true };
  } catch (error) {
    console.error('[Git] Failed to stage all:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Unstage all changes
 */
ipcMain.handle('git:unstage-all', async (event, workspacePath: string) => {
  try {
    console.log('[Git] Unstaging all changes');
    await execAsync('git reset HEAD', { cwd: workspacePath });
    return { success: true };
  } catch (error) {
    console.error('[Git] Failed to unstage all:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Register all git handlers
 */
export function registerGitHandlers() {
  console.log('[Git] Handlers registered');
}
