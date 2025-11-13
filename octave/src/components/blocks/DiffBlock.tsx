/**
 * DiffBlock - Renders diff content with syntax highlighting
 *
 * Refactored to use unified block architecture.
 *
 * Features:
 * - Color-coded diff lines (additions/deletions/context)
 * - File name and stats in hover pill
 * - Copy action
 * - Minimal design with unified padding
 * - Consistent typography
 */

import React from 'react';
import type { Block } from '../../types/conversation';
import { BlockContainer, BlockLabel, BlockDivider, CopyButton } from './shared';

interface DiffBlockProps {
  block: Block;
  onCopy: (content: string) => void;
}

export const DiffBlock: React.FC<DiffBlockProps> = ({ block }) => {
  // Build hover label content
  const labelContent = block.metadata.fileName ? (
    <>
      {block.metadata.fileName}
      {block.metadata.additions !== undefined && block.metadata.deletions !== undefined && (
        <span className="ml-1.5">
          <span className="text-green-400">+{block.metadata.additions}</span>
          {' '}
          <span className="text-red-400">-{block.metadata.deletions}</span>
        </span>
      )}
    </>
  ) : (
    'diff'
  );

  // Hover actions pill content
  const hoverActions = (
    <>
      <BlockLabel>{labelContent}</BlockLabel>

      <BlockDivider />

      <CopyButton content={block.content} label="diff" />
    </>
  );

  return (
    <BlockContainer
      blockType="diff"
      hoverActions={hoverActions}
      data-block-type="diff"
    >
      {/* Diff content */}
      <div className="overflow-x-auto">
        <pre
          className="p-0 text-sm"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {block.content.split('\n').map((line, i) => {
            const isAddition = line.startsWith('+') && !line.startsWith('+++');
            const isDeletion = line.startsWith('-') && !line.startsWith('---');
            const isContext = line.startsWith('@@');

            return (
              <div
                key={i}
                className={`px-4 py-0.5 ${
                  isAddition
                    ? 'bg-green-500/10 text-green-400'
                    : isDeletion
                    ? 'bg-red-500/10 text-red-400'
                    : isContext
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-gray-300'
                }`}
              >
                {line || ' '}
              </div>
            );
          })}
        </pre>
      </div>
    </BlockContainer>
  );
};
