/**
 * CompactBanner Component
 *
 * Full-width banner that appears at the top of the app
 * when context usage reaches warning/recommend/urgent levels
 *
 * Provides quick actions: Copy command, Open Claude Code, Dismiss
 */

import React from 'react';
import { X, ExternalLink, Copy, AlertCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import { useAutoCompact } from '@/hooks/useAutoCompact';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CompactBannerProps {
  workspaceId?: string;
  workspacePath?: string;
}

export const CompactBanner: React.FC<CompactBannerProps> = ({
  workspaceId,
  workspacePath,
}) => {
  const {
    shouldShowBanner,
    compactState,
    percentage,
    dismissWarning,
    openClaudeCode,
    copyCompactCommand,
  } = useAutoCompact({ workspaceId, workspacePath });

  if (!shouldShowBanner || compactState.level === 'normal') {
    return null;
  }

  const config: Record<Exclude<typeof compactState.level, 'normal'>, {
    icon: typeof AlertCircle;
    bgColor: string;
    borderColor: string;
    textColor: string;
    iconColor: string;
    buttonHover: string;
  }> = {
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      textColor: 'text-yellow-900 dark:text-yellow-100',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      buttonHover: 'hover:bg-yellow-100 dark:hover:bg-yellow-800/30',
    },
    recommend: {
      icon: AlertTriangle,
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      textColor: 'text-orange-900 dark:text-orange-100',
      iconColor: 'text-orange-600 dark:text-orange-400',
      buttonHover: 'hover:bg-orange-100 dark:hover:bg-orange-800/30',
    },
    urgent: {
      icon: AlertOctagon,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-900 dark:text-red-100',
      iconColor: 'text-red-600 dark:text-red-400',
      buttonHover: 'hover:bg-red-100 dark:hover:bg-red-800/30',
    },
  };

  const { icon: Icon, bgColor, borderColor, textColor, iconColor, buttonHover } =
    config[compactState.level];

  const handleCopy = () => {
    copyCompactCommand();
    toast.success('"/compact" copied to clipboard', {
      duration: 2000,
    });
  };

  const handleOpen = () => {
    openClaudeCode();
    toast.info('Opening Claude Code...', {
      duration: 2000,
    });
  };

  return (
    <div
      className={cn(
        'border-b px-4 py-2.5 flex items-center justify-between transition-all',
        bgColor,
        borderColor,
        textColor
      )}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className={cn(iconColor, 'flex-shrink-0')} />

        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="text-sm font-semibold">
            Context at {percentage.toFixed(0)}%
          </span>
          <span className="text-xs opacity-80">
            Switch to Claude Code and run{' '}
            <code className="px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded font-mono">
              /compact
            </code>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className={cn(
            'text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1.5',
            buttonHover
          )}
          title="Copy /compact command to clipboard"
        >
          <Copy size={12} />
          <span className="hidden sm:inline">Copy</span>
        </button>

        <button
          onClick={handleOpen}
          className={cn(
            'text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1.5',
            buttonHover
          )}
          title="Open Claude Code"
        >
          <ExternalLink size={12} />
          <span className="hidden sm:inline">Open</span>
        </button>

        <div className="w-px h-4 bg-current opacity-20" />

        <button
          onClick={dismissWarning}
          className={cn('p-1.5 rounded transition-colors', buttonHover)}
          title="Dismiss warning"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
