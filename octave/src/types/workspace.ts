/**
 * Workspace Type Definitions
 * Git worktree-based workspace isolation with Repository grouping
 */

/**
 * Repository: One cloned Git repository that contains multiple workspaces
 */
export interface Repository {
  /** Unique identifier (UUID) */
  id: string;

  /** Repository display name */
  name: string;

  /** Absolute path to main repository */
  path: string;

  /** Git remote URL */
  remoteUrl: string | null;

  /** Default branch (main/master) */
  defaultBranch: string;

  /** ISO timestamp of creation */
  createdAt: string;
}

/**
 * Workspace: Branch-based isolated working environment
 */
export interface Workspace {
  /** Unique identifier (UUID, immutable) */
  id: string;

  /** Repository this workspace belongs to */
  repositoryId: string;

  /** User-friendly display name (editable) */
  displayName: string;

  /** Optional description */
  description?: string;

  /** Optional emoji for visual distinction */
  emoji?: string;

  /** Git branch name */
  branch: string;

  /** Absolute path to the worktree directory */
  path: string;

  /** ISO timestamp of creation */
  createdAt: string;

  /** ISO timestamp of last update */
  updatedAt: string;

  /** Who created this workspace */
  createdBy: 'user' | 'ai';

  /** Purpose/type of workspace */
  purpose?: 'feature' | 'bugfix' | 'experiment' | 'refactor';

  /** Tags for organization */
  tags?: string[];

  /** Whether this workspace is currently active */
  isActive: boolean;

  /** Whether this workspace is archived */
  archived: boolean;

  /** ISO timestamp when archived (if archived) */
  archivedAt?: string;

  /** Legacy: kept for backwards compatibility, same as displayName */
  name: string;
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

  /** Number of commits ahead of remote */
  ahead: number;

  /** Number of commits behind remote */
  behind: number;

  /** Whether remote branch exists */
  hasRemote: boolean;

  /** PR status: "OPEN", "CLOSED", "MERGED", or null */
  prStatus: string | null;

  /** PR URL if exists */
  prUrl: string | null;

  /** Overall status: 'merged', 'working', 'diverged', 'ahead', 'behind', 'local', 'synced', 'unknown' */
  status: string;

  /** Current branch name */
  branch: string;
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
