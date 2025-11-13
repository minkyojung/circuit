/**
 * BlockActions - Reusable action components for block hover pills
 *
 * Provides consistent UI/UX for:
 * - Labels (language, file name, metadata)
 * - Copy button
 * - Bookmark button
 * - Run button (for commands)
 * - Dividers
 *
 * All components share unified sizing and styling from design tokens.
 */

import React, { useState } from 'react';
import { Copy, Check, Bookmark, BookmarkCheck, Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ipcRenderer = window.electron.ipcRenderer;

// ============================================================================
// Label Components
// ============================================================================

export interface BlockLabelProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * BlockLabel - Consistent label styling for block metadata
 * Used for language names, file names, line numbers, etc.
 */
export const BlockLabel: React.FC<BlockLabelProps> = ({ children, className }) => (
  <span
    className={cn(
      'text-[var(--block-label-size)]',
      'font-medium',
      'text-muted-foreground',
      'px-1.5',
      'font-mono',
      className
    )}
  >
    {children}
  </span>
);

/**
 * BlockDivider - Visual separator between pill items
 */
export const BlockDivider = () => (
  <div className="h-3 w-[1px] bg-border mx-0.5" />
);

// ============================================================================
// Action Button Components
// ============================================================================

export interface CopyButtonProps {
  /** Content to copy to clipboard */
  content: string;

  /** Label shown in success toast (e.g., "code", "command", "diff") */
  label?: string;

  /** Optional className for customization */
  className?: string;
}

/**
 * CopyButton - Unified copy-to-clipboard button
 * Shows success state with checkmark for 2 seconds
 */
export const CopyButton: React.FC<CopyButtonProps> = ({
  content,
  label = 'content',
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} copied to clipboard!`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[CopyButton] Copy failed:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center justify-center',
        'rounded-full',
        'p-1',
        'transition-colors',
        'hover:bg-accent',
        className
      )}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
};

export interface BookmarkButtonProps {
  /** Unique block ID for bookmark tracking */
  blockId: string;

  /** Title for the bookmark */
  title: string;

  /** Optional className */
  className?: string;
}

/**
 * BookmarkButton - Toggle bookmark state for a block
 */
export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  blockId,
  title,
  className,
}) => {
  const [bookmarked, setBookmarked] = useState(false);

  const handleBookmark = async () => {
    try {
      if (bookmarked) {
        // TODO: Implement unbookmark - need to track bookmark ID
        console.log('[BookmarkButton] Unbookmark not yet implemented');
      } else {
        const bookmark = {
          id: `bookmark-${Date.now()}`,
          blockId,
          title,
          createdAt: new Date().toISOString(),
        };
        await ipcRenderer.invoke('block:bookmark', bookmark);
        setBookmarked(true);
        toast.success('Bookmarked!');
        console.log('[BookmarkButton] Bookmarked:', blockId);
      }
    } catch (error) {
      console.error('[BookmarkButton] Bookmark error:', error);
      toast.error('Failed to bookmark');
    }
  };

  return (
    <button
      onClick={handleBookmark}
      className={cn(
        'flex items-center justify-center',
        'rounded-full',
        'p-1',
        'transition-colors',
        'hover:bg-accent',
        className
      )}
      title={bookmarked ? 'Bookmarked' : 'Bookmark'}
      aria-label={bookmarked ? 'Bookmarked' : 'Bookmark'}
    >
      {bookmarked ? (
        <BookmarkCheck className="h-3 w-3 text-warning" />
      ) : (
        <Bookmark className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
};

export interface RunButtonProps {
  /** Command to execute */
  command: string;

  /** Callback when command is executed */
  onExecute?: (command: string) => Promise<void>;

  /** Optional className */
  className?: string;
}

/**
 * RunButton - Execute command button (for CommandBlock)
 * Shows loading state during execution
 */
export const RunButton: React.FC<RunButtonProps> = ({
  command,
  onExecute,
  className,
}) => {
  const [executing, setExecuting] = useState(false);

  const handleRun = async () => {
    if (!onExecute) return;

    setExecuting(true);
    try {
      await onExecute(command);
    } catch (error) {
      console.error('[RunButton] Execution error:', error);
      toast.error('Failed to execute command');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <button
      onClick={handleRun}
      disabled={executing}
      className={cn(
        'flex items-center justify-center',
        'rounded-full',
        'p-1',
        'transition-colors',
        'hover:bg-accent',
        'disabled:opacity-50',
        className
      )}
      title="Run command"
      aria-label="Run command"
    >
      {executing ? (
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
      ) : (
        <Play className="h-3 w-3 text-primary fill-primary" />
      )}
    </button>
  );
};

// ============================================================================
// Composite Components
// ============================================================================

export interface BlockPillActionsProps {
  /** Label content (language, file name, etc.) */
  label: React.ReactNode;

  /** Copy button props */
  copyProps?: CopyButtonProps;

  /** Bookmark button props */
  bookmarkProps?: BookmarkButtonProps;

  /** Run button props (optional, for commands) */
  runProps?: RunButtonProps;
}

/**
 * BlockPillActions - Complete action pill with label and buttons
 * Standardized layout with label, divider, and action buttons
 */
export const BlockPillActions: React.FC<BlockPillActionsProps> = ({
  label,
  copyProps,
  bookmarkProps,
  runProps,
}) => {
  return (
    <>
      {/* Label */}
      <BlockLabel>{label}</BlockLabel>

      {/* Divider */}
      <BlockDivider />

      {/* Run button (if command block) */}
      {runProps && <RunButton {...runProps} />}

      {/* Copy button */}
      {copyProps && <CopyButton {...copyProps} />}

      {/* Bookmark button */}
      {bookmarkProps && <BookmarkButton {...bookmarkProps} />}
    </>
  );
};
