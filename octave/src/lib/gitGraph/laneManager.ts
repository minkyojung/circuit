/**
 * Lane Manager
 *
 * Assign lanes to branches with reclamation and hierarchical placement
 */

import type { GitBranch } from '@/types/git';

export class LaneManager {
  private activeLanes = new Set<number>();
  private availableLanes: number[] = [];
  private branchLanes = new Map<string, number>();

  /**
   * 브랜치에 lane 할당
   */
  allocateLane(branch: GitBranch, parentBranch?: GitBranch): number {
    let lane: number;

    if (!parentBranch) {
      // Root branch (main) → lane 0
      lane = 0;
    } else {
      // 자식 브랜치 → 부모의 오른쪽에 배치
      const parentLane = parentBranch.lane;

      // 부모 lane보다 큰 재사용 가능 lane 찾기
      const suitableLane = this.availableLanes.find(l => l > parentLane);

      if (suitableLane !== undefined) {
        lane = suitableLane;
        const index = this.availableLanes.indexOf(suitableLane);
        this.availableLanes.splice(index, 1);
      } else {
        // 없으면 새 lane 할당 (부모 오른쪽)
        const maxLane = this.activeLanes.size > 0
          ? Math.max(...this.activeLanes)
          : parentLane;
        lane = Math.max(maxLane, parentLane) + 1;
      }
    }

    this.activeLanes.add(lane);
    this.branchLanes.set(branch.name, lane);

    return lane;
  }

  /**
   * 브랜치 merge 시 lane 해제
   */
  freeLane(branchName: string): void {
    const lane = this.branchLanes.get(branchName);

    if (lane !== undefined && lane !== 0) {  // lane 0 (main)은 절대 해제 안함
      this.activeLanes.delete(lane);
      this.availableLanes.push(lane);
      // 작은 번호부터 재사용
      this.availableLanes.sort((a, b) => a - b);
    }
  }

  getMaxLane(): number {
    return this.activeLanes.size > 0 ? Math.max(...this.activeLanes) : 0;
  }

  getActiveLaneCount(): number {
    return this.activeLanes.size;
  }

  /**
   * 레인 압축: 빈 공간을 제거하고 모든 브랜치를 왼쪽으로 당김
   * GitKraken 스타일의 레인 수렴 효과를 위해 사용
   */
  compactLanes(branches: Map<string, GitBranch>, colors: string[]): void {
    // 1. 모든 브랜치를 현재 레인 번호순으로 정렬
    const allBranches = Array.from(branches.values())
      .sort((a, b) => a.lane - b.lane);

    // 2. 레인 매핑 생성 (기존 레인 → 새 압축된 레인)
    const laneMapping = new Map<number, number>();
    let nextCompactLane = 0;

    allBranches.forEach(branch => {
      const oldLane = branch.lane;

      // 이미 매핑된 레인이면 같은 번호 사용 (같은 레인의 브랜치들 유지)
      if (!laneMapping.has(oldLane)) {
        laneMapping.set(oldLane, nextCompactLane);
        nextCompactLane++;
      }
    });

    // 3. 모든 브랜치에 새 레인 할당
    allBranches.forEach(branch => {
      const newLane = laneMapping.get(branch.lane)!;
      branch.lane = newLane;
      branch.color = colors[newLane % colors.length];
      this.branchLanes.set(branch.name, newLane);
    });

    // 4. activeLanes 재구성
    this.activeLanes.clear();
    allBranches.forEach(branch => {
      this.activeLanes.add(branch.lane);
    });

    // 5. availableLanes 초기화 (압축 후에는 빈 레인 없음)
    this.availableLanes = [];

    console.log('[LaneManager] Compacted lanes:', {
      beforeMaxLane: Math.max(...laneMapping.keys()),
      afterMaxLane: nextCompactLane - 1,
      compressionRatio: `${Math.max(...laneMapping.keys())} → ${nextCompactLane - 1}`,
    });
  }
}

/**
 * 모든 브랜치에 lane 할당
 */
export function assignLanesToBranches(
  branches: Map<string, GitBranch>,
  branchOrder: string[],
  colors: string[]
): void {
  const laneManager = new LaneManager();

  // Phase 1: 초기 레인 할당
  branchOrder.forEach(branchName => {
    const branch = branches.get(branchName);
    if (!branch) return;

    // 부모 브랜치 찾기
    const parentBranch = branch.baseBranch
      ? branches.get(branch.baseBranch)
      : undefined;

    // Lane 할당
    const lane = laneManager.allocateLane(branch, parentBranch);
    branch.lane = lane;
    branch.color = colors[lane % colors.length];

    // Merge된 브랜치면 lane 해제
    if (!branch.isActive && branch.mergedAt) {
      laneManager.freeLane(branchName);
    }
  });

  console.log('[LaneManager] Initial lane assignment:', {
    totalBranches: branches.size,
    maxLane: laneManager.getMaxLane(),
    activeBranches: Array.from(branches.values()).filter(b => b.isActive).length,
  });

  // Phase 2: 레인 압축 (GitKraken 스타일 수렴 효과)
  laneManager.compactLanes(branches, colors);

  console.log('[LaneManager] Final lane state:', {
    totalBranches: branches.size,
    maxLane: laneManager.getMaxLane(),
    activeBranches: Array.from(branches.values()).filter(b => b.isActive).length,
  });
}
