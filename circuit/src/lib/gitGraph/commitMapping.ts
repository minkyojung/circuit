/**
 * Commit Mapping
 *
 * Enrich commits with branch context (lane, color, primary branch)
 */

import type { GitCommit, GitBranch, EnrichedCommit, MergePoint } from '@/types/git';

/**
 * 각 커밋에 브랜치 컨텍스트 추가
 */
export function enrichCommits(
  commits: GitCommit[],
  branches: Map<string, GitBranch>,
  commitToBranches: Map<string, Set<string>>
): Map<string, EnrichedCommit> {
  const enrichedCommits = new Map<string, EnrichedCommit>();

  commits.forEach(commit => {
    const branchSet = commitToBranches.get(commit.hash) || new Set();
    const belongsToBranches = Array.from(branchSet);

    // Primary branch 결정
    let primaryBranch: string;
    let primaryBranchObj: GitBranch | undefined;

    if (belongsToBranches.length === 0) {
      // 어떤 브랜치에도 속하지 않음 → main
      primaryBranch = 'main';
      primaryBranchObj = branches.get('main') || branches.get('master');
    } else if (belongsToBranches.length === 1) {
      // 한 브랜치에만 속함
      primaryBranch = belongsToBranches[0];
      primaryBranchObj = branches.get(primaryBranch);
    } else {
      // 여러 브랜치에 속함 (공통 조상)
      // → exclusive commit을 가진 브랜치 우선
      const exclusiveBranch = belongsToBranches.find(name => {
        const b = branches.get(name);
        return b?.exclusiveCommits.has(commit.hash);
      });

      if (exclusiveBranch) {
        primaryBranch = exclusiveBranch;
        primaryBranchObj = branches.get(exclusiveBranch);
      } else {
        // 모두 공유 → 가장 왼쪽 (lane 작은) 브랜치
        const sorted = belongsToBranches
          .map(name => branches.get(name))
          .filter(b => b !== undefined)
          .sort((a, b) => a!.lane - b!.lane);

        primaryBranchObj = sorted[0];
        primaryBranch = primaryBranchObj?.name || 'main';
      }
    }

    // Merge 정보
    const isMergeCommit = commit.parents.length > 1;
    const mergedBranches: string[] = [];

    if (isMergeCommit) {
      commit.parents.slice(1).forEach(parentHash => {
        const parentBranches = commitToBranches.get(parentHash);
        parentBranches?.forEach(name => {
          const b = branches.get(name);
          if (b?.head === parentHash) {
            mergedBranches.push(name);
          }
        });
      });
    }

    // Enriched commit 생성
    const enriched: EnrichedCommit = {
      ...commit,
      belongsToBranches,
      primaryBranch,
      lane: primaryBranchObj?.lane ?? 0,
      color: primaryBranchObj?.color ?? '#888',
      isMergeCommit,
      mergedBranches,
    };

    enrichedCommits.set(commit.hash, enriched);
  });

  console.log('[CommitMapping] Enriched', enrichedCommits.size, 'commits');

  return enrichedCommits;
}

/**
 * Build merge points for rendering
 */
export function buildMergePoints(
  commits: GitCommit[],
  enrichedCommits: Map<string, EnrichedCommit>,
  branches: Map<string, GitBranch>
): MergePoint[] {
  const mergePoints: MergePoint[] = [];

  commits.forEach(commit => {
    const enriched = enrichedCommits.get(commit.hash);
    if (!enriched || !enriched.isMergeCommit) return;

    // 각 merged branch에 대해 merge point 생성
    enriched.mergedBranches.forEach(mergedBranchName => {
      const mergedBranch = branches.get(mergedBranchName);
      if (!mergedBranch) return;

      const mergePoint: MergePoint = {
        mergeCommit: commit.hash,
        mergedBranch: mergedBranchName,
        targetBranch: enriched.primaryBranch,
        sourceLane: mergedBranch.lane,
        targetLane: enriched.lane,
      };

      mergePoints.push(mergePoint);
    });
  });

  console.log('[CommitMapping] Built', mergePoints.length, 'merge points');

  return mergePoints;
}
