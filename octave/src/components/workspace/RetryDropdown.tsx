/**
 * RetryDropdown - Dropdown menu for retrying assistant messages
 *
 * Provides two retry modes:
 * - Normal: Standard regeneration
 * - Extended thinking: Deep reasoning mode for complex problems
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
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
            'inline-flex items-center gap-1',
            'h-[32px] px-2 py-1.5 text-sm rounded-md',
            'text-muted-foreground hover:text-foreground',
            'hover:bg-secondary',
            'transition-colors'
          )}
        >
          <span className="font-light">Retry</span>
          <ChevronDown size={12} strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-40 p-1"
      >
        {/* Option 1: With no changes */}
        <DropdownMenuItem
          onClick={() => onRetry('normal')}
          className="py-2 px-3 cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50"
        >
          <span className="text-sm font-light">With no changes</span>
        </DropdownMenuItem>

        {/* Option 2: With extended thinking */}
        <DropdownMenuItem
          onClick={() => onRetry('extended')}
          className="py-2 px-3 cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-light">With extended thinking</span>
            <span className="text-xs font-light text-muted-foreground">
              Best for math and coding challenges
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
