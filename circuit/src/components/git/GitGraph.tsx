/**
 * GitGraph - Visualizes commit history using Mermaid.js
 */

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import type { GitCommit } from '@/types/git';
import { Loader2 } from 'lucide-react';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface GitGraphProps {
  workspacePath: string;
  limit?: number;
}

/**
 * Convert git commits to Mermaid flowchart (vertical layout)
 */
function commitsToMermaidGraph(commits: GitCommit[]): string {
  if (commits.length === 0) {
    return 'flowchart TB\n  empty["No commits"]';
  }

  const lines: string[] = ['flowchart TB'];

  // Helper to extract branch labels from refs
  const getBranchLabels = (refs: string[]): string => {
    if (refs.length === 0) return '';

    const labels = refs
      .filter(ref => !ref.includes('tag:'))
      .map(ref => {
        // Clean up ref name
        const cleaned = ref
          .replace('HEAD -> ', '⭐ ')
          .replace('origin/', '↗ ');
        return cleaned;
      })
      .join(', ');

    return labels ? `<br/><small>${labels}</small>` : '';
  };

  // Create nodes for each commit
  commits.forEach((commit) => {
    const isMerge = commit.parents.length > 1;
    const branchLabels = getBranchLabels(commit.refs);
    const message = commit.message.substring(0, 60).replace(/"/g, "'");

    // Node style based on commit type
    let nodeStyle = '';
    if (isMerge) {
      nodeStyle = `{{"${commit.shortHash}<br/>${message}${branchLabels}"}}`;
    } else {
      nodeStyle = `["${commit.shortHash}<br/>${message}${branchLabels}"]`;
    }

    lines.push(`  ${commit.hash}${nodeStyle}`);
  });

  // Create edges between commits and parents
  commits.forEach((commit) => {
    commit.parents.forEach((parent, index) => {
      const parentCommit = commits.find(c => c.hash === parent);
      if (parentCommit) {
        // Different arrow style for merge commits
        const arrow = commit.parents.length > 1 && index > 0 ? '-..->' : '-->';
        lines.push(`  ${commit.hash} ${arrow} ${parent}`);
      }
    });
  });

  // Style definitions
  lines.push('');
  lines.push('  classDef default fill:#2d3748,stroke:#4a5568,stroke-width:2px,color:#e2e8f0');
  lines.push('  classDef merge fill:#3730a3,stroke:#4c1d95,stroke-width:3px,color:#e0e7ff');

  return lines.join('\n');
}

export function GitGraph({ workspacePath, limit = 50 }: GitGraphProps) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        git0: '#3b82f6',
        git1: '#22c55e',
        git2: '#f97316',
        git3: '#a855f7',
        git4: '#06b6d4',
        git5: '#f43f5e',
        git6: '#eab308',
        git7: '#8b5cf6',
      },
      gitGraph: {
        rotateCommitLabel: true,
        showBranches: true,
        showCommitLabel: true,
      },
    });
  }, []);

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
      console.error('[GitGraph] Failed to load commits:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCommits();
  }, [workspacePath, limit]);

  // Render Mermaid graph when commits change
  useEffect(() => {
    if (!graphRef.current || commits.length === 0) return;

    const renderGraph = async () => {
      try {
        const mermaidCode = commitsToMermaidGraph(commits);
        console.log('[GitGraph] Rendering:', mermaidCode);

        // Clear previous graph
        graphRef.current!.innerHTML = '';

        // Render new graph
        const { svg } = await mermaid.render('git-graph-svg', mermaidCode);
        graphRef.current!.innerHTML = svg;
      } catch (err) {
        console.error('[GitGraph] Mermaid rendering failed:', err);
        setError('Failed to render graph');
      }
    };

    renderGraph();
  }, [commits]);

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 pb-2">
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
      {/* Scrollable graph area with fixed height */}
      <div className="flex-1 overflow-auto px-4 pb-4" style={{ maxHeight: '400px' }}>
        <div ref={graphRef} className="mermaid-graph min-w-full" />
      </div>
    </div>
  );
}
