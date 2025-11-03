/**
 * Git Type Definitions
 */

export type FileStatus = 'M' | 'A' | 'D' | 'R' | '?';

export interface GitFileChange {
  path: string;
  status: FileStatus;
}

export interface GitStatus {
  currentBranch: string;
  remoteBranch: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: GitFileChange[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  parents: string[];
  message: string;
  author: string;
  date: string;
  refs: string[];
}
