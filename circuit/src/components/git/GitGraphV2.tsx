/**
 * GitGraphV2 - Complete GitKraken-style vertical graph implementation
 *
 * Architecture:
 * 1. Topological sort: Order commits by dependencies
 * 2. Lane assignment: Keep linear history on same vertical lane
 * 3. Row layout: One commit per row
 * 4. SVG rendering: Vertical lines + merge curves
 */

import { useEffect, useState } from 'react';
import type { GitCommit } from '@/types/git';
import { Loader2 } from 'lucide-react';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface GitGraphV2Props {
  workspacePath: string;
  limit?: number;
}

// Layout constants
const ROW_HEIGHT = 40;        // Height per commit row
const LANE_WIDTH = 24;        // Width between lanes
const NODE_RADIUS = 5;        // Commit node size
const LEFT_MARGIN = 160;      // Space for branch labels
const MESSAGE_WIDTH = 400;    // Width for commit messages
const RIGHT_MARGIN = 20;

// Branch colors
const COLORS = [
  '#3b82f6', '#22c55e', '#f97316', '#a855f7',
  '#06b6d4', '#f43f5e', '#eab308', '#8b5cf6',
];

/**
 * Commit with layout information
 */
interface CommitNode {
  commit: GitCommit;
  row: number;              // Row index (Y position)
  lane: number;             // Lane index (X position)
  color: string;
  parents: { hash: string; lane: number }[];
}

/**
 * Lane assignment algorithm
 *
 * Strategy:
 * 1. Build parent-child relationships (two-pass)
 * 2. Process commits oldest->newest (reversed)
 * 3. Track which lanes are occupied
 * 4. Linear history stays on same lane
 * 5. Branch splits get new lanes
 * 6. Merges free up branch lanes
 */
function assignLanes(commits: GitCommit[]): CommitNode[] {
  if (commits.length === 0) return [];

  // Step 1: Build child relationships
  const hashToChildren = new Map<string, string[]>();
  commits.forEach(commit => {
    commit.parents.forEach(parentHash => {
      if (!hashToChildren.has(parentHash)) {
        hashToChildren.set(parentHash, []);
      }
      hashToChildren.get(parentHash)!.push(commit.hash);
    });
  });

  // Step 2: Process in reverse order (oldest first)
  const reversed = [...commits].reverse();
  const hashToLane = new Map<string, number>();
  const hashToIndex = new Map<string, number>();

  commits.forEach((commit, index) => {
    hashToIndex.set(commit.hash, index);
  });

  let nextLane = 0;
  const occupiedLanes = new Set<number>();

  reversed.forEach((commit) => {
    const parents = commit.parents;
    const children = hashToChildren.get(commit.hash) || [];
    let lane: number;

    if (parents.length === 0) {
      // Root commit
      lane = 0;
      nextLane = Math.max(nextLane, 1);
    }
    else if (parents.length === 1) {
      // Linear history - continue parent's lane
      const parentLane = hashToLane.get(parents[0]);
      if (parentLane !== undefined) {
        lane = parentLane;
      } else {
        // Parent not yet processed - allocate new lane
        lane = nextLane++;
      }
    }
    else {
      // Merge commit - use first parent's lane (main branch)
      const firstParentLane = hashToLane.get(parents[0]);
      lane = firstParentLane !== undefined ? firstParentLane : nextLane++;

      // Free lanes from merged branches (other parents)
      for (let i = 1; i < parents.length; i++) {
        const parentLane = hashToLane.get(parents[i]);
        if (parentLane !== undefined) {
          occupiedLanes.delete(parentLane);
        }
      }
    }

    hashToLane.set(commit.hash, lane);
    occupiedLanes.add(lane);

    // Handle branch splits - if this commit has multiple children,
    // allocate new lanes for additional children
    if (children.length > 1) {
      children.slice(1).forEach(childHash => {
        if (!hashToLane.has(childHash)) {
          hashToLane.set(childHash, nextLane++);
        }
      });
    }
  });

  // Step 3: Build final nodes with assigned lanes
  const nodes: CommitNode[] = commits.map((commit, index) => {
    const lane = hashToLane.get(commit.hash) ?? 0;

    const parentNodes = commit.parents.map(parentHash => ({
      hash: parentHash,
      lane: hashToLane.get(parentHash) ?? lane,
    }));

    return {
      commit,
      row: index,
      lane,
      color: COLORS[lane % COLORS.length],
      parents: parentNodes,
    };
  });

  console.log('[GitGraphV2] Assigned lanes:', {
    commits: nodes.length,
    maxLane: Math.max(...nodes.map(n => n.lane), 0),
  });

  return nodes;
}

/**
 * Generate SVG curve path for branch connections
 */
function getCurvePath(x1: number, y1: number, x2: number, y2: number): string {
  const controlPoint1Y = y1 + (y2 - y1) * 0.5;
  const controlPoint2Y = y2 - (y2 - y1) * 0.5;

  return `M ${x1} ${y1} C ${x1} ${controlPoint1Y}, ${x2} ${controlPoint2Y}, ${x2} ${y2}`;
}

/**
 * Extract branch name from refs
 */
function getBranchLabel(refs: string[]): string | null {
  for (const ref of refs) {
    // Skip tags and origin refs
    if (ref.includes('tag:') || ref.startsWith('origin/')) continue;

    // Match "HEAD -> branch" or just "branch"
    const headMatch = ref.match(/HEAD -> (.+)/);
    if (headMatch) return headMatch[1];

    const cleaned = ref.trim();
    if (cleaned) return cleaned;
  }
  return null;
}

export function GitGraphV2({ workspacePath, limit = 100 }: GitGraphV2Props) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCommits = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('git:log', workspacePath, limit);

      if (result.success) {
        setCommits(result.commits);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('[GitGraphV2] Failed to load commits:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCommits();
  }, [workspacePath, limit]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-sm text-red-500">Error: {error}</div>
        <button
          onClick={loadCommits}
          className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No commits found
      </div>
    );
  }

  // Calculate layout
  const nodes = assignLanes(commits);
  const maxLane = Math.max(...nodes.map(n => n.lane), 0);

  // Calculate SVG dimensions
  const graphWidth = LEFT_MARGIN + (maxLane + 1) * LANE_WIDTH + MESSAGE_WIDTH + RIGHT_MARGIN;
  const graphHeight = commits.length * ROW_HEIGHT + 40;
  const messageStartX = LEFT_MARGIN + (maxLane + 1) * LANE_WIDTH + 20;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2 border-b border-sidebar-border">
        <div className="text-xs font-semibold text-foreground">
          Commit History ({commits.length})
        </div>
        <button
          onClick={loadCommits}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Scrollable graph area */}
      <div
        className="flex-1 overflow-auto bg-sidebar"
        style={{ maxHeight: '600px' }}
      >
        <svg
          width={graphWidth}
          height={graphHeight}
          className="font-mono"
        >
          {/* Connection lines */}
          {nodes.map((node) => {
            const x = LEFT_MARGIN + node.lane * LANE_WIDTH;
            const y = node.row * ROW_HEIGHT + 20;

            return (
              <g key={`lines-${node.commit.hash}`}>
                {node.parents.map((parent, pIndex) => {
                  const parentNode = nodes.find(n => n.commit.hash === parent.hash);
                  if (!parentNode) return null;

                  const parentX = LEFT_MARGIN + parentNode.lane * LANE_WIDTH;
                  const parentY = parentNode.row * ROW_HEIGHT + 20;

                  // Style for merge commits (dashed line from 2nd parent)
                  const isMergeLine = node.commit.parents.length > 1 && pIndex > 0;

                  if (node.lane === parentNode.lane) {
                    // Straight vertical line (same lane)
                    return (
                      <line
                        key={`line-${parent.hash}`}
                        x1={x}
                        y1={y}
                        x2={parentX}
                        y2={parentY}
                        stroke={node.color}
                        strokeWidth={2}
                        strokeDasharray={isMergeLine ? '3,3' : 'none'}
                      />
                    );
                  } else {
                    // Curved line (branch merge/diverge)
                    const curveColor = isMergeLine ? parentNode.color : node.color;
                    return (
                      <path
                        key={`curve-${parent.hash}`}
                        d={getCurvePath(x, y, parentX, parentY)}
                        stroke={curveColor}
                        strokeWidth={2}
                        fill="none"
                        strokeDasharray={isMergeLine ? '3,3' : 'none'}
                      />
                    );
                  }
                })}
              </g>
            );
          })}

          {/* Commit nodes and labels */}
          {nodes.map((node) => {
            const x = LEFT_MARGIN + node.lane * LANE_WIDTH;
            const y = node.row * ROW_HEIGHT + 20;
            const isMerge = node.commit.parents.length > 1;
            const branchLabel = getBranchLabel(node.commit.refs);

            return (
              <g key={`node-${node.commit.hash}`}>
                {/* Commit node circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={isMerge ? NODE_RADIUS + 2 : NODE_RADIUS}
                  fill={node.color}
                  stroke="#0f172a"
                  strokeWidth={2}
                />

                {/* Branch label (left side) */}
                {branchLabel && (
                  <g>
                    <rect
                      x={8}
                      y={y - 10}
                      width={Math.min(branchLabel.length * 7 + 8, 140)}
                      height={18}
                      fill={node.color}
                      fillOpacity={0.2}
                      rx={4}
                      stroke={node.color}
                      strokeWidth={1}
                    />
                    <text
                      x={12}
                      y={y + 4}
                      fill={node.color}
                      fontSize="11"
                      fontWeight="600"
                      className="select-none"
                    >
                      {branchLabel.length > 18
                        ? branchLabel.substring(0, 15) + '...'
                        : branchLabel}
                    </text>
                  </g>
                )}

                {/* Commit info (right side) */}
                <text
                  x={messageStartX}
                  y={y - 6}
                  fill="#94a3b8"
                  fontSize="11"
                  fontWeight="600"
                >
                  {node.commit.shortHash}
                </text>
                <text
                  x={messageStartX}
                  y={y + 8}
                  fill="#e2e8f0"
                  fontSize="12"
                >
                  {node.commit.message.substring(0, 50)}
                  {node.commit.message.length > 50 ? '...' : ''}
                </text>
                <text
                  x={messageStartX}
                  y={y + 20}
                  fill="#64748b"
                  fontSize="10"
                >
                  {node.commit.author} · {node.commit.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
