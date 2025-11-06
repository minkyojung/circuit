/**
 * RetryDropdown - Dropdown menu for retrying assistant messages
 *
 * Provides two retry modes:
 * - Normal: Standard regeneration
 * - Extended thinking: Deep reasoning mode for complex problems
 */

import React from 'react';
import { RotateCw, ChevronDown, Sparkles, Zap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface RetryDropdownProps {
  onRetry: (mode: 'normal' | 'extended') => void;
}

export function RetryDropdown({ onRetry }: RetryDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
            'bg-transparent border border-border/50',
            'hover:bg-card/30 hover:border-border',
            'backdrop-blur-sm transition-all',
            'text-sm font-medium text-foreground/80 hover:text-foreground'
          )}
        >
          <RotateCw className="w-3.5 h-3.5" strokeWidth={2} />
          Retry
          <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className={cn(
          'min-w-[280px]',
          'bg-card/95 backdrop-blur-md',
          'border border-border',
          'shadow-xl'
        )}
      >
        {/* Option 1: With no changes */}
        <DropdownMenuItem
          onClick={() => onRetry('normal')}
          className={cn(
            'flex items-start gap-3 px-3 py-2.5',
            'cursor-pointer',
            'focus:bg-accent/50'
          )}
        >
          <Zap className="w-4 h-4 mt-0.5 text-muted-foreground" strokeWidth={2} />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              With no changes
            </span>
          </div>
        </DropdownMenuItem>

        {/* Option 2: With extended thinking */}
        <DropdownMenuItem
          onClick={() => onRetry('extended')}
          className={cn(
            'flex items-start gap-3 px-3 py-2.5',
            'cursor-pointer',
            'focus:bg-accent/50'
          )}
        >
          <Sparkles className="w-4 h-4 mt-0.5 text-green-500" strokeWidth={2} />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              With extended thinking
            </span>
            <span className="text-xs text-muted-foreground">
              Best for math and coding challenges
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
