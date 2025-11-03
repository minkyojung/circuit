/**
 * GitGraphV3 - Branch-First Architecture
 *
 * Complete rewrite using GitKraken-style branch management:
 * 1. Branches are first-class entities with assigned lanes
 * 2. Commits inherit lane/color from their primary branch
 * 3. Lane reclamation and hierarchical placement
 * 4. Visual consistency per branch
 */

import { useEffect, useState } from 'react';
import type { BranchGraph, EnrichedCommit } from '@/types/git';
import { buildBranchGraph } from '@/lib/gitGraph/graphBuilder';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface GitGraphV3Props {
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
    if (ref.startsWith('HEAD ->')) {
      return ref.replace('HEAD -> ', '').trim();
    }
    if (!ref.includes('/') && !ref.includes('origin')) {
      return ref.trim();
    }
  }
  return null;
}

/**
 * Get Gravatar URL for email
 */
function getGravatarUrl(email: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split('@')[0])}&background=random&size=32&font-size=0.4`;
}

export function GitGraphV3({ workspacePath, limit = 5000 }: GitGraphV3Props) {
  const [graph, setGraph] = useState<BranchGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    loadGraph();
  }, [workspacePath]);

  async function loadGraph() {
    setLoading(true);

    try {
      // Load commits and refs
      const [commitsResult, refsResult] = await Promise.all([
        ipcRenderer.invoke('git:log', workspacePath, limit),
        ipcRenderer.invoke('git:refs', workspacePath),
      ]);

      if (!commitsResult.success || !refsResult.success) {
        console.error('[GitGraphV3] Failed to load data');
        return;
      }

      const commits = commitsResult.commits || [];
      const refs = refsResult.refs || [];

      // Build branch graph
      const branchGraph = buildBranchGraph(commits, refs);

      setGraph(branchGraph);
    } catch (error) {
      console.error('[GitGraphV3] Failed to load:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  if (!graph || graph.commits.size === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No commits found
      </div>
    );
  }

  // Convert commits Map to array (already in topological order from git log)
  const commits = Array.from(graph.commits.values());
  const maxLane = Math.max(...commits.map(c => c.lane), 0);

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
          onClick={loadGraph}
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
            {commits.map((commit, index) => {
              const x = LEFT_MARGIN + commit.lane * LANE_WIDTH;
              const y = index * ROW_HEIGHT + 20;

              return (
                <g key={`lines-${commit.hash}`}>
                  {commit.parents.map((parentHash, pIndex) => {
                    const parentCommit = commits.find(c => c.hash === parentHash);
                    if (!parentCommit) return null;

                    const parentX = LEFT_MARGIN + parentCommit.lane * LANE_WIDTH;
                    const parentY = commits.indexOf(parentCommit) * ROW_HEIGHT + 20;

                    // Style for merge commits
                    const isMergeLine = commit.parents.length > 1 && pIndex > 0;

                    if (commit.lane === parentCommit.lane) {
                      // Straight vertical line (same lane)
                      return (
                        <line
                          key={`line-${parentHash}`}
                          x1={x}
                          y1={y}
                          x2={parentX}
                          y2={parentY}
                          stroke={commit.color}
                          strokeWidth={LINE_WIDTH}
                          strokeLinecap="round"
                        />
                      );
                    } else {
                      // 90-degree line (branch merge/diverge) with rounded corners
                      const curveColor = isMergeLine ? parentCommit.color : commit.color;
                      const pathData = isMergeLine
                        ? get90DegreePath(parentX, parentY, x, y)  // branch → merge commit
                        : get90DegreePath(x, y, parentX, parentY);  // commit → parent

                      return (
                        <path
                          key={`curve-${parentHash}`}
                          d={pathData}
                          stroke={curveColor}
                          strokeWidth={LINE_WIDTH}
                          fill="none"
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
            {commits.map((commit, index) => {
              const x = LEFT_MARGIN + commit.lane * LANE_WIDTH;
              const y = index * ROW_HEIGHT + 20;
              const isMerge = commit.isMergeCommit;
              const branchLabel = getBranchLabel(commit.refs);

              const avatarUrl = getGravatarUrl(commit.email || commit.author);
              const radius = isMerge ? MERGE_NODE_RADIUS : NODE_RADIUS;

              return (
                <g key={`node-${commit.hash}`} className="commit-node">
                  {/* Avatar circle with border */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 0.5}
                    fill="none"
                    stroke={commit.color}
                    strokeWidth={1.5}
                    filter="url(#shadow)"
                  />

                  {/* Avatar image (clipped to circle) */}
                  <defs>
                    <clipPath id={`clip-${commit.hash}`}>
                      <circle cx={x} cy={y} r={radius} />
                    </clipPath>
                  </defs>
                  <image
                    href={avatarUrl}
                    x={x - radius}
                    y={y - radius}
                    width={radius * 2}
                    height={radius * 2}
                    clipPath={`url(#clip-${commit.hash})`}
                    preserveAspectRatio="xMidYMid slice"
                  />

                  {/* Branch label with dotted line */}
                  {branchLabel && (
                    <g>
                      <line
                        x1={Math.min(branchLabel.length * 5.5 + 14, 101)}
                        y1={y}
                        x2={x - radius - 2}
                        y2={y}
                        stroke={commit.color}
                        strokeWidth={0.5}
                        strokeDasharray="2,2"
                        opacity={0.4}
                      />
                      <rect
                        x={6}
                        y={y - 8}
                        width={Math.min(branchLabel.length * 5.5 + 8, 95)}
                        height={14}
                        fill={commit.color}
                        fillOpacity={0.15}
                        rx={3}
                        stroke={commit.color}
                        strokeWidth={1}
                      />
                      <text
                        x={10}
                        y={y + 2}
                        fill={commit.color}
                        fontSize="9"
                        fontWeight="600"
                      >
                        {branchLabel.length > 14 ? branchLabel.substring(0, 11) + '...' : branchLabel}
                      </text>
                    </g>
                  )}

                  {/* Commit message */}
                  <text
                    x={messageStartX}
                    y={y + 3}
                    fill="#d1d5db"
                    fontSize="11"
                    style={{ fontWeight: 300 }}
                  >
                    {commit.message.substring(0, 65)}
                    {commit.message.length > 65 ? '...' : ''}
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
