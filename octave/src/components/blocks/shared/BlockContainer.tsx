/**
 * BlockContainer - Unified container for all block types
 *
 * Provides consistent structure, styling, and behavior across:
 * - CodeBlock
 * - CommandBlock
 * - DiffBlock
 * - and future block types
 *
 * Features:
 * - Unified border, background, and spacing
 * - Hover-activated action pill overlay
 * - Responsive overflow handling
 * - Consistent typography and padding
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface BlockContainerProps {
  /** Block type determines which CSS variables to use */
  blockType: 'code' | 'command' | 'diff';

  /** Main content of the block */
  children: React.ReactNode;

  /** Action buttons shown on hover (right-aligned pill) */
  hoverActions?: React.ReactNode;

  /** Additional className for customization */
  className?: string;

  /** Data attributes for testing/debugging */
  'data-block-type'?: string;
}

/**
 * BlockContainer - Consistent wrapper for all code-like blocks
 */
export const BlockContainer: React.FC<BlockContainerProps> = ({
  blockType,
  children,
  hoverActions,
  className,
  'data-block-type': dataBlockType,
}) => {
  return (
    <div
      className={cn(
        // Base structure
        'group relative overflow-hidden',

        // Border radius (unified)
        'rounded-[var(--block-radius)]',

        // Border (type-specific)
        'border',
        blockType === 'code' && 'border-[var(--code-border)] bg-[var(--code-bg)]',
        blockType === 'command' && 'border-[var(--command-border)] bg-[var(--command-bg)]',
        blockType === 'diff' && 'border-[var(--diff-border)] bg-[var(--diff-bg)]',

        // Custom overrides
        className
      )}
      data-block-type={dataBlockType || blockType}
    >
      {/* Main content */}
      {children}

      {/* Hover pill - action buttons overlay */}
      {hoverActions && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div
            className={cn(
              'flex items-center',
              'gap-[var(--block-pill-gap)]',
              'rounded-full',
              'bg-background/90 backdrop-blur-sm',
              'border border-border',
              'shadow-lg',
              'px-[var(--block-pill-padding-x)]',
              'py-[var(--block-pill-padding-y)]'
            )}
          >
            {hoverActions}
          </div>
        </div>
      )}
    </div>
  );
};

BlockContainer.displayName = 'BlockContainer';
