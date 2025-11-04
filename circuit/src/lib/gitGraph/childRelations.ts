/**
 * Child Relations
 *
 * Build child relationships for Row-by-Row lane assignment.
 * Git only stores parent relationships, but we need children for the algorithm.
 */

import type { GitCommit } from '@/types/git';

export interface CommitWithChildren extends GitCommit {
  children: string[];
  branchChildren: string[];  // Children where this commit is first parent
  mergeChildren: string[];   // Children where this commit is second+ parent
}

/**
 * Build child relationships from parent data
 */
export function buildChildRelations(commits: GitCommit[]): Map<string, CommitWithChildren> {
  const commitMap = new Map<string, CommitWithChildren>();

  // Initialize all commits with empty children arrays
  commits.forEach(commit => {
    commitMap.set(commit.hash, {
      ...commit,
      children: [],
      branchChildren: [],
      mergeChildren: [],
    });
  });

  // Build children arrays by iterating parents
  commits.forEach(commit => {
    commit.parents.forEach((parentHash, index) => {
      const parent = commitMap.get(parentHash);
      if (!parent) return;

      // Add to children list
      parent.children.push(commit.hash);

      // Classify: first parent = branch child, others = merge children
      if (index === 0) {
        parent.branchChildren.push(commit.hash);
      } else {
        parent.mergeChildren.push(commit.hash);
      }
    });
  });

  console.log('[ChildRelations] Built child relationships for', commitMap.size, 'commits');

  return commitMap;
}

/**
 * Check if a commit has branch children (continues a branch)
 */
export function hasBranchChildren(commit: CommitWithChildren): boolean {
  return commit.branchChildren.length > 0;
}

/**
 * Check if a commit has only merge children (ends a branch)
 */
export function hasOnlyMergeChildren(commit: CommitWithChildren): boolean {
  return commit.branchChildren.length === 0 && commit.mergeChildren.length > 0;
}

/**
 * Check if a commit is a branch head (no children)
 */
export function isBranchHead(commit: CommitWithChildren): boolean {
  return commit.children.length === 0;
}
