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
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface GitGraphV2Props {
  workspacePath: string;
  limit?: number;
}

// Layout constants (ultra-compact design)
const ROW_HEIGHT = 20;        // Maximum density row height
const LANE_WIDTH = 24;        // Width between lanes
const NODE_RADIUS = 7;        // Small avatar circle
const MERGE_NODE_RADIUS = 9;  // Merge commit avatar (slightly larger)
const LEFT_MARGIN = 110;      // Minimal space for branch labels
const MESSAGE_WIDTH = 500;    // Width for commit messages
const RIGHT_MARGIN = 20;
const LINE_WIDTH = 2;         // Thinner connection lines
const MESSAGE_GAP = 8;        // Minimal gap between node and message

// Branch colors (vibrant yet professional)
const COLORS = [
  '#60a5fa', // blue-400 (softer blue)
  '#34d399', // emerald-400 (vibrant green)
  '#fb923c', // orange-400 (warm orange)
  '#c084fc', // purple-400 (soft purple)
  '#22d3ee', // cyan-400 (bright cyan)
  '#fb7185', // rose-400 (soft rose)
  '#facc15', // yellow-400 (bright yellow)
  '#a78bfa', // violet-400 (soft violet)
];

/**
 * Simple MD5 hash for Gravatar (browser-compatible)
 */
async function md5(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('MD5', data).catch(() => null);

  if (!hashBuffer) {
    // Fallback: simple hash
    return Array.from(str).reduce((hash, char) => {
      return ((hash << 5) - hash) + char.charCodeAt(0) | 0;
    }, 0).toString(16);
  }

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get Gravatar URL for email
 */
function getGravatarUrl(email: string): string {
  // Note: We'll use a synchronous approach with initials fallback
  // Real MD5 hashing would be done async, but for simplicity we'll use initials
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split('@')[0])}&background=random&size=32&font-size=0.4`;
}

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
 * Lane assignment algorithm with Lane Reclamation & Compaction
 *
 * Strategy:
 * 1. Build parent-child relationships
 * 2. Process commits oldest->newest (reversed)
 * 3. Track active lanes and available lanes pool
 * 4. First child continues parent's lane
 * 5. Additional children (branches) get new lanes from available pool first
 * 6. Merge commits free up merged branch lanes immediately
 * 7. Compact lanes to remove gaps (final step)
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

  // Step 2: Process in reverse order (oldest first) with lane reclamation
  const reversed = [...commits].reverse();
  const hashToLane = new Map<string, number>();
  const activeLanes = new Set<number>();
  const availableLanes: number[] = [];

  reversed.forEach((commit) => {
    let lane: number;

    if (commit.parents.length === 0) {
      // Root commit - always lane 0
      lane = 0;
      activeLanes.add(0);
    } else {
      // Get first parent's lane (main branch continuation)
      const firstParentLane = hashToLane.get(commit.parents[0]);

      if (firstParentLane !== undefined) {
        const siblings = hashToChildren.get(commit.parents[0]) || [];

        // First sibling (newest in git log) continues parent's lane
        if (siblings.length > 0 && siblings[0] === commit.hash) {
          lane = firstParentLane;
          activeLanes.add(lane);
        } else {
          // This is a branch - allocate new lane
          // First try to reuse available lanes
          if (availableLanes.length > 0) {
            lane = availableLanes.shift()!;
          } else {
            // No available lanes - allocate new one
            lane = activeLanes.size > 0 ? Math.max(...activeLanes) + 1 : 0;
          }
          activeLanes.add(lane);
        }
      } else {
        // Parent not seen yet - allocate new lane
        if (availableLanes.length > 0) {
          lane = availableLanes.shift()!;
        } else {
          lane = activeLanes.size > 0 ? Math.max(...activeLanes) + 1 : 0;
        }
        activeLanes.add(lane);
      }

      // Handle merge commits - free up merged branch lanes
      if (commit.parents.length > 1) {
        // All parents except the first are merged branches
        commit.parents.slice(1).forEach(mergedParentHash => {
          const mergedLane = hashToLane.get(mergedParentHash);
          if (mergedLane !== undefined && mergedLane !== lane) {
            // Free this lane for reuse
            activeLanes.delete(mergedLane);
            availableLanes.push(mergedLane);
            // Keep availableLanes sorted (smallest first for compact layout)
            availableLanes.sort((a, b) => a - b);
          }
        });
      }
    }

    hashToLane.set(commit.hash, lane);

    // Pre-assign lanes for branch splits
    const children = hashToChildren.get(commit.hash) || [];
    if (children.length > 1) {
      // children[0] will continue this lane (handled above)
      // children[1...] get new lanes
      for (let i = 1; i < children.length; i++) {
        if (!hashToLane.has(children[i])) {
          let branchLane: number;
          if (availableLanes.length > 0) {
            branchLane = availableLanes.shift()!;
          } else {
            branchLane = activeLanes.size > 0 ? Math.max(...activeLanes) + 1 : 0;
          }
          hashToLane.set(children[i], branchLane);
          activeLanes.add(branchLane);
        }
      }
    }
  });

  // Step 3: Lane Compaction - remove gaps in lane numbers
  const usedLanes = Array.from(new Set(hashToLane.values())).sort((a, b) => a - b);
  const laneMapping = new Map<number, number>();
  usedLanes.forEach((oldLane, newIndex) => {
    laneMapping.set(oldLane, newIndex);
  });

  // Remap all lanes to compacted values
  const compactedHashToLane = new Map<string, number>();
  hashToLane.forEach((lane, hash) => {
    compactedHashToLane.set(hash, laneMapping.get(lane) ?? 0);
  });

  // Step 4: Build final nodes with compacted lanes
  const nodes: CommitNode[] = commits.map((commit, index) => {
    const lane = compactedHashToLane.get(commit.hash) ?? 0;

    const parentNodes = commit.parents.map(parentHash => ({
      hash: parentHash,
      lane: compactedHashToLane.get(parentHash) ?? lane,
    }));

    return {
      commit,
      row: index,
      lane,
      color: COLORS[lane % COLORS.length],
      parents: parentNodes,
    };
  });

  const maxLane = Math.max(...nodes.map(n => n.lane), 0);
  const laneDistribution = nodes.reduce((acc, n) => {
    acc[n.lane] = (acc[n.lane] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  console.log('[GitGraphV2] Lane assignment with reclamation:', {
    commits: nodes.length,
    maxLane,
    lanesBeforeCompaction: usedLanes.length,
    lanesAfterCompaction: maxLane + 1,
    laneDistribution,
    reclaimedLanes: usedLanes.length - (maxLane + 1),
  });

  return nodes;
}

/**
 * Generate SVG path for 90-degree connections with rounded corners (GitKraken style)
 */
function get90DegreePath(x1: number, y1: number, x2: number, y2: number): string {
  const radius = 8; // Corner radius for smooth 90-degree turns
  const midY = y1 + (y2 - y1) / 2;

  if (x1 === x2) {
    // Straight vertical line
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  // 90-degree path with rounded corners
  // Start -> down -> across -> down -> end
  const dx = x2 - x1;
  const cornerRadius = Math.min(radius, Math.abs(dx) / 2, Math.abs(y2 - y1) / 4);

  if (dx > 0) {
    // Moving right
    return `
      M ${x1} ${y1}
      L ${x1} ${midY - cornerRadius}
      Q ${x1} ${midY}, ${x1 + cornerRadius} ${midY}
      L ${x2 - cornerRadius} ${midY}
      Q ${x2} ${midY}, ${x2} ${midY + cornerRadius}
      L ${x2} ${y2}
    `;
  } else {
    // Moving left
    return `
      M ${x1} ${y1}
      L ${x1} ${midY - cornerRadius}
      Q ${x1} ${midY}, ${x1 - cornerRadius} ${midY}
      L ${x2 + cornerRadius} ${midY}
      Q ${x2} ${midY}, ${x2} ${midY + cornerRadius}
      L ${x2} ${y2}
    `;
  }
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

export function GitGraphV2({ workspacePath, limit = 5000 }: GitGraphV2Props) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
  const messageStartX = LEFT_MARGIN + (maxLane + 1) * LANE_WIDTH + MESSAGE_GAP;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2 border-b border-sidebar-border">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary transition-colors"
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          Commit History ({commits.length})
        </button>
        <button
          onClick={loadCommits}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Scrollable graph area */}
      {!isCollapsed && (
        <div
          className="flex-1 overflow-auto"
          style={{ maxHeight: '600px' }}
        >
        <svg
          width={graphWidth}
          height={graphHeight}
          className="font-mono"
        >
          {/* SVG Filters and Definitions */}
          <defs>
            {/* Very subtle shadow for commit nodes */}
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
              <feOffset dx="0" dy="0.5" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.2" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

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
                        strokeWidth={LINE_WIDTH}
                        strokeDasharray={isMergeLine ? '4,4' : 'none'}
                        strokeLinecap="round"
                      />
                    );
                  } else {
                    // 90-degree line (branch merge/diverge) with rounded corners
                    const curveColor = isMergeLine ? parentNode.color : node.color;
                    return (
                      <path
                        key={`curve-${parent.hash}`}
                        d={get90DegreePath(x, y, parentX, parentY)}
                        stroke={curveColor}
                        strokeWidth={LINE_WIDTH}
                        fill="none"
                        strokeDasharray={isMergeLine ? '4,4' : 'none'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
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

            const avatarUrl = getGravatarUrl(node.commit.email || node.commit.author);
            const radius = isMerge ? MERGE_NODE_RADIUS : NODE_RADIUS;

            return (
              <g key={`node-${node.commit.hash}`} className="commit-node">
                {/* Avatar circle with border */}
                <circle
                  cx={x}
                  cy={y}
                  r={radius + 0.5}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={1.5}
                  filter="url(#shadow)"
                />

                {/* Avatar image (clipped to circle) */}
                <defs>
                  <clipPath id={`clip-${node.commit.hash}`}>
                    <circle cx={x} cy={y} r={radius} />
                  </clipPath>
                </defs>
                <image
                  href={avatarUrl}
                  x={x - radius}
                  y={y - radius}
                  width={radius * 2}
                  height={radius * 2}
                  clipPath={`url(#clip-${node.commit.hash})`}
                  preserveAspectRatio="xMidYMid slice"
                />

                {/* Branch label (left side) - ultra compact */}
                {branchLabel && (
                  <g>
                    {/* Connection line from label to node */}
                    <line
                      x1={Math.min(branchLabel.length * 5.5 + 14, 101)}
                      y1={y}
                      x2={x - radius - 2}
                      y2={y}
                      stroke={node.color}
                      strokeWidth={0.5}
                      strokeDasharray="2,2"
                      opacity={0.4}
                    />
                    <rect
                      x={6}
                      y={y - 8}
                      width={Math.min(branchLabel.length * 5.5 + 8, 95)}
                      height={14}
                      fill={node.color}
                      fillOpacity={0.15}
                      rx={3}
                      stroke={node.color}
                      strokeWidth={1}
                    />
                    <text
                      x={10}
                      y={y + 2}
                      fill={node.color}
                      fontSize="9"
                      fontWeight="600"
                      className="select-none"
                    >
                      {branchLabel.length > 14
                        ? branchLabel.substring(0, 11) + '...'
                        : branchLabel}
                    </text>
                  </g>
                )}

                {/* Commit message only (right side) - lighter font */}
                <text
                  x={messageStartX}
                  y={y + 3}
                  fill="#d1d5db"
                  fontSize="11"
                  style={{ fontWeight: 300 }}
                >
                  {node.commit.message.substring(0, 65)}
                  {node.commit.message.length > 65 ? '...' : ''}
                </text>
              </g>
            );
          })}
        </svg>
        </div>
      )}
    </div>
  );
}
