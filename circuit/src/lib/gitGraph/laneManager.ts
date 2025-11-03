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

  console.log('[LaneManager] Assigned lanes:', {
    totalBranches: branches.size,
    maxLane: laneManager.getMaxLane(),
    activeBranches: Array.from(branches.values()).filter(b => b.isActive).length,
  });
}
