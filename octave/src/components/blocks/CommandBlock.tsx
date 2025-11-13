/**
 * CommandBlock - Renders executable shell commands
 *
 * Refactored to use unified block architecture.
 *
 * Features:
 * - Execute button to run command
 * - Shows execution status (running/success/error)
 * - Displays last execution result
 * - Copy and bookmark actions
 * - Minimal design with hover pill
 * - Unified typography and padding
 */

import React from 'react';
import type { Block } from '../../types/conversation';
import { Check, AlertCircle } from 'lucide-react';
import { BlockContainer, BlockLabel, BlockDivider, CopyButton, BookmarkButton, RunButton } from './shared';

interface CommandBlockProps {
  block: Block;
  onCopy: (content: string) => void;
  onExecute: (content: string) => void;
  onBookmark: (blockId: string) => void;
}

export const CommandBlock: React.FC<CommandBlockProps> = ({ block, onExecute }) => {
  const exitCode = block.metadata.exitCode;
  const executedAt = block.metadata.executedAt;
  const hasExecuted = executedAt !== undefined;
  const language = block.metadata.language || 'bash';

  // Hover actions pill content
  const hoverActions = (
    <>
      <BlockLabel>{language}</BlockLabel>

      <BlockDivider />

      <RunButton command={block.content} onExecute={onExecute} />

      <CopyButton content={block.content} label="command" />

      <BookmarkButton blockId={block.id} title="Command" />
    </>
  );

  return (
    <BlockContainer
      blockType="command"
      hoverActions={hoverActions}
      data-block-type="command"
    >
      {/* Command content */}
      <div className="p-4">
        <pre
          className="text-sm text-[var(--command-accent)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {block.content}
        </pre>
      </div>

      {/* Execution status (if executed before) */}
      {hasExecuted && (
        <div className="border-t border-[var(--command-border)] bg-[var(--command-bg)] px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            {exitCode === 0 ? (
              <>
                <Check className="h-3 w-3 text-success" />
                <span className="text-success">Executed successfully</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span className="text-destructive">Exit code: {exitCode}</span>
              </>
            )}
            {executedAt && (
              <span className="text-muted-foreground">
                • {new Date(executedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}
    </BlockContainer>
  );
};
