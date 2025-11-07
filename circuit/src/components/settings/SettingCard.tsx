/**
 * SettingCard - Cursor-style setting card component
 * Used for individual settings items with title, description, and action
 */

import React, { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  stats?: string;
  action?: ReactNode;
  variant?: 'default' | 'primary' | 'accent' | 'muted';
  onClick?: () => void;
  className?: string;
}

const variantStyles = {
  default: 'bg-muted/30 border-border hover:bg-muted/40',
  primary: 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10',
  accent: 'bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10',
  muted: 'bg-muted/20 border-border/50 hover:bg-muted/30',
};

export const SettingCard: React.FC<SettingCardProps> = ({
  title,
  description,
  icon,
  stats,
  action,
  variant = 'default',
  onClick,
  className,
}) => {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center justify-between p-4 rounded-lg border transition-all',
        variantStyles[variant],
        isClickable && 'cursor-pointer',
        className
      )}
    >
      {/* Left side: Icon + Content */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {icon && (
          <div className="flex-shrink-0 mt-0.5 text-foreground/60 group-hover:text-foreground/80 transition-colors">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground">{title}</h4>
            {stats && (
              <span className="text-xs text-muted-foreground font-mono">
                {stats}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* Right side: Action */}
      {action && (
        <div className="flex-shrink-0 ml-4">
          {action}
        </div>
      )}
    </div>
  );
};
