import React from 'react';
import { FilePlus, Edit3 } from 'lucide-react';
import type { FileChange } from '@/lib/fileChangeAggregator';
import { getFileName } from '@/lib/reasoningUtils';
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

        return (
          <div
            key={`${change.filePath}-${idx}`}
            className={cn(
              "flex items-center px-4 py-1.5 rounded-md",
              "hover:bg-secondary/50 transition-colors",
              onFileClick && "cursor-pointer"
            )}
            onClick={() => onFileClick?.(change.filePath)}
            title={change.filePath}
          >
            {/* Icon for change type - aligned with header chevron */}
            <Icon className="w-3.5 h-3.5 opacity-50 flex-shrink-0" strokeWidth={1.5} />

            {/* Tool name and file name */}
            <span className="text-xs font-light opacity-70 flex-shrink-0 ml-4">
              {change.changeType === 'created' ? 'Write' : 'Edit'}:
            </span>

            {/* File name */}
            <span className="text-xs font-light truncate flex-1 min-w-0 ml-1">
              {fileName}
            </span>

            {/* Diff stats on the right */}
            {(change.additions > 0 || change.deletions > 0) && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono flex-shrink-0 ml-3">
                {change.additions > 0 && (
                  <span className="text-green-500">+{change.additions}</span>
                )}
                {change.deletions > 0 && (
                  <span className="text-red-500">-{change.deletions}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

FileChangeSummary.displayName = 'FileChangeSummary';
