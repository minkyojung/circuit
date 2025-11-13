/**
 * Git IPC Handlers - SECURE VERSION
 *
 * Provides git operations for the Git Panel UI with proper security:
 * - Uses execFile instead of exec to prevent command injection
 * - Validates all repository paths
 * - Strict TypeScript typing
 * - Comprehensive error handling
 */

import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getNodeEnv } from './utils/nodePath.js';

const execFileAsync = promisify(execFile);

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
 * Git commit for graph visualization
 */
export interface GitCommit {
  hash: string;
  shortHash: string;
  parents: string[];
  message: string;
  author: string;
  email: string;
  date: string;
  refs: string[];
}

/**
 * Git reference (branch, tag, etc.)
 */
export interface GitRef {
  hash: string;
  ref: string;
  type: 'branch' | 'tag' | 'remote';
  name: string;
}

/**
 * Complete workspace Git state for context-aware UI
 * This drives all button states and recommendations
 */
export interface GitWorkspaceState {
  // Working directory state
  uncommitted: number;        // Total uncommitted changes
  staged: number;             // Staged files count
  unstaged: number;           // Unstaged files count
  untracked: number;          // Untracked files count

  // Local vs Remote divergence
  ahead: number;              // Commits local has that remote doesn't (↑)
  behind: number;             // Commits remote has that local doesn't (↓)

  // Branch information
  currentBranch: string;
  upstreamBranch: string | null;
  defaultBranch: string;      // Usually 'main' or 'master'

  // Special states
  isMerging: boolean;         // Merge in progress
  isRebasing: boolean;        // Rebase in progress
  hasConflicts: boolean;      // Unresolved conflicts exist

  // Capability flags (computed from above)
  canCommit: boolean;         // Has uncommitted changes
  canPush: boolean;           // Has commits to push
  canPull: boolean;           // Behind remote or just checking
  canMerge: boolean;          // No uncommitted changes, not in special state
}

/**
 * Standard IPC result type
 */
interface IPCResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean;
  normalizedPath: string;
  error?: string;
}

/**
 * Validate that a path is a valid git repository
 *
 * Security checks:
 * 1. Resolves to absolute path (prevents relative path tricks)
 * 2. Resolves symlinks to real path
 * 3. Verifies .git directory exists
 * 4. Prevents path traversal attacks
 *
 * @param repoPath - Path to validate
 * @returns Validation result with normalized path
 */
async function validateGitRepository(repoPath: string): Promise<ValidationResult> {
  try {
    // Step 1: Resolve to absolute path
    const normalizedPath = path.resolve(repoPath);

    // Step 2: Resolve symlinks to real path (prevents symlink attacks)
    const realPath = await fs.realpath(normalizedPath);

    // Step 3: Verify .git directory exists
    const gitDir = path.join(realPath, '.git');
    await fs.access(gitDir, fs.constants.R_OK);

    return { valid: true, normalizedPath: realPath };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      normalizedPath: repoPath,
      error: `Invalid repository path: ${errorMessage}`
    };
  }
}

/**
 * Validate file path for git operations
 *
 * Ensures the file path:
 * 1. Is relative (not absolute)
 * 2. Doesn't contain path traversal sequences (..)
 * 3. Is safe to use in git operations
 *
 * @param filePath - File path to validate
 * @returns True if valid, false otherwise
 */
function validateFilePath(filePath: string): { valid: boolean; error?: string } {
  // Must be relative path
  if (path.isAbsolute(filePath)) {
    return { valid: false, error: 'File path must be relative to repository root' };
  }

  // No path traversal
  if (filePath.includes('..')) {
    return { valid: false, error: 'File path must not contain ".." sequences' };
  }

  // No null bytes (could be used for injection)
  if (filePath.includes('\0')) {
    return { valid: false, error: 'File path contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Execute a git command safely using execFile
 *
 * This function:
 * 1. Validates the repository path
 * 2. Executes git without shell (prevents injection)
 * 3. Has timeout and output limits
 * 4. Provides consistent error handling
 *
 * @param repoPath - Repository path
 * @param args - Git command arguments (array, not string)
 * @returns Command output or error
 */
async function executeGitCommand(
  repoPath: string,
  args: readonly string[]
): Promise<{ success: true; stdout: string } | { success: false; error: string }> {
  try {
    // Validate repository first
    const validation = await validateGitRepository(repoPath);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid repository' };
    }

    // Execute git command without shell (SECURITY: prevents command injection)
    const { stdout, stderr } = await execFileAsync('git', [...args], {
      cwd: validation.normalizedPath,
      shell: false, // CRITICAL: No shell interpretation
      timeout: 300000, // 300 seconds (5 minutes) max for large commits
      maxBuffer: 1024 * 1024 * 100, // 100MB max output for very large diffs
    });

    return { success: true, stdout: stdout || stderr };
  } catch (error: unknown) {
    // Type-safe error handling
    interface ExecError extends Error {
      stderr?: string;
      stdout?: string;
      code?: number;
    }

    const isExecError = (err: unknown): err is ExecError => {
      return err instanceof Error && ('stderr' in err || 'stdout' in err);
    };

    if (isExecError(error)) {
      const errorMessage = error.stderr || error.stdout || error.message || 'Unknown git error';
      return { success: false, error: errorMessage };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
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
      const filePath = parts.slice(1).join('\t');

      return {
        status,
        path: filePath
      };
    });
}

/**
 * Get git status for workspace
 */
ipcMain.handle('git:status', async (_event, workspacePath: string): Promise<IPCResult<{ status: GitStatus }>> => {
  try {
    console.log('[Git] Getting status for:', workspacePath);

    // Current branch
    const branchResult = await executeGitCommand(workspacePath, ['branch', '--show-current']);
    if ('error' in branchResult) {
      return { success: false, error: branchResult.error };
    }

    // Staged files (cached = staged)
    const stagedResult = await executeGitCommand(workspacePath, ['diff', '--cached', '--name-status']);
    if ('error' in stagedResult) {
      return { success: false, error: stagedResult.error };
    }

    // Unstaged files (modified but not staged)
    const unstagedResult = await executeGitCommand(workspacePath, ['diff', '--name-status']);
    if ('error' in unstagedResult) {
      return { success: false, error: unstagedResult.error };
    }

    // Untracked files
    const untrackedResult = await executeGitCommand(workspacePath, ['ls-files', '--others', '--exclude-standard']);
    if ('error' in untrackedResult) {
      return { success: false, error: untrackedResult.error };
    }

    // Remote tracking branch (may not exist)
    let remoteBranch = '';
    let ahead = 0;
    let behind = 0;

    try {
      const remoteResult = await executeGitCommand(workspacePath, ['rev-parse', '--abbrev-ref', '@{upstream}']);
      if ('stdout' in remoteResult) {
        remoteBranch = remoteResult.stdout.trim();

        // Commits ahead of remote
        const aheadResult = await executeGitCommand(workspacePath, ['rev-list', '--count', '@{upstream}..HEAD']);
        if ('stdout' in aheadResult) {
          ahead = parseInt(aheadResult.stdout.trim()) || 0;
        }

        // Commits behind remote
        const behindResult = await executeGitCommand(workspacePath, ['rev-list', '--count', 'HEAD..@{upstream}']);
        if ('stdout' in behindResult) {
          behind = parseInt(behindResult.stdout.trim()) || 0;
        }
      }
    } catch {
      // No upstream branch configured - that's okay
      console.log('[Git] No upstream branch configured');
    }

    const status: GitStatus = {
      currentBranch: branchResult.stdout.trim(),
      remoteBranch,
      ahead,
      behind,
      staged: parseGitStatus(stagedResult.stdout),
      unstaged: parseGitStatus(unstagedResult.stdout),
      untracked: untrackedResult.stdout.trim().split('\n').filter(Boolean).map(filePath => ({
        path: filePath,
        status: '?' as const
      }))
    };

    console.log('[Git] Status retrieved:', {
      branch: status.currentBranch,
      staged: status.staged.length,
      unstaged: status.unstaged.length,
      untracked: status.untracked.length
    });

    return { success: true, data: { status } };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Git] Failed to get status:', error);
    return { success: false, error: errorMessage };
  }
});

/**
 * Stage a file - SECURE VERSION
 */
ipcMain.handle('git:stage', async (_event, workspacePath: string, filePath: string): Promise<IPCResult> => {
  console.log('[Git] Staging file:', filePath);

  // Validate file path
  const pathValidation = validateFilePath(filePath);
  if (!pathValidation.valid) {
    return { success: false, error: pathValidation.error };
  }

  // Use '--' separator to clearly mark file paths (prevents option injection)
  const result = await executeGitCommand(workspacePath, ['add', '--', filePath]);

  if ('error' in result) {
    console.error('[Git] Failed to stage file:', result.error);
    return { success: false, error: result.error };
  }

  return { success: true };
});

/**
 * Unstage a file - SECURE VERSION
 */
ipcMain.handle('git:unstage', async (_event, workspacePath: string, filePath: string): Promise<IPCResult> => {
  console.log('[Git] Unstaging file:', filePath);

  // Validate file path
  const pathValidation = validateFilePath(filePath);
  if (!pathValidation.valid) {
    return { success: false, error: pathValidation.error };
  }

  const result = await executeGitCommand(workspacePath, ['reset', 'HEAD', '--', filePath]);

  if ('error' in result) {
    console.error('[Git] Failed to unstage file:', result.error);
    return { success: false, error: result.error };
  }

  return { success: true };
});

/**
 * Stage all changes - SECURE VERSION
 */
ipcMain.handle('git:stage-all', async (_event, workspacePath: string): Promise<IPCResult> => {
  console.log('[Git] Staging all changes');

  const result = await executeGitCommand(workspacePath, ['add', '.']);

  if ('error' in result) {
    console.error('[Git] Failed to stage all:', result.error);
    return { success: false, error: result.error };
  }

  return { success: true };
});

/**
 * Unstage all changes - SECURE VERSION
 */
ipcMain.handle('git:unstage-all', async (_event, workspacePath: string): Promise<IPCResult> => {
  console.log('[Git] Unstaging all changes');

  const result = await executeGitCommand(workspacePath, ['reset', 'HEAD']);

  if ('error' in result) {
    console.error('[Git] Failed to unstage all:', result.error);
    return { success: false, error: result.error };
  }

  return { success: true };
});

/**
 * Commit staged changes - SECURE VERSION
 *
 * NO ESCAPING NEEDED - Arguments are passed directly to git, not through shell
 */
ipcMain.handle('git:commit', async (_event, workspacePath: string, message: string): Promise<IPCResult> => {
  console.log('[Git] Committing with message length:', message.length);

  // Validate commit message
  if (!message || message.trim().length === 0) {
    return { success: false, error: 'Commit message cannot be empty' };
  }

  if (message.length > 10000) {
    return { success: false, error: 'Commit message too long (max 10000 characters)' };
  }

  // SECURITY: Message is passed as argument array, NOT through shell
  // No escaping needed - execFile handles this safely
  const result = await executeGitCommand(workspacePath, ['commit', '-m', message]);

  if ('error' in result) {
    console.error('[Git] Failed to commit:', result.error);
    return { success: false, error: result.error };
  }

  return { success: true };
});

/**
 * Commit and push staged changes - SECURE VERSION
 */
ipcMain.handle('git:commit-and-push', async (_event, workspacePath: string, message: string): Promise<IPCResult> => {
  console.log('[Git] Committing and pushing with message length:', message.length);

  // Validate commit message
  if (!message || message.trim().length === 0) {
    return { success: false, error: 'Commit message cannot be empty' };
  }

  if (message.length > 10000) {
    return { success: false, error: 'Commit message too long (max 10000 characters)' };
  }

  // Commit
  const commitResult = await executeGitCommand(workspacePath, ['commit', '-m', message]);
  if ('error' in commitResult) {
    console.error('[Git] Failed to commit:', commitResult.error);
    return { success: false, error: commitResult.error };
  }

  // Get current branch name
  const branchResult = await executeGitCommand(workspacePath, ['branch', '--show-current']);
  if ('error' in branchResult) {
    return { success: false, error: branchResult.error };
  }

  const branchName = branchResult.stdout.trim();

  // Push with upstream tracking
  const pushResult = await executeGitCommand(workspacePath, ['push', '-u', 'origin', branchName]);
  if ('error' in pushResult) {
    console.error('[Git] Failed to push:', pushResult.error);
    return { success: false, error: pushResult.error };
  }

  return { success: true };
});

/**
 * Generate commit message using Claude CLI
 */
ipcMain.handle('git:generate-commit-message', async (_event, workspacePath: string): Promise<IPCResult<{ suggestions: string[] }>> => {
  try {
    console.log('[Git] Generating commit message with AI');

    // Get staged diff
    const diffResult = await executeGitCommand(workspacePath, ['diff', '--cached']);
    if ('error' in diffResult) {
      return { success: false, error: diffResult.error };
    }

    if (!diffResult.stdout.trim()) {
      return { success: false, error: 'No staged changes to analyze' };
    }

    // Get Claude CLI path
    const { homedir } = await import('os');
    const { join } = await import('path');
    const CLAUDE_CLI_PATH = join(homedir(), '.claude', 'local', 'claude');

    // Check if Claude CLI exists
    try {
      await fs.access(CLAUDE_CLI_PATH, fs.constants.X_OK);
    } catch {
      return {
        success: false,
        error: 'Claude CLI not found. Please install Claude Code first.'
      };
    }

    // Prepare prompt
    const prompt = `Analyze this git diff and generate a concise, conventional commit message.

Diff (first 2000 chars):
${diffResult.stdout.slice(0, 2000)}

Format: <type>: <description>
Types: feat, fix, docs, style, refactor, test, chore

Generate 3 commit message options, ordered by quality. Be concise and specific.

Return ONLY a JSON object with this exact format:
{"suggestions": ["option1", "option2", "option3"]}`;

    // Call Claude CLI using spawn (secure)
    const { spawn } = await import('child_process');
    const claude = spawn(CLAUDE_CLI_PATH, [
      '--print',
      '--output-format', 'json',
      '--model', 'haiku'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: getNodeEnv()  // Include Node.js in PATH for cross-platform compatibility
    });

    const input = JSON.stringify({
      role: 'user',
      content: prompt
    });

    claude.stdin.write(input);
    claude.stdin.end();

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    return new Promise((resolve) => {
      claude.on('close', (code: number | null) => {
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
              data: { suggestions }
            });
          } else {
            resolve({
              success: false,
              error: 'Unexpected response from Claude CLI'
            });
          }
        } catch (parseError: unknown) {
          const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
          console.error('[Git] Failed to parse Claude response:', parseError);
          resolve({
            success: false,
            error: `Failed to parse AI response: ${errorMessage}`
          });
        }
      });

      claude.on('error', (error: Error) => {
        console.error('[Git] Claude process error:', error);
        resolve({
          success: false,
          error: `Failed to run Claude CLI: ${error.message}`
        });
      });
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Git] Failed to generate commit message:', error);
    return { success: false, error: errorMessage };
  }
});

/**
 * Get git log for graph visualization
 */
ipcMain.handle('git:log', async (_event, workspacePath: string, limit: number = 5000): Promise<IPCResult<{ commits: GitCommit[] }>> => {
  try {
    console.log('[Git] Getting commit history for:', workspacePath);

    const result = await executeGitCommand(workspacePath, [
      'log',
      '--all',
      '--topo-order',
      '--format=%H|%P|%s|%an|%ae|%ar|%D',
      `-${limit}`
    ]);

    if ('error' in result) {
      return { success: false, error: result.error };
    }

    if (!result.stdout.trim()) {
      return { success: true, data: { commits: [] } };
    }

    const commits: GitCommit[] = result.stdout
      .trim()
      .split('\n')
      .map(line => {
        const [hash, parents, message, author, email, date, refs] = line.split('|');

        return {
          hash,
          shortHash: hash.substring(0, 7),
          parents: parents ? parents.split(' ') : [],
          message,
          author,
          email: email || '',
          date,
          refs: refs ? refs.split(', ').filter(Boolean) : []
        };
      });

    console.log('[Git] Retrieved', commits.length, 'commits');

    return { success: true, data: { commits } };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Git] Failed to get log:', error);
    return { success: false, error: errorMessage };
  }
});

/**
 * Get all git refs (branches, tags, remotes)
 */
ipcMain.handle('git:refs', async (_event, workspacePath: string): Promise<IPCResult<{ refs: GitRef[] }>> => {
  try {
    console.log('[Git] Getting refs for:', workspacePath);

    const result = await executeGitCommand(workspacePath, ['show-ref', '--heads', '--tags']);

    if ('error' in result) {
      // show-ref returns non-zero if no refs found, which is okay
      return { success: true, data: { refs: [] } };
    }

    if (!result.stdout.trim()) {
      return { success: true, data: { refs: [] } };
    }

    const refs: GitRef[] = result.stdout
      .trim()
      .split('\n')
      .map(line => {
        const [hash, ref] = line.split(' ');

        let type: 'branch' | 'tag' | 'remote';
        let name: string;

        if (ref.startsWith('refs/heads/')) {
          type = 'branch';
          name = ref.replace('refs/heads/', '');
        } else if (ref.startsWith('refs/tags/')) {
          type = 'tag';
          name = ref.replace('refs/tags/', '');
        } else if (ref.startsWith('refs/remotes/')) {
          type = 'remote';
          name = ref.replace('refs/remotes/', '');
        } else {
          type = 'branch';
          name = ref;
        }

        return {
          hash,
          ref,
          type,
          name
        };
      });

    console.log('[Git] Retrieved', refs.length, 'refs');

    return { success: true, data: { refs } };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Git] Failed to get refs:', error);
    return { success: false, error: errorMessage };
  }
});

/**
 * List all branches for a repository - SECURE VERSION
 */
ipcMain.handle('git:list-branches', async (_event, repoPath: string): Promise<IPCResult<{ branches: string[] }>> => {
  console.log('[Git] Listing branches for:', repoPath);

  const result = await executeGitCommand(repoPath, ['branch', '--format=%(refname:short)']);

  if ('error' in result) {
    console.error('[Git] Failed to list branches:', result.error);
    return {
      success: false,
      error: result.error,
      data: { branches: ['main'] } // Fallback
    };
  }

  if (!result.stdout.trim()) {
    return { success: true, data: { branches: ['main'] } };
  }

  const branches = result.stdout
    .trim()
    .split('\n')
    .map(branch => branch.trim())
    .filter(Boolean);

  console.log('[Git] Found branches:', branches);
  return { success: true, data: { branches } };
});

/**
 * Fetch from remote - SECURE VERSION
 * Downloads changes from remote without merging
 */
ipcMain.handle('git:fetch', async (_event, workspacePath: string, remote: string = 'origin'): Promise<IPCResult<{ commits: number }>> => {
  console.log('[Git] Fetching from:', remote);

  // Validate remote name (alphanumeric, dash, underscore only)
  if (!/^[a-zA-Z0-9_-]+$/.test(remote)) {
    return { success: false, error: 'Invalid remote name' };
  }

  const result = await executeGitCommand(workspacePath, ['fetch', remote]);

  if ('error' in result) {
    console.error('[Git] Failed to fetch:', result.error);
    return { success: false, error: result.error };
  }

  // Parse fetch output to count new commits (optional, for UI feedback)
  // Git fetch output format varies, so we'll just return success
  console.log('[Git] Fetch completed successfully');
  return { success: true, data: { commits: 0 } }; // TODO: Parse commit count from output
});

/**
 * Pull from remote - SECURE VERSION
 * Fetch + Merge (or Rebase)
 */
ipcMain.handle('git:pull', async (_event, workspacePath: string, options?: { rebase?: boolean; remote?: string; branch?: string }): Promise<IPCResult<{ message: string }>> => {
  const remote = options?.remote || 'origin';
  const useRebase = options?.rebase || false;

  console.log('[Git] Pulling from:', remote, useRebase ? '(rebase)' : '(merge)');

  // Validate remote name
  if (!/^[a-zA-Z0-9_-]+$/.test(remote)) {
    return { success: false, error: 'Invalid remote name' };
  }

  // Build pull command
  const args = ['pull'];
  if (useRebase) {
    args.push('--rebase');
  }
  args.push(remote);

  if (options?.branch) {
    // Validate branch name
    if (!/^[a-zA-Z0-9_/-]+$/.test(options.branch)) {
      return { success: false, error: 'Invalid branch name' };
    }
    args.push(options.branch);
  }

  const result = await executeGitCommand(workspacePath, args);

  if ('error' in result) {
    console.error('[Git] Failed to pull:', result.error);

    // Parse error types for better user feedback
    const errorMsg = result.error.toLowerCase();

    if (errorMsg.includes('merge conflict') || errorMsg.includes('conflict')) {
      return {
        success: false,
        error: 'merge_conflict',
        data: { message: 'Merge conflicts detected. Please resolve conflicts and continue.' }
      };
    }

    if (errorMsg.includes('uncommitted changes') || errorMsg.includes('would be overwritten')) {
      return {
        success: false,
        error: 'uncommitted_changes',
        data: { message: 'You have uncommitted changes. Commit or stash them first.' }
      };
    }

    if (errorMsg.includes('no tracking information')) {
      return {
        success: false,
        error: 'no_upstream',
        data: { message: 'No upstream branch configured.' }
      };
    }

    return { success: false, error: result.error };
  }

  console.log('[Git] Pull completed successfully');
  return {
    success: true,
    data: { message: result.stdout.trim() || 'Pull completed successfully' }
  };
});

/**
 * Push to remote - SECURE VERSION (Independent)
 * This is different from git:commit-and-push - it only pushes existing commits
 */
ipcMain.handle('git:push', async (_event, workspacePath: string, options?: {
  force?: boolean;
  forceWithLease?: boolean;
  setUpstream?: boolean;
  remote?: string;
  branch?: string;
}): Promise<IPCResult<{ message: string }>> => {
  const remote = options?.remote || 'origin';

  console.log('[Git] Pushing to:', remote, options);

  // Validate remote name
  if (!/^[a-zA-Z0-9_-]+$/.test(remote)) {
    return { success: false, error: 'Invalid remote name' };
  }

  // Get current branch if not specified
  let branch = options?.branch;
  if (!branch) {
    const branchResult = await executeGitCommand(workspacePath, ['branch', '--show-current']);
    if ('error' in branchResult) {
      return { success: false, error: 'Could not determine current branch' };
    }
    branch = branchResult.stdout.trim();
  }

  // Validate branch name
  if (!/^[a-zA-Z0-9_/-]+$/.test(branch)) {
    return { success: false, error: 'Invalid branch name' };
  }

  // Build push command
  const args = ['push'];

  // Force options (mutually exclusive, forceWithLease preferred)
  if (options?.forceWithLease) {
    args.push('--force-with-lease');
  } else if (options?.force) {
    console.warn('[Git] Using --force (dangerous). Consider --force-with-lease instead.');
    args.push('--force');
  }

  // Set upstream tracking
  if (options?.setUpstream) {
    args.push('-u');
  }

  args.push(remote, branch);

  const result = await executeGitCommand(workspacePath, args);

  if ('error' in result) {
    console.error('[Git] Failed to push:', result.error);

    // Parse error types for better user feedback
    const errorMsg = result.error.toLowerCase();

    if (errorMsg.includes('rejected') || errorMsg.includes('non-fast-forward')) {
      return {
        success: false,
        error: 'push_rejected: Remote has changes you don\'t have. Try pulling first or use force-with-lease.'
      };
    }

    if (errorMsg.includes('no upstream') || errorMsg.includes('does not have a remote')) {
      return {
        success: false,
        error: 'no_upstream: No upstream branch configured. Use set upstream option.'
      };
    }

    if (errorMsg.includes('authentication') || errorMsg.includes('permission denied')) {
      return {
        success: false,
        error: 'auth_failed: Authentication failed. Check your credentials.'
      };
    }

    return { success: false, error: result.error };
  }

  console.log('[Git] Push completed successfully');
  return {
    success: true,
    data: { message: result.stdout.trim() || 'Push completed successfully' }
  };
});

/**
 * Get complete workspace Git state - SECURE VERSION
 * This is the foundation for context-aware Git UI
 *
 * Strategy: Run multiple git commands in parallel for performance
 * Graceful degradation: If individual commands fail, use safe defaults
 */
ipcMain.handle('git:get-workspace-state', async (_event, workspacePath: string): Promise<IPCResult<{ state: GitWorkspaceState }>> => {
  console.log('[Git] Getting workspace state for:', workspacePath);

  try {
    // Execute all git commands in parallel for performance
    // Using Promise.allSettled to continue even if some commands fail
    const [
      statusResult,
      branchResult,
      upstreamResult,
      aheadResult,
      behindResult,
      defaultBranchResult,
      mergeHeadResult,
      rebaseHeadResult
    ] = await Promise.allSettled([
      // 1. Get working directory status
      executeGitCommand(workspacePath, ['status', '--porcelain']),

      // 2. Get current branch
      executeGitCommand(workspacePath, ['branch', '--show-current']),

      // 3. Get upstream branch
      executeGitCommand(workspacePath, ['rev-parse', '--abbrev-ref', '@{upstream}']),

      // 4. Count commits ahead
      executeGitCommand(workspacePath, ['rev-list', '--count', '@{upstream}..HEAD']),

      // 5. Count commits behind
      executeGitCommand(workspacePath, ['rev-list', '--count', 'HEAD..@{upstream}']),

      // 6. Get default branch (origin/HEAD)
      executeGitCommand(workspacePath, ['symbolic-ref', 'refs/remotes/origin/HEAD']),

      // 7. Check if merge in progress
      executeGitCommand(workspacePath, ['rev-parse', '--verify', 'MERGE_HEAD']),

      // 8. Check if rebase in progress
      executeGitCommand(workspacePath, ['rev-parse', '--verify', 'REBASE_HEAD'])
    ]);

    // Parse status (always needed, fail if unavailable)
    if (statusResult.status !== 'fulfilled' || 'error' in statusResult.value) {
      return { success: false, error: 'Failed to get git status' };
    }

    const statusOutput = statusResult.value.stdout;
    const statusLines = statusOutput.trim().split('\n').filter(Boolean);

    let staged = 0;
    let unstaged = 0;
    let untracked = 0;
    let hasConflicts = false;

    for (const line of statusLines) {
      const status = line.substring(0, 2);

      // Staged changes (left column)
      if (status[0] !== ' ' && status[0] !== '?') {
        staged++;
      }

      // Unstaged changes (right column)
      if (status[1] !== ' ' && status[1] !== '?') {
        unstaged++;
      }

      // Untracked files
      if (status === '??') {
        untracked++;
      }

      // Conflicts (both modified, added by us/them, etc.)
      if (status === 'UU' || status === 'AA' || status === 'DD' ||
          status === 'AU' || status === 'UA' || status === 'DU' || status === 'UD') {
        hasConflicts = true;
      }
    }

    const uncommitted = staged + unstaged + untracked;

    // Parse current branch
    const currentBranch = branchResult.status === 'fulfilled' && 'stdout' in branchResult.value
      ? branchResult.value.stdout.trim()
      : 'unknown';

    // Parse upstream branch (may not exist)
    const upstreamBranch = upstreamResult.status === 'fulfilled' && 'stdout' in upstreamResult.value
      ? upstreamResult.value.stdout.trim()
      : null;

    // Parse ahead/behind counts (default to 0 if no upstream)
    const ahead = aheadResult.status === 'fulfilled' && 'stdout' in aheadResult.value
      ? parseInt(aheadResult.value.stdout.trim()) || 0
      : 0;

    const behind = behindResult.status === 'fulfilled' && 'stdout' in behindResult.value
      ? parseInt(behindResult.value.stdout.trim()) || 0
      : 0;

    // Parse default branch (fallback to 'main')
    let defaultBranch = 'main';
    if (defaultBranchResult.status === 'fulfilled' && 'stdout' in defaultBranchResult.value) {
      const fullRef = defaultBranchResult.value.stdout.trim();
      defaultBranch = fullRef.replace('refs/remotes/origin/', '');
    }

    // Check merge/rebase state
    const isMerging = mergeHeadResult.status === 'fulfilled' && 'stdout' in mergeHeadResult.value;
    const isRebasing = rebaseHeadResult.status === 'fulfilled' && 'stdout' in rebaseHeadResult.value;

    // Compute capability flags
    const canCommit = uncommitted > 0;
    const canPush = ahead > 0 && uncommitted === 0;
    const canPull = true; // Can always attempt to pull
    const canMerge = uncommitted === 0 && !isMerging && !isRebasing;

    const state: GitWorkspaceState = {
      uncommitted,
      staged,
      unstaged,
      untracked,
      ahead,
      behind,
      currentBranch,
      upstreamBranch,
      defaultBranch,
      isMerging,
      isRebasing,
      hasConflicts,
      canCommit,
      canPush,
      canPull,
      canMerge
    };

    console.log('[Git] Workspace state:', {
      branch: state.currentBranch,
      uncommitted: state.uncommitted,
      ahead: state.ahead,
      behind: state.behind,
      conflicts: state.hasConflicts
    });

    return { success: true, data: { state } };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Git] Failed to get workspace state:', error);
    return { success: false, error: errorMessage };
  }
});

/**
 * Get git diff - SECURE VERSION
 * Replaces workspace:git-diff with secure implementation
 */
ipcMain.handle('git:diff', async (_event, workspacePath: string, options?: {
  staged?: boolean;
  target?: string;
}): Promise<IPCResult<{ diff: string }>> => {
  console.log('[Git] Getting diff for:', workspacePath, options);

  const args = ['diff'];

  if (options?.staged) {
    args.push('--cached');
  }

  if (options?.target) {
    // Validate target (commit hash or ref)
    if (!/^[a-zA-Z0-9_/-]+$/.test(options.target)) {
      return { success: false, error: 'Invalid target ref' };
    }
    args.push(options.target);
  } else {
    args.push('HEAD');
  }

  const result = await executeGitCommand(workspacePath, args);

  if ('error' in result) {
    console.error('[Git] Failed to get diff:', result.error);
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { diff: result.stdout || 'No changes detected' }
  };
});

/**
 * Smart Commit: Analyze + Auto Execute
 *
 * Analyzes git changes with Claude and creates atomic commits automatically.
 * Will require review if warnings are detected or changes are complex.
 */
console.log('[Git] Registering git:smart-commit-auto handler...');
ipcMain.handle('git:smart-commit-auto', async (event, { workspacePath, options }: {
  workspacePath: string;
  options?: any; // SmartCommitOptions from types
}) => {
  console.log('[Git] 🚀 git:smart-commit-auto handler INVOKED');
  console.log('[Git] Parameters:', { workspacePath, options });

  try {
    const { analyzeChangesWithClaude } = await import('./smartCommitAnalyzer.js');

    // Validate repository
    const validation = await validateGitRepository(workspacePath);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Invalid repository'
      };
    }
    const resolvedPath = validation.normalizedPath;

    const opts = {
      mode: 'auto',
      maxGroups: 10,
      maxFilesPerGroup: 20,
      ...options,
      // Support both 'force' and 'forceAuto' for compatibility
      forceAuto: options?.force || options?.forceAuto || false
    };

    // Step 0: Auto-stage all changes (including untracked files)
    // This allows users to commit without manually running git add
    console.log('[Git] 📦 Auto-staging all changes...');
    const addResult = await executeGitCommand(resolvedPath, ['add', '-A']);
    if ('error' in addResult) {
      console.warn('[Git] ⚠️ Failed to auto-stage:', addResult.error);
      // Continue anyway - there might be already staged files
    }

    // Step 1: Get changed files
    event.sender.send('smart-commit:progress', {
      stage: 'analyzing'
    });

    const statusResult = await executeGitCommand(resolvedPath, ['status', '--porcelain', '-uall']);

    if ('error' in statusResult) {
      return {
        success: false,
        error: statusResult.error
      };
    }

    const changedFiles = statusResult.stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const status = line.substring(0, 2).trim() as 'M' | 'A' | 'D' | 'R' | '??' | 'MM';
        const filePath = line.substring(3);
        return { path: filePath, status };
      });

    console.log('[Git] 📁 Changed files detected:', changedFiles.length);
    console.log('[Git] Files:', changedFiles.map(f => `${f.status} ${f.path}`).join(', '));

    if (changedFiles.length === 0) {
      console.log('[Git] ⚠️ No changes found in workspace:', resolvedPath);
      return {
        success: false,
        error: 'No changes to commit'
      };
    }

    // Step 2: Get full diff (of staged changes since we just auto-staged everything)
    const diffResult = await executeGitCommand(resolvedPath, ['diff', '--cached']);

    if ('error' in diffResult) {
      return {
        success: false,
        error: diffResult.error
      };
    }

    // Step 3: Analyze with Claude
    console.log('[Git] 📊 Starting Claude analysis...');
    const plan = await analyzeChangesWithClaude(changedFiles, diffResult.stdout);
    console.log('[Git] ✅ Analysis complete:', {
      complexity: plan.complexity,
      groupCount: plan.groups.length,
      warningCount: plan.warnings?.length || 0
    });

    // Step 4: Check if review is required
    const requiresReview = shouldRequireReview(plan, opts);
    console.log('[Git] Review check:', { requiresReview, mode: opts.mode });

    if (requiresReview && !opts.forceAuto) {
      console.log('[Git] ⚠️ Returning requiresReview response');
      return {
        success: false,
        requiresReview: true,
        plan,
        reason: getReviewReason(plan)
      };
    }

    // Step 5: Execute commits
    console.log('[Git] 🚀 Starting commit execution...');
    event.sender.send('smart-commit:progress', {
      stage: 'executing',
      totalGroups: plan.groups.length
    });

    const completedShas: string[] = [];

    for (let i = 0; i < plan.groups.length; i++) {
      const group = plan.groups[i];

      // Progress update
      event.sender.send('smart-commit:progress', {
        stage: 'executing',
        currentGroup: i + 1,
        totalGroups: plan.groups.length,
        currentCommit: {
          title: group.title,
          files: group.files
        }
      });

      // Reset staging area
      const resetResult = await executeGitCommand(resolvedPath, ['reset', 'HEAD']);
      if ('error' in resetResult) {
        throw new Error(`Failed to reset staging area: ${resetResult.error}`);
      }

      // Stage files for this commit
      for (const file of group.files) {
        const addResult = await executeGitCommand(resolvedPath, ['add', '--', file]);
        if ('error' in addResult) {
          // Try with --force in case file was deleted
          const forceResult = await executeGitCommand(resolvedPath, ['add', '--force', '--', file]);
          if ('error' in forceResult) {
            console.warn(`[Git] Could not stage file ${file}: ${forceResult.error}`);
          }
        }
      }

      // Commit
      const commitResult = await executeGitCommand(resolvedPath, ['commit', '-m', group.message]);
      if ('error' in commitResult) {
        throw new Error(`Failed to commit: ${commitResult.error}`);
      }

      // Get commit SHA
      const shaResult = await executeGitCommand(resolvedPath, ['rev-parse', 'HEAD']);
      if ('stdout' in shaResult) {
        completedShas.push(shaResult.stdout.trim());
      }
    }

    // Step 6: Complete
    console.log('[Git] ✅ All commits completed:', completedShas.length);
    event.sender.send('smart-commit:progress', {
      stage: 'complete',
      completedShas
    });

    console.log('[Git] 📤 Returning success response');
    return {
      success: true,
      plan,
      commits: completedShas
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Git] ❌ Smart commit error:', errorMessage);

    event.sender.send('smart-commit:progress', {
      stage: 'error',
      error: errorMessage
    });

    console.log('[Git] 📤 Returning error response');
    return {
      success: false,
      error: errorMessage
    };
  }
});

/**
 * Smart Commit: Undo recent commits
 *
 * Soft resets to preserve changes in working directory
 */
console.log('[Git] Registering git:smart-commit-undo handler...');
ipcMain.handle('git:smart-commit-undo', async (_event, { workspacePath, commitCount }: {
  workspacePath: string;
  commitCount: number;
}) => {
  console.log('[Git] 🔄 git:smart-commit-undo handler INVOKED');
  console.log('[Git] Parameters:', { workspacePath, commitCount });

  try {
    // Validate repository
    const validation = await validateGitRepository(workspacePath);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Invalid repository'
      };
    }
    const resolvedPath = validation.normalizedPath;

    // Validate commit count
    if (commitCount <= 0 || commitCount > 20) {
      return {
        success: false,
        error: 'Invalid commit count (must be 1-20)'
      };
    }

    // Soft reset to preserve changes
    const result = await executeGitCommand(resolvedPath, ['reset', '--soft', `HEAD~${commitCount}`]);

    if ('error' in result) {
      console.error('[Git] Failed to undo commits:', result.error);
      return {
        success: false,
        error: result.error
      };
    }

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage
    };
  }
});

/**
 * Helper: Should we require review?
 */
function shouldRequireReview(plan: any, options: any): boolean {
  // Always review if explicitly requested
  if (options.mode === 'review') {
    return true;
  }

  // Check for high-severity warnings
  const hasHighSeverityWarnings = plan.warnings?.some((w: any) => w.severity === 'high');
  if (hasHighSeverityWarnings) {
    return true;
  }

  // Check complexity
  if (plan.complexity === 'complex') {
    return true;
  }

  // Check limits
  if (plan.groups.length > (options.maxGroups || 10)) {
    return true;
  }

  return false;
}

/**
 * Helper: Get reason for review requirement
 */
function getReviewReason(plan: any): string {
  if (plan.complexity === 'complex') {
    return `Complex changes (${plan.groups.length} commits) - review recommended`;
  }

  const highWarnings = plan.warnings?.filter((w: any) => w.severity === 'high');
  if (highWarnings?.length > 0) {
    return `High severity warnings: ${highWarnings.map((w: any) => w.message).join(', ')}`;
  }

  return 'Review recommended for these changes';
}

/**
 * Register all git handlers
 */
export function registerGitHandlers(): void {
  console.log('[Git] Handlers registered');
}
