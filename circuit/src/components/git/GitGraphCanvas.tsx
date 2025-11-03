/**
 * GitGraphCanvas - GitKraken-style vertical commit graph with SVG
 */

import { useEffect, useRef, useState } from 'react';
import type { GitCommit } from '@/types/git';
import { Loader2 } from 'lucide-react';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface GitGraphCanvasProps {
  workspacePath: string;
  limit?: number;
}

// Layout constants
const COMMIT_HEIGHT = 50; // Height per commit
const LANE_WIDTH = 30; // Width per branch lane
const NODE_RADIUS = 6; // Commit node circle radius
const LEFT_MARGIN = 150; // Space for branch labels
const RIGHT_MARGIN = 20;

// Branch colors (vibrant)
const BRANCH_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#eab308', // yellow
  '#8b5cf6', // violet
];

interface CommitNode {
  commit: GitCommit;
  lane: number;
  y: number;
  color: string;
  parentLanes: { hash: string; lane: number }[];
}

/**
 * Calculate branch lanes for each commit
 * Key: Keep commits on same vertical line (lane) when they're in linear history
 */
function calculateLanes(commits: GitCommit[]): CommitNode[] {
  const commitLanes: Map<string, number> = new Map(); // commit hash -> lane
  const nodes: CommitNode[] = [];
  let nextLane = 0;

  commits.forEach((commit, index) => {
    let lane: number;

    if (commit.parents.length === 0) {
      // Root commit - new lane
      lane = nextLane++;
    } else {
      // Try to use first parent's lane (maintain vertical line)
      const firstParentLane = commitLanes.get(commit.parents[0]);

      if (firstParentLane !== undefined) {
        // Continue on parent's lane (straight vertical line)
        lane = firstParentLane;
      } else {
        // Parent not seen yet - new lane
        lane = nextLane++;
      }
    }

    commitLanes.set(commit.hash, lane);

    // Find parent lanes for drawing connections
    const parentLanes = commit.parents.map(parentHash => {
      const parentLane = commitLanes.get(parentHash);
      if (parentLane !== undefined) {
        return { hash: parentHash, lane: parentLane };
      } else {
        // Parent not assigned yet - assign new lane
        const newLane = nextLane++;
        commitLanes.set(parentHash, newLane);
        return { hash: parentHash, lane: newLane };
      }
    });

    nodes.push({
      commit,
      lane,
      y: index * COMMIT_HEIGHT,
      color: BRANCH_COLORS[lane % BRANCH_COLORS.length],
      parentLanes,
    });
  });

  return nodes;
}

/**
 * Generate SVG path for curved connection
 */
function getCurvePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

export function GitGraphCanvas({ workspacePath, limit = 50 }: GitGraphCanvasProps) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Load commits
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
      console.error('[GitGraphCanvas] Failed to load commits:', err);
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
  const nodes = calculateLanes(commits);
  const maxLane = Math.max(...nodes.map(n => n.lane));
  const graphWidth = LEFT_MARGIN + (maxLane + 1) * LANE_WIDTH + 300 + RIGHT_MARGIN;
  const graphHeight = commits.length * COMMIT_HEIGHT + 40;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 pb-2 border-b border-sidebar-border">
        <div className="text-xs font-semibold">
          Commit History ({commits.length})
        </div>
        <button
          onClick={loadCommits}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {/* Scrollable graph area */}
      <div className="flex-1 overflow-auto" style={{ maxHeight: '500px' }}>
        <svg
          ref={svgRef}
          width={graphWidth}
          height={graphHeight}
          className="bg-sidebar"
        >
          {/* Draw connection lines */}
          {nodes.map((node, index) => {
            const x1 = LEFT_MARGIN + node.lane * LANE_WIDTH;
            const y1 = node.y + 20;

            return (
              <g key={`lines-${node.commit.hash}`}>
                {node.parentLanes.map((parent, pIndex) => {
                  const parentNode = nodes.find(n => n.commit.hash === parent.hash);
                  if (!parentNode) return null;

                  const x2 = LEFT_MARGIN + parentNode.lane * LANE_WIDTH;
                  const y2 = parentNode.y + 20;

                  // Different style for merge commits
                  const isMerge = node.commit.parents.length > 1 && pIndex > 0;
                  const strokeDasharray = isMerge ? '4,2' : 'none';

                  if (node.lane === parentNode.lane) {
                    // Straight line (same branch)
                    return (
                      <line
                        key={`line-${pIndex}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={node.color}
                        strokeWidth={2}
                        strokeDasharray={strokeDasharray}
                      />
                    );
                  } else {
                    // Curved line (branch merge/split)
                    return (
                      <path
                        key={`curve-${pIndex}`}
                        d={getCurvePath(x1, y1, x2, y2)}
                        stroke={isMerge ? parentNode.color : node.color}
                        strokeWidth={2}
                        fill="none"
                        strokeDasharray={strokeDasharray}
                      />
                    );
                  }
                })}
              </g>
            );
          })}

          {/* Draw commit nodes and labels */}
          {nodes.map((node) => {
            const x = LEFT_MARGIN + node.lane * LANE_WIDTH;
            const y = node.y + 20;
            const isMerge = node.commit.parents.length > 1;

            return (
              <g key={`node-${node.commit.hash}`}>
                {/* Commit node circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={isMerge ? NODE_RADIUS + 2 : NODE_RADIUS}
                  fill={node.color}
                  stroke="#1e293b"
                  strokeWidth={2}
                />

                {/* Commit message */}
                <text
                  x={x + 20}
                  y={y + 4}
                  fill="#e2e8f0"
                  fontSize="12"
                  fontFamily="monospace"
                >
                  <tspan fontWeight="bold">{node.commit.shortHash}</tspan>
                  <tspan dx="8" fill="#94a3b8">
                    {node.commit.message.substring(0, 60)}
                  </tspan>
                </text>

                {/* Branch labels */}
                {node.commit.refs.length > 0 && (
                  <g>
                    {node.commit.refs.map((ref, refIndex) => {
                      // Skip tags and origin refs for now
                      if (ref.includes('tag:') || ref.includes('origin/')) return null;

                      const labelX = x + 20;
                      const labelY = y + 18 + refIndex * 14;

                      return (
                        <g key={`ref-${refIndex}`}>
                          <rect
                            x={labelX}
                            y={labelY - 10}
                            width={ref.length * 6 + 8}
                            height={14}
                            fill={node.color}
                            fillOpacity={0.3}
                            rx={3}
                          />
                          <text
                            x={labelX + 4}
                            y={labelY}
                            fill={node.color}
                            fontSize="10"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {ref.replace('HEAD -> ', '⭐ ')}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
