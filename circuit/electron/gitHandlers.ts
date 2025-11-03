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
 * Commit staged changes
 */
ipcMain.handle('git:commit', async (event, workspacePath: string, message: string) => {
  try {
    console.log('[Git] Committing with message:', message);

    // Escape quotes in commit message
    const escapedMessage = message.replace(/"/g, '\\"');

    await execAsync(`git commit -m "${escapedMessage}"`, { cwd: workspacePath });
    return { success: true };
  } catch (error: any) {
    console.error('[Git] Failed to commit:', error);

    // Extract detailed error message from stderr or stdout
    const errorMessage = error.stderr || error.stdout || error.message || 'Unknown error';

    return {
      success: false,
      error: errorMessage
    };
  }
});

/**
 * Commit and push staged changes
 */
ipcMain.handle('git:commit-and-push', async (event, workspacePath: string, message: string) => {
  try {
    console.log('[Git] Committing and pushing with message:', message);

    // Escape quotes in commit message
    const escapedMessage = message.replace(/"/g, '\\"');

    // Commit
    await execAsync(`git commit -m "${escapedMessage}"`, { cwd: workspacePath });

    // Get current branch name
    const { stdout: branch } = await execAsync('git branch --show-current', { cwd: workspacePath });
    const branchName = branch.trim();

    // Push with upstream tracking (-u sets upstream if not exists)
    await execAsync(`git push -u origin ${branchName}`, { cwd: workspacePath });

    return { success: true };
  } catch (error: any) {
    console.error('[Git] Failed to commit and push:', error);

    // Extract detailed error message from stderr or stdout
    const errorMessage = error.stderr || error.stdout || error.message || 'Unknown error';

    return {
      success: false,
      error: errorMessage
    };
  }
});

/**
 * Generate commit message using Claude CLI
 */
ipcMain.handle('git:generate-commit-message', async (event, workspacePath: string) => {
  try {
    console.log('[Git] Generating commit message with AI');

    // Get staged diff
    const { stdout: diff } = await execAsync('git diff --cached', { cwd: workspacePath });

    if (!diff.trim()) {
      return {
        success: false,
        error: 'No staged changes to analyze'
      };
    }

    // Get Claude CLI path (same as used in main.cjs)
    const { homedir } = await import('os');
    const { join } = await import('path');
    const CLAUDE_CLI_PATH = join(homedir(), '.claude', 'local', 'claude');

    // Check if Claude CLI exists
    try {
      await import('fs/promises').then(fs => fs.access(CLAUDE_CLI_PATH));
    } catch {
      return {
        success: false,
        error: 'Claude CLI not found. Please install Claude Code first.'
      };
    }

    // Prepare prompt
    const prompt = `Analyze this git diff and generate a concise, conventional commit message.

Diff (first 2000 chars):
${diff.slice(0, 2000)}

Format: <type>: <description>
Types: feat, fix, docs, style, refactor, test, chore

Generate 3 commit message options, ordered by quality. Be concise and specific.

Return ONLY a JSON object with this exact format:
{"suggestions": ["option1", "option2", "option3"]}`;

    // Call Claude CLI
    const { spawn } = await import('child_process');
    const claude = spawn(CLAUDE_CLI_PATH, [
      '--print',
      '--output-format', 'json',
      '--model', 'haiku'  // Fast and cheap for commit messages
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const input = JSON.stringify({
      role: 'user',
      content: prompt
    });

    claude.stdin.write(input);
    claude.stdin.end();

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    return new Promise((resolve) => {
      claude.on('close', (code) => {
        if (code !== 0) {
          console.error('[Git] Claude CLI failed:', stderr);
          resolve({
            success: false,
            error: `Claude CLI failed: ${stderr}`
          });
          return;
        }

        try {
          // Parse Claude CLI response
          const response = JSON.parse(stdout);

          if (response.type === 'result' && response.subtype === 'success') {
            // Extract suggestions from Claude's response
            const resultText = response.result;

            // Try to parse as JSON first
            let suggestions: string[];
            try {
              const parsed = JSON.parse(resultText);
              suggestions = parsed.suggestions || [];
            } catch {
              // If not JSON, try to extract from text
              const lines = resultText.split('\n').filter((line: string) => line.trim());
              suggestions = lines.slice(0, 3);
            }

            if (suggestions.length === 0) {
              suggestions = ['feat: update code', 'fix: resolve issue', 'chore: update files'];
            }

            resolve({
              success: true,
              suggestions
            });
          } else {
            resolve({
              success: false,
              error: 'Unexpected response from Claude CLI'
            });
          }
        } catch (parseError) {
          console.error('[Git] Failed to parse Claude response:', parseError);
          resolve({
            success: false,
            error: 'Failed to parse AI response'
          });
        }
      });

      claude.on('error', (error) => {
        console.error('[Git] Claude process error:', error);
        resolve({
          success: false,
          error: `Failed to run Claude CLI: ${error.message}`
        });
      });
    });
  } catch (error) {
    console.error('[Git] Failed to generate commit message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

/**
 * Git commit for graph visualization
 */
export interface GitCommit {
  hash: string;
  shortHash: string;
  parents: string[];
  message: string;
  author: string;
  date: string;
  refs: string[];
}

/**
 * Get git log for graph visualization
 */
ipcMain.handle('git:log', async (event, workspacePath: string, limit: number = 100) => {
  try {
    console.log('[Git] Getting commit history for:', workspacePath);

    // Format: hash|parents|subject|author|date|refs
    // %H = full hash, %P = parent hashes, %s = subject, %an = author name, %ar = relative date, %D = refs
    // --topo-order: Show commits in topological order (parents before children)
    const { stdout } = await execAsync(
      `git log --all --topo-order --format="%H|%P|%s|%an|%ar|%D" -${limit}`,
      { cwd: workspacePath }
    );

    if (!stdout.trim()) {
      return { success: true, commits: [] };
    }

    const commits: GitCommit[] = stdout
      .trim()
      .split('\n')
      .map(line => {
        const [hash, parents, message, author, date, refs] = line.split('|');

        return {
          hash,
          shortHash: hash.substring(0, 7),
          parents: parents ? parents.split(' ') : [],
          message,
          author,
          date,
          refs: refs ? refs.split(', ').filter(Boolean) : []
        };
      });

    console.log('[Git] Retrieved', commits.length, 'commits');

    return { success: true, commits };
  } catch (error: any) {
    console.error('[Git] Failed to get log:', error);

    const errorMessage = error.stderr || error.stdout || error.message || 'Unknown error';

    return {
      success: false,
      error: errorMessage
    };
  }
});

/**
 * Register all git handlers
 */
export function registerGitHandlers() {
  console.log('[Git] Handlers registered');
}
