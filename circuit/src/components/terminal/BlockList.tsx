/**
 * BlockList Component
 *
 * Virtualized list of terminal blocks for performance
 * Uses @tanstack/react-virtual for efficient rendering
 */

import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TerminalBlock } from '@/types/terminal';
import { BlockView } from './BlockView';

interface BlockListProps {
  blocks: TerminalBlock[];
  workspaceId: string;
  showTimestamps?: boolean;
  highlightFailed?: boolean;
  onRerun?: (command: string) => void;
  autoScroll?: boolean;
}

export function BlockList({
  blocks,
  workspaceId,
  showTimestamps = true,
  highlightFailed = true,
  onRerun,
  autoScroll = true,
}: BlockListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const prevBlockCountRef = useRef(blocks.length);

  // Virtualizer for performance
  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150, // Estimated block height
    overscan: 5, // Render 5 extra blocks above/below viewport
  });

  // Auto-scroll to bottom when new blocks are added
  useEffect(() => {
    if (autoScroll && blocks.length > prevBlockCountRef.current) {
      // New block added, scroll to bottom
      if (parentRef.current) {
        parentRef.current.scrollTop = parentRef.current.scrollHeight;
      }
    }
    prevBlockCountRef.current = blocks.length;
  }, [blocks.length, autoScroll]);

  // Empty state
  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-sm">No commands executed yet</p>
          <p className="text-xs">Run a command to see it appear as a block</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto bg-background"
      style={{
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const block = blocks[virtualRow.index];

          return (
            <div
              key={block.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <BlockView
                block={block}
                showTimestamp={showTimestamps}
                highlightFailed={highlightFailed}
                onRerun={onRerun}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
