/**
 * Branch Discovery
 *
 * Extract branches from refs and build commit→branch mappings
 */

import type { GitCommit, GitBranch, GitRef } from '@/types/git';

/**
 * Step 1: Extract branches from refs
 */
export function extractBranches(refs: GitRef[]): Map<string, GitBranch> {
  const branches = new Map<string, GitBranch>();

  refs
    .filter(ref => ref.type === 'branch')
    .forEach(ref => {
      const branch: GitBranch = {
        name: ref.name,
        ref: ref.ref,
        head: ref.hash,
        baseCommit: null,
        baseBranch: null,
        exclusiveCommits: new Set(),
        allCommits: new Set(),
        createdAt: null,
        mergedAt: null,
        mergedInto: null,
        isActive: true,
        lane: -1,  // 아직 할당 안됨
        color: '',
        childBranches: [],
      };

      branches.set(ref.name, branch);
    });

  console.log('[BranchDiscovery] Extracted', branches.size, 'branches');

  return branches;
}

/**
 * Step 2: Build commit→branches mapping
 * 각 커밋이 어떤 브랜치들에 속하는지 추적
 */
export function buildCommitToBranchMapping(
  branches: Map<string, GitBranch>,
  commits: GitCommit[]
): Map<string, Set<string>> {
  const commitToBranches = new Map<string, Set<string>>();
  const commitMap = new Map(commits.map(c => [c.hash, c]));

  // 각 브랜치의 HEAD에서 시작해서 거슬러 올라감
  branches.forEach((branch, branchName) => {
    const visited = new Set<string>();
    const queue: string[] = [branch.head];

    while (queue.length > 0) {
      const hash = queue.shift()!;

      if (visited.has(hash)) continue;
      visited.add(hash);

      // 이 커밋이 이 브랜치에 속함을 기록
      if (!commitToBranches.has(hash)) {
        commitToBranches.set(hash, new Set());
      }
      commitToBranches.get(hash)!.add(branchName);

      // allCommits에 추가
      branch.allCommits.add(hash);

      // 부모 커밋들도 탐색
      const commit = commitMap.get(hash);
      if (commit) {
        commit.parents.forEach(parentHash => {
          if (commitMap.has(parentHash)) {
            queue.push(parentHash);
          }
        });
      }
    }
  });

  console.log('[BranchDiscovery] Built commit→branch mapping for', commitToBranches.size, 'commits');

  return commitToBranches;
}

/**
 * Step 3: Identify exclusive commits
 * 한 브랜치에만 속하는 커밋 찾기
 */
export function identifyExclusiveCommits(
  branches: Map<string, GitBranch>,
  commitToBranches: Map<string, Set<string>>,
  commits: GitCommit[]
): void {
  const commitMap = new Map(commits.map(c => [c.hash, c]));

  commitToBranches.forEach((branchSet, hash) => {
    if (branchSet.size === 1) {
      // 한 브랜치에만 속함
      const branchName = Array.from(branchSet)[0];
      const branch = branches.get(branchName);
      if (branch) {
        branch.exclusiveCommits.add(hash);
      }
    }
  });

  // 각 브랜치의 createdAt 설정 (첫 exclusive commit = 가장 오래된 것)
  branches.forEach(branch => {
    if (branch.exclusiveCommits.size > 0) {
      // exclusive commits를 시간순으로 정렬 (가장 오래된 것이 첫 커밋)
      const exclusiveArray = Array.from(branch.exclusiveCommits);

      // commits 배열에서의 인덱스로 정렬 (뒤쪽 = 오래됨)
      const sortedExclusive = exclusiveArray.sort((a, b) => {
        const indexA = commits.findIndex(c => c.hash === a);
        const indexB = commits.findIndex(c => c.hash === b);
        return indexB - indexA;  // 역순 (뒤쪽이 먼저)
      });

      branch.createdAt = sortedExclusive[0];
    }
  });

  console.log('[BranchDiscovery] Identified exclusive commits for each branch');
}
