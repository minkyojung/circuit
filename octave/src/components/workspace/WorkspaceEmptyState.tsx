/**
 * WorkspaceEmptyState - Welcome screen when no workspace is selected
 *
 * Shows cube logo and keyboard shortcuts
 */

import React from 'react'
import { Box } from 'lucide-react'

interface WorkspaceEmptyStateProps {
  onSelectWorkspace: (workspace: any) => void
  onCreateWorkspace: () => void
}

interface ShortcutItemProps {
  label: string
  keys: string[]
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({ label, keys }) => {
  return (
    <div className="flex items-center justify-between py-2.5 px-2 group">
      <span className="text-[15px] text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {keys.map((key, index) => (
          <kbd
            key={index}
            className="min-w-[28px] h-[28px] px-2 flex items-center justify-center rounded-md bg-secondary/50 text-muted-foreground/60 text-xs font-medium border border-border/40"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  )
}

export function WorkspaceEmptyState({ onSelectWorkspace, onCreateWorkspace }: WorkspaceEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full pb-32">
      {/* Cube Logo */}
      <div className="mb-12">
        <Box
          className="w-32 h-32 text-muted-foreground/20"
          strokeWidth={1.5}
        />
      </div>

      {/* Keyboard Shortcuts */}
      <div className="w-[380px] space-y-1">
        <ShortcutItem
          label="New Agent"
          keys={['⇧', '⌘', 'L']}
        />
        <ShortcutItem
          label="Show Terminal"
          keys={['⌘', 'J']}
        />
        <ShortcutItem
          label="Hide Files"
          keys={['⌘', 'B']}
        />
        <ShortcutItem
          label="Search Files"
          keys={['⌘', 'P']}
        />
        <ShortcutItem
          label="Open Browser"
          keys={['⇧', '⌘', 'B']}
        />
      </div>
    </div>
  )
}
