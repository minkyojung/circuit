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
  default: 'bg-background border-border/50 hover:border-border',
  primary: 'bg-background border-border/50 hover:border-border',
  accent: 'bg-background border-border/50 hover:border-border',
  muted: 'bg-background border-border/50 hover:border-border',
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
