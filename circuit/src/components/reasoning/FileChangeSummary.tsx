import React from 'react';
import { CheckCircle, FileText, FilePlus, Edit3 } from 'lucide-react';
import type { FileChange } from '@/lib/fileChangeAggregator';
import { formatDiffStats, getFileName } from '@/lib/reasoningUtils';
import { cn } from '@/lib/utils';

interface FileChangeSummaryProps {
  fileChanges: FileChange[];
  className?: string;
  onFileClick?: (filePath: string) => void;
}

/**
 * FileChangeSummary - Displays a compact list of file modifications
 * Shows only Edit/Write operations with diff statistics
 */
export const FileChangeSummary: React.FC<FileChangeSummaryProps> = ({
  fileChanges,
  className,
  onFileClick,
}) => {
  if (fileChanges.length === 0) {
    return (
      <div className={cn("py-3 px-4 text-sm font-light opacity-50", className)}>
        No files modified
      </div>
    );
  }

  return (
    <div className={cn("py-2 space-y-1", className)}>
      {fileChanges.map((change, idx) => {
        const Icon = change.changeType === 'created' ? FilePlus : Edit3;
        const fileName = getFileName(change.filePath);
        const diffStats = formatDiffStats(change.additions, change.deletions);

        return (
          <div
            key={`${change.filePath}-${idx}`}
            className={cn(
              "flex items-center gap-2.5 px-4 py-2 rounded-md",
              "hover:bg-secondary/50 transition-colors",
              onFileClick && "cursor-pointer"
            )}
            onClick={() => onFileClick?.(change.filePath)}
            title={change.filePath}
          >
            {/* Success checkmark */}
            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" strokeWidth={2} />

            {/* Icon for change type */}
            <Icon className="w-3.5 h-3.5 opacity-50 flex-shrink-0" strokeWidth={1.5} />

            {/* Tool name */}
            <span className="text-sm font-light opacity-70 flex-shrink-0">
              {change.changeType === 'created' ? 'Write' : 'Edit'}:
            </span>

            {/* File name */}
            <span className="text-sm font-light truncate flex-1 min-w-0">
              {fileName}
            </span>

            {/* Diff stats */}
            {diffStats && (
              <span className="text-xs font-mono flex-shrink-0">
                {change.additions > 0 && (
                  <span className="text-green-500">+{change.additions}</span>
                )}
                {change.additions > 0 && change.deletions > 0 && (
                  <span className="opacity-50 mx-0.5"></span>
                )}
                {change.deletions > 0 && (
                  <span className="text-red-500">-{change.deletions}</span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

FileChangeSummary.displayName = 'FileChangeSummary';
