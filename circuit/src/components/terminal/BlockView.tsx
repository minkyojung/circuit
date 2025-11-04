/**
 * BlockView Component
 *
 * Renders a single terminal block (command + output)
 * Warp-inspired design with actions and metadata
 */

import { useState } from 'react';
import { Copy, RotateCw, Bookmark, Clock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { TerminalBlock } from '@/types/terminal';
import { cn } from '@/lib/utils';

interface BlockViewProps {
  block: TerminalBlock;
  showTimestamp?: boolean;
  highlightFailed?: boolean;
  onRerun?: (command: string) => void;
  onCopy?: (text: string) => void;
}

export function BlockView({
  block,
  showTimestamp = true,
  highlightFailed = true,
  onRerun,
  onCopy,
}: BlockViewProps) {
  const [isHovered, setIsHovered] = useState(false);

  const duration = block.endTime ? block.endTime - block.startTime : null;
  const isRunning = block.status === 'running';
  const isFailed = block.status === 'failed';

  const handleCopyCommand = () => {
    if (onCopy) {
      onCopy(block.command);
    } else {
      navigator.clipboard.writeText(block.command);
    }
  };

  const handleCopyOutput = () => {
    if (onCopy) {
      onCopy(block.output);
    } else {
      navigator.clipboard.writeText(block.output);
    }
  };

  const handleRerun = () => {
    if (onRerun) {
      onRerun(block.command);
    }
  };

  return (
    <div
      className={cn(
        'group relative border-l-2 transition-all',
        isRunning && 'border-l-blue-500',
        isFailed && highlightFailed && 'border-l-red-500',
        !isRunning && !isFailed && 'border-l-green-500',
        'hover:bg-muted/30'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Block Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        {/* Command */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Status Icon */}
          <div className="flex-shrink-0">
            {isRunning && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
            {isFailed && <AlertCircle className="w-4 h-4 text-red-500" />}
            {!isRunning && !isFailed && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          </div>

          {/* Command Text */}
          <code className="text-sm font-mono text-foreground truncate flex-1">
            {block.command || '(empty command)'}
          </code>
        </div>

        {/* Metadata & Actions */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {/* Timestamp */}
          {showTimestamp && duration !== null && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDuration(duration)}</span>
            </div>
          )}

          {/* Exit Code */}
          {block.exitCode !== null && (
            <div
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded',
                block.exitCode === 0
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'bg-red-500/10 text-red-700 dark:text-red-400'
              )}
            >
              {block.exitCode === 0 ? 'Success' : `Exit ${block.exitCode}`}
            </div>
          )}

          {/* Actions (visible on hover) */}
          <div
            className={cn(
              'flex items-center gap-1 transition-opacity',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
          >
            <button
              onClick={handleCopyCommand}
              className="p-1.5 hover:bg-muted rounded transition-colors"
              title="Copy command"
            >
              <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>

            {onRerun && !isRunning && (
              <button
                onClick={handleRerun}
                className="p-1.5 hover:bg-muted rounded transition-colors"
                title="Rerun command"
              >
                <RotateCw className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}

            <button className="p-1.5 hover:bg-muted rounded transition-colors" title="Bookmark">
              <Bookmark className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Block Output */}
      {block.output && (
        <div className="relative">
          <pre
            className="px-4 py-3 text-sm font-mono text-foreground/90 whitespace-pre-wrap break-words overflow-x-auto max-h-[500px] overflow-y-auto"
            style={{ tabSize: 4 }}
          >
            {block.output}
          </pre>

          {/* Copy Output Button (bottom-right) */}
          <button
            onClick={handleCopyOutput}
            className={cn(
              'absolute bottom-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm border border-border rounded transition-opacity',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
            title="Copy output"
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      )}

      {/* Empty Output Placeholder */}
      {!block.output && isRunning && (
        <div className="px-4 py-3 text-sm text-muted-foreground italic">
          Waiting for output...
        </div>
      )}
    </div>
  );
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}
