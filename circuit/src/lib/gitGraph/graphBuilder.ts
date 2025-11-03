/**
 * Graph Builder
 *
 * Main orchestrator for building the complete branch graph
 */

import type { GitCommit, GitRef, BranchGraph } from '@/types/git';
import { extractBranches, buildCommitToBranchMapping, identifyExclusiveCommits, createVirtualBranchesForMerges } from './branchDiscovery';
import { findBranchBases, detectMerges, topologicalSortBranches } from './branchLineage';
import { assignLanesToBranches } from './laneManager';
import { enrichCommits, buildMergePoints } from './commitMapping';

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
  console.log('[GraphBuilder] Building branch graph from', commits.length, 'commits and', refs.length, 'refs');

  const startTime = performance.now();

  // Phase 1: Branch Discovery
  const branches = extractBranches(refs);
  const commitToBranches = buildCommitToBranchMapping(branches, commits);
  identifyExclusiveCommits(branches, commitToBranches, commits);

  // Phase 1.5: Create virtual branches for merged commits (not in refs)
  createVirtualBranchesForMerges(branches, commits, commitToBranches);

  // Phase 2: Branch Lineage
  findBranchBases(branches, commits, commitToBranches);
  detectMerges(branches, commits, commitToBranches);
  const branchOrder = topologicalSortBranches(branches);

  // Phase 3: Lane Assignment
  assignLanesToBranches(branches, branchOrder, COLORS);

  // Phase 4: Commit Mapping
  const enrichedCommits = enrichCommits(commits, branches, commitToBranches);
  const mergePoints = buildMergePoints(commits, enrichedCommits, branches);

  const graph: BranchGraph = {
    branches,
    commits: enrichedCommits,
    commitToBranches,
    branchOrder,
    mergePoints,
  };

  const endTime = performance.now();

  console.log('[GraphBuilder] Complete in', (endTime - startTime).toFixed(2), 'ms:', {
    branches: branches.size,
    commits: enrichedCommits.size,
    maxLane: Math.max(...Array.from(branches.values()).map(b => b.lane), 0),
    activeBranches: Array.from(branches.values()).filter(b => b.isActive).length,
    mergePoints: mergePoints.length,
  });

  return graph;
}
