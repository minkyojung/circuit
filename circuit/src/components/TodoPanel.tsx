/**
 * TodoPanel - Simplified Right Sidebar with Glassmorphism
 *
 * Contains only:
 * - Settings, Theme, Feedback buttons
 * - Commit & PR button
 * - Terminal
 */

import { useState } from 'react'
import { Settings, Terminal as TerminalIcon, MessageSquare } from 'lucide-react'
import type { Workspace } from '@/types/workspace'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SettingsDialog } from '@/components/SettingsDialog'
import { Terminal } from '@/components/Terminal'
import {
  SidebarHeader,
  SidebarContent,
} from '@/components/ui/sidebar'

interface TodoPanelProps {
  conversationId: string | null
  workspace?: Workspace | null
  onCommit?: () => void
}

export function TodoPanel({ workspace, onCommit }: TodoPanelProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

  return (
    <>
      {/* Header with icons and Commit & PR button */}
      <SidebarHeader className="p-0 mt-[7px]" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="h-[36px] w-full flex flex-row items-center justify-between pl-2 pr-2">
          {/* Left icon group */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-sidebar-foreground"
              title="Settings"
            >
              <Settings size={16} strokeWidth={1.5} />
            </button>

            {/* Theme Toggle */}
            <ThemeToggle className="h-7 w-7 hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-sidebar-foreground" />

            {/* Feedback Button */}
            <button
              onClick={() => setIsFeedbackOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-sidebar-foreground"
              title="Send Feedback"
            >
              <MessageSquare size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Commit & PR button */}
          {workspace && onCommit && (
            <button
              onClick={onCommit}
              className="px-4 py-[7px] bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-md transition-colors"
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              Commit & PR
            </button>
          )}
        </div>
      </SidebarHeader>

      {/* Content area with Terminal */}
      <SidebarContent className="flex flex-col overflow-hidden">
        {/* Terminal Section */}
        {workspace && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-2 py-2 text-xs font-medium text-sidebar-foreground">
              <TerminalIcon size={14} />
              <span>Terminal</span>
              <span className="text-[10px] text-sidebar-foreground-muted">
                {workspace.displayName}
              </span>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 overflow-hidden bg-transparent">
              <Terminal key={workspace.id} workspace={workspace} />
            </div>
          </div>
        )}

        {/* Empty state when no workspace */}
        {!workspace && (
          <div className="flex-1 flex items-center justify-center text-sm text-sidebar-foreground-muted">
            Select a workspace to use the terminal
          </div>
        )}
      </SidebarContent>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Feedback Dialog - Placeholder for now */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsFeedbackOpen(false)}>
          <div className="bg-card p-6 rounded-lg shadow-xl max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Send Feedback</h3>
            <p className="text-sm text-muted-foreground mb-4">Feedback functionality coming soon!</p>
            <button
              onClick={() => setIsFeedbackOpen(false)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
