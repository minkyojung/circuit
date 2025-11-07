/**
 * Row-by-Row Layout (GitKraken-style)
 *
 * Assigns lanes to commits using the "Straight Branches" algorithm.
 * Based on pvigier's blog post and GitKraken's behavior.
 *
 * Key principles:
 * 1. Process commits from newest to oldest
 * 2. Branch children inherit their parent's lane (keeps branches straight)
 * 3. Merge children get new lanes (shows branch divergence)
 * 4. Merged branches leave "nil" lanes for reuse (automatic compaction)
 */

import type { CommitWithChildren } from './childRelations';
import { hasBranchChildren, hasOnlyMergeChildren, isBranchHead } from './childRelations';

/**
 * Assign lanes to commits using Row-by-Row algorithm
 */
export function assignLanesRowByRow(
  commits: CommitWithChildren[],
  colors: string[]
): Map<string, { lane: number; color: string }> {
  const commitLanes = new Map<string, { lane: number; color: string }>();
  const activeLanes: (string | null)[] = [];  // null = available for reuse

  console.log('[RowByRow] Starting lane assignment for', commits.length, 'commits');

  // Helper to visualize active lanes
  const visualizeLanes = (lanes: (string | null)[]) => {
    return lanes.map(l => l ? '●' : 'nil').join(' | ');
  };

  // Process commits from newest to oldest
  commits.forEach((commit, index) => {
    let lane: number;
    const msg = commit.message.substring(0, 25).padEnd(25);

    if (hasBranchChildren(commit)) {
      // Case 1: Has branch children → use leftmost branch child's lane
      const branchChildLanes = commit.branchChildren
        .map(childHash => commitLanes.get(childHash)?.lane)
        .filter((l): l is number => l !== undefined);

      lane = Math.min(...branchChildLanes);

      console.log(`[RowByRow] ${commit.hash.substring(0, 7)} "${msg}" → BRANCH children [${branchChildLanes}] → lane ${lane}`);

    } else if (hasOnlyMergeChildren(commit)) {
      // Case 2: Only merge children → find available lane from leftmost child
      const mergeChildLanes = commit.mergeChildren
        .map(childHash => commitLanes.get(childHash)?.lane)
        .filter((l): l is number => l !== undefined);

      const leftmostChildLane = Math.min(...mergeChildLanes);
      lane = findAvailableLane(activeLanes, leftmostChildLane);

      console.log(`[RowByRow] ${commit.hash.substring(0, 7)} "${msg}" → MERGE only [${mergeChildLanes}] → search from ${leftmostChildLane} → lane ${lane}`);

    } else if (isBranchHead(commit)) {
      // Case 3: No children (branch head) → find nil or append
      lane = findNilOrAppend(activeLanes);

      console.log(`[RowByRow] ${commit.hash.substring(0, 7)} "${msg}" → BRANCH HEAD → lane ${lane}`);

    } else {
      // Fallback: shouldn't happen, but use lane 0
      lane = 0;
      console.warn(`[RowByRow] ${commit.hash.substring(0, 7)} "${msg}" → UNEXPECTED CASE → lane 0`);
    }

    // Assign lane and color
    commitLanes.set(commit.hash, {
      lane,
      color: colors[lane % colors.length],
    });

    // Update active lanes
    activeLanes[lane] = commit.hash;

    // Free lanes for merge children (set to nil, don't delete!)
    const freedLanes: number[] = [];
    commit.mergeChildren.forEach(childHash => {
      const childInfo = commitLanes.get(childHash);
      if (childInfo && childInfo.lane !== lane) {
        activeLanes[childInfo.lane] = null;  // Mark as available
        freedLanes.push(childInfo.lane);
      }
    });

    // Log final state
    console.log(`       → activeLanes: [${visualizeLanes(activeLanes)}]${freedLanes.length > 0 ? ` (freed: ${freedLanes})` : ''}`);
  });

  const maxLane = Math.max(...Array.from(commitLanes.values()).map(info => info.lane), 0);
  console.log('[RowByRow] Lane assignment complete. Max lane:', maxLane);

  return commitLanes;
}

/**
 * Find an available lane starting from a specific position
 * Searches left first, then right, then appends
 */
function findAvailableLane(
  activeLanes: (string | null)[],
  startFrom: number
): number {
  // Search left from startFrom
  for (let i = startFrom; i >= 0; i--) {
    if (activeLanes[i] === null) {
      return i;
    }
  }

  // Search right from startFrom
  for (let i = startFrom + 1; i < activeLanes.length; i++) {
    if (activeLanes[i] === null) {
      return i;
    }
  }

  // No nil lanes found → append
  activeLanes.push(null);
  return activeLanes.length - 1;
}

/**
 * Find first nil lane or append a new one
 */
function findNilOrAppend(activeLanes: (string | null)[]): number {
  const nilIndex = activeLanes.findIndex(lane => lane === null);

  if (nilIndex !== -1) {
    return nilIndex;
  }

  // No nil lanes → append
  activeLanes.push(null);
  return activeLanes.length - 1;
}
