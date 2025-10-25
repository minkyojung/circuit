/**
 * Workspace Type Definitions
 * Git worktree-based workspace isolation
 */

export interface Workspace {
  /** Unique identifier (same as branch name) */
  id: string;

  /** Display name for the workspace */
  name: string;

  /** Git branch name */
  branch: string;

  /** Absolute path to the worktree directory */
  path: string;

  /** ISO timestamp of creation */
  createdAt: string | null;

  /** Whether this workspace is currently active */
  isActive: boolean;
}

export interface WorkspaceStatus {
  /** True if no uncommitted changes */
  clean: boolean;

  /** Number of modified files */
  modified: number;

  /** Number of added files */
  added: number;

  /** Number of deleted files */
  deleted: number;

  /** Number of untracked files */
  untracked: number;
}

export interface WorkspaceCreateResult {
  success: boolean;
  workspace?: Workspace;
  error?: string;
}

export interface WorkspaceListResult {
  success: boolean;
  workspaces?: Workspace[];
  error?: string;
}

export interface WorkspaceDeleteResult {
  success: boolean;
  error?: string;
}

export interface WorkspaceStatusResult {
  success: boolean;
  status?: WorkspaceStatus;
  error?: string;
}
