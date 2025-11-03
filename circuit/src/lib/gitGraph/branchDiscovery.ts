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

/**
 * Extract branch name from merge commit message
 */
function extractBranchNameFromMergeMessage(message: string): string | null {
  // Pattern 1: "Merge pull request #123 from user/branch"
  const prPattern = /Merge pull request #(\d+) from (.+)/;
  const prMatch = message.match(prPattern);
  if (prMatch) {
    const branchName = prMatch[2].trim();
    return branchName || `PR #${prMatch[1]}`;
  }

  // Pattern 2: "Merge remote-tracking branch 'origin/branch'"
  const remotePattern = /Merge remote-tracking branch '([^']+)'/;
  const remoteMatch = message.match(remotePattern);
  if (remoteMatch) {
    return remoteMatch[1];
  }

  // Pattern 3: "Merge branch 'feature'"
  const branchPattern = /Merge branch '([^']+)'/;
  const branchMatch = message.match(branchPattern);
  if (branchMatch) {
    return branchMatch[1];
  }

  return null;
}

/**
 * Step 4: Create virtual branches for merged branches
 * refs에 없는 머지된 브랜치들을 가상으로 생성
 */
export function createVirtualBranchesForMerges(
  branches: Map<string, GitBranch>,
  commits: GitCommit[],
  commitToBranches: Map<string, Set<string>>
): void {
  const commitMap = new Map(commits.map(c => [c.hash, c]));
  let virtualBranchCount = 0;

  // 모든 머지 커밋 찾기
  commits.forEach(commit => {
    if (commit.parents.length > 1) {
      // 두 번째 부모부터는 머지되는 브랜치
      commit.parents.slice(1).forEach((mergedParentHash, index) => {
        const mergedParent = commitMap.get(mergedParentHash);
        if (!mergedParent) return;

        // 이미 브랜치가 할당되어 있으면 스킵
        const existingBranches = commitToBranches.get(mergedParentHash);
        if (existingBranches && existingBranches.size === 1) {
          // 한 브랜치에만 속함 = exclusive → 이미 처리됨
          return;
        }

        // 가상 브랜치 이름 추출 (merge message에서)
        const extractedName = extractBranchNameFromMergeMessage(commit.message);
        const virtualBranchName = extractedName || `merged-${commit.hash.substring(0, 7)}-${index}`;

        // 이미 존재하는지 확인
        if (branches.has(virtualBranchName)) return;

        const virtualBranch: GitBranch = {
          name: virtualBranchName,
          ref: `virtual/${virtualBranchName}`,
          head: mergedParentHash,
          baseCommit: null,
          baseBranch: null,
          exclusiveCommits: new Set(),
          allCommits: new Set(),
          createdAt: null,
          mergedAt: commit.hash,
          mergedInto: null,
          isActive: false,  // 이미 머지됨
          lane: -1,
          color: '',
          childBranches: [],
        };

        // 머지된 브랜치의 커밋들 찾기 (두 번째 부모부터 거슬러 올라감)
        const visited = new Set<string>();
        const queue: string[] = [mergedParentHash];
        const firstParentHash = commit.parents[0];
        const mainBranches = commitToBranches.get(firstParentHash) || new Set();

        while (queue.length > 0) {
          const hash = queue.shift()!;
          if (visited.has(hash)) continue;
          visited.add(hash);

          const c = commitMap.get(hash);
          if (!c) continue;

          // main 브랜치에 도달하면 멈춤 (공통 조상)
          const cBranches = commitToBranches.get(hash);
          if (cBranches && Array.from(cBranches).some(b => mainBranches.has(b)) && hash !== mergedParentHash) {
            // 공통 조상 발견
            virtualBranch.baseCommit = hash;
            const baseBranch = Array.from(cBranches).find(b => mainBranches.has(b));
            if (baseBranch) {
              virtualBranch.baseBranch = baseBranch;
            }
            break;
          }

          // 이 커밋을 가상 브랜치에 추가
          virtualBranch.allCommits.add(hash);
          virtualBranch.exclusiveCommits.add(hash);

          // commitToBranches에 추가
          if (!commitToBranches.has(hash)) {
            commitToBranches.set(hash, new Set());
          }
          commitToBranches.get(hash)!.add(virtualBranchName);

          // 부모들도 탐색
          c.parents.forEach(parentHash => {
            if (commitMap.has(parentHash)) {
              queue.push(parentHash);
            }
          });
        }

        // createdAt 설정 (가장 오래된 커밋)
        if (virtualBranch.exclusiveCommits.size > 0) {
          const exclusiveArray = Array.from(virtualBranch.exclusiveCommits);
          const sortedExclusive = exclusiveArray.sort((a, b) => {
            const indexA = commits.findIndex(c => c.hash === a);
            const indexB = commits.findIndex(c => c.hash === b);
            return indexB - indexA;  // 역순
          });
          virtualBranch.createdAt = sortedExclusive[0];
        }

        branches.set(virtualBranchName, virtualBranch);
        virtualBranchCount++;
      });
    }
  });

  console.log('[BranchDiscovery] Created', virtualBranchCount, 'virtual branches for merged commits');
}
