/**
 * Branch Lineage
 *
 * Build parent-child relationships between branches and detect merges
 */

import type { GitCommit, GitBranch } from '@/types/git';

/**
 * Step 1: Find base commit for each branch
 * 브랜치가 어디서 분기했는지 찾기
 */
export function findBranchBases(
  branches: Map<string, GitBranch>,
  commits: GitCommit[],
  commitToBranches: Map<string, Set<string>>
): void {
  const commitMap = new Map(commits.map(c => [c.hash, c]));

  branches.forEach((branch, branchName) => {
    // main/master는 base 없음
    if (branchName === 'main' || branchName === 'master') {
      return;
    }

    // exclusiveCommits의 가장 오래된 커밋 찾기
    if (branch.exclusiveCommits.size === 0) return;

    const firstExclusiveHash = branch.createdAt;
    if (!firstExclusiveHash) return;

    const firstCommit = commitMap.get(firstExclusiveHash);

    if (firstCommit && firstCommit.parents.length > 0) {
      const baseCommitHash = firstCommit.parents[0];
      branch.baseCommit = baseCommitHash;

      // base commit이 어느 브랜치에 속하는지 찾기
      const baseBranches = commitToBranches.get(baseCommitHash);
      if (baseBranches) {
        // main 우선, 없으면 master, 없으면 첫 번째
        let baseBranchName: string;
        if (baseBranches.has('main')) {
          baseBranchName = 'main';
        } else if (baseBranches.has('master')) {
          baseBranchName = 'master';
        } else {
          // 여러 브랜치에 속하면 lane이 가장 작은 것 선택 (나중에 할당되므로 일단 첫 번째)
          baseBranchName = Array.from(baseBranches)[0];
        }

        branch.baseBranch = baseBranchName;

        // 부모 브랜치의 childBranches에 추가
        const parentBranch = branches.get(baseBranchName);
        if (parentBranch) {
          parentBranch.childBranches.push(branchName);
        }
      }
    }
  });

  console.log('[BranchLineage] Found base branches');
}

/**
 * Step 2: Detect merge points
 */
export function detectMerges(
  branches: Map<string, GitBranch>,
  commits: GitCommit[],
  commitToBranches: Map<string, Set<string>>
): void {
  commits.forEach(commit => {
    if (commit.parents.length > 1) {
      // 머지 커밋 발견

      // 어떤 브랜치들이 이 커밋으로 merge되었는지
      commit.parents.slice(1).forEach(mergedParentHash => {
        const mergedBranches = commitToBranches.get(mergedParentHash);

        mergedBranches?.forEach(branchName => {
          const branch = branches.get(branchName);
          if (branch && branch.head === mergedParentHash) {
            // 이 브랜치의 HEAD가 merge되었음
            branch.mergedAt = commit.hash;
            branch.isActive = false;

            // merge 대상 찾기
            const targetBranches = commitToBranches.get(commit.hash);
            if (targetBranches) {
              // main 우선
              if (targetBranches.has('main')) {
                branch.mergedInto = 'main';
              } else if (targetBranches.has('master')) {
                branch.mergedInto = 'master';
              } else {
                branch.mergedInto = Array.from(targetBranches)[0];
              }
            }
          }
        });
      });
    }
  });

  console.log('[BranchLineage] Detected merges');
}

/**
 * Step 3: Topological sort branches
 * 부모 브랜치가 먼저 오도록 정렬
 */
export function topologicalSortBranches(
  branches: Map<string, GitBranch>
): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();

  function visit(branchName: string) {
    if (visited.has(branchName)) return;

    const branch = branches.get(branchName);
    if (!branch) return;

    // 부모 브랜치 먼저 방문
    if (branch.baseBranch) {
      visit(branch.baseBranch);
    }

    visited.add(branchName);
    sorted.push(branchName);
  }

  // main/master 먼저
  if (branches.has('main')) visit('main');
  else if (branches.has('master')) visit('master');

  // 나머지
  branches.forEach((_, name) => visit(name));

  console.log('[BranchLineage] Topologically sorted', sorted.length, 'branches');

  return sorted;
}
