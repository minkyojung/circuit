/**
 * Graph Builder (Row-by-Row Algorithm)
 *
 * Main orchestrator for building git graph using GitKraken-style
 * "Straight Branches" algorithm.
 *
 * This is a complete rewrite from Branch-First to Row-by-Row approach.
 */

import type { GitCommit, GitRef, BranchGraph, EnrichedCommit } from '@/types/git';
import { buildChildRelations } from './childRelations';
import { assignLanesRowByRow } from './rowByRowLayout';

const COLORS = [
  '#60a5fa', // blue-400
  '#34d399', // emerald-400
  '#fb923c', // orange-400
  '#c084fc', // purple-400
  '#22d3ee', // cyan-400
  '#fb7185', // rose-400
  '#facc15', // yellow-400
  '#a78bfa', // violet-400
];

/**
 * Build complete branch graph from commits and refs
 */
export function buildBranchGraph(
  commits: GitCommit[],
  refs: GitRef[]
): BranchGraph {
  console.log('[GraphBuilder] Building branch graph (Row-by-Row) from', commits.length, 'commits and', refs.length, 'refs');

  const startTime = performance.now();

  // Step 0: Sort commits by date (newest first) - GitKraken style
  const sortedCommits = [...commits].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;  // Newest first
  });

  console.log('[GraphBuilder] Sorted commits by date:', {
    first: sortedCommits[0]?.message.substring(0, 30),
    last: sortedCommits[sortedCommits.length - 1]?.message.substring(0, 30),
  });

  // Step 1: Build child relationships
  const commitsWithChildren = buildChildRelations(sortedCommits);
  const commitsArray = Array.from(commitsWithChildren.values());

  // Step 2: Assign lanes using Row-by-Row algorithm
  const commitLaneInfo = assignLanesRowByRow(commitsArray, COLORS);

  // Step 3: Build ref map for branch labels
  const refMap = new Map<string, GitRef>();
  refs.forEach(ref => {
    refMap.set(ref.hash, ref);
  });

  // Step 4: Enrich commits with lane/color/label info
  const enrichedCommits = new Map<string, EnrichedCommit>();

  commits.forEach(commit => {
    const laneInfo = commitLaneInfo.get(commit.hash);
    const ref = refMap.get(commit.hash);

    const enriched: EnrichedCommit = {
      ...commit,
      belongsToBranches: ref ? [ref.name] : [],
      primaryBranch: ref?.name || 'main',
      lane: laneInfo?.lane ?? 0,
      color: laneInfo?.color ?? COLORS[0],
      isBranchHead: ref !== undefined,
      isBranchStart: false,  // Not used in Row-by-Row
      isMergeCommit: commit.parents.length > 1,
      mergedBranches: [],  // Not used in Row-by-Row
    };

    enrichedCommits.set(commit.hash, enriched);
  });

  // Step 5: Calculate max lane for summary
  const maxLane = Math.max(...Array.from(commitLaneInfo.values()).map(info => info.lane), 0);

  const endTime = performance.now();

  console.log('[GraphBuilder] Complete in', (endTime - startTime).toFixed(2), 'ms:', {
    commits: enrichedCommits.size,
    maxLane,
    refs: refs.length,
  });

  // Return minimal structure (branches/mergePoints not needed for Row-by-Row)
  const graph: BranchGraph = {
    branches: new Map(),  // Not used in Row-by-Row
    commits: enrichedCommits,
    commitToBranches: new Map(),  // Not used
    branchOrder: [],  // Not used
    mergePoints: [],  // Not used
  };

  return graph;
}
