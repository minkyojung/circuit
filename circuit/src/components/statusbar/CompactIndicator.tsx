/**
 * CompactIndicator Component
 *
 * Displays context usage warning in the StatusBar
 * Shows different colors and icons based on severity level
 */

import React from 'react';
import { AlertCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import { useAutoCompact } from '@/hooks/useAutoCompact';
import { cn } from '@/lib/utils';

interface ContextMetrics {
  current: number;
  limit: number;
  percentage: number;
  lastCompact: string | null;
  sessionStart: string;
  prunableTokens: number;
  shouldCompact: boolean;
}

interface CompactIndicatorProps {
  workspaceId?: string;
  workspacePath?: string;
  context: ContextMetrics | null; // Required
}

export const CompactIndicator: React.FC<CompactIndicatorProps> = ({
  workspaceId,
  workspacePath,
  context,
}) => {
  // Don't show anything if no context
  if (!context) {
    return null;
  }

  const { compactState, percentage } = useAutoCompact({ workspaceId, workspacePath, context });

  // Don't show anything for normal level
  if (compactState.level === 'normal') {
    return null;
  }

  const config = {
    warning: {
      icon: AlertCircle,
      iconColor: 'text-yellow-500',
      textColor: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      text: 'Consider compacting',
    },
    recommend: {
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      textColor: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      text: 'Compact recommended',
    },
    urgent: {
      icon: AlertOctagon,
      iconColor: 'text-red-500',
      textColor: 'text-red-500',
      bgColor: 'bg-red-500/10',
      text: 'Compact urgently needed',
    },
  };

  const { icon: Icon, iconColor, textColor, bgColor, text } = config[compactState.level];

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md transition-all',
        bgColor
      )}
      title={`Context at ${percentage.toFixed(0)}% - ${text}`}
    >
      <Icon size={12} className={cn(iconColor, 'animate-pulse')} />
      <span className={cn('text-[9px] font-medium', textColor)}>
        {text} ({percentage.toFixed(0)}%)
      </span>
    </div>
  );
};
