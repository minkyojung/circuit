/**
 * TodoPanel - Right Sidebar with Terminal
 *
 * Contains:
 * - Settings, Theme, Feedback buttons
 * - Smart Git Actions button (context-aware)
 * - Terminal
 */

import { useState, useEffect } from 'react'
import { Settings, Terminal as TerminalIcon, MessageSquare, ChevronDown } from 'lucide-react'
import type { Workspace } from '@/types/workspace'
import type { GitWorkspaceState } from '../../electron/gitHandlers'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Terminal } from '@/components/Terminal'
import { MergeDialog } from '@/components/workspace/MergeDialog'
import {
  SidebarHeader,
  SidebarContent,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getPrimaryGitAction, getAllGitActions, getGitActionPrompt } from '@/utils/gitActions'

const ipcRenderer = window.electron.ipcRenderer;

interface TodoPanelProps {
  conversationId: string | null
  workspace?: Workspace | null
  onCommit?: () => void
  onFileSelect?: (path: string, line: number) => void
  onOpenSettings?: () => void
  onRequestDirectEdit?: (message: string) => void
}

export function TodoPanel({ workspace, onCommit, onFileSelect, onOpenSettings, onRequestDirectEdit }: TodoPanelProps) {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [gitState, setGitState] = useState<GitWorkspaceState | null>(null)

  // Fetch Git state when workspace changes
  useEffect(() => {
    if (!workspace) {
      setGitState(null)
      return
    }

    const fetchGitState = async () => {
      try {
        const result = await ipcRenderer.invoke('git:get-workspace-state', workspace.path)
        if (result.success && result.data) {
          setGitState(result.data.state)
        }
      } catch (error) {
        console.error('[TodoPanel] Failed to fetch git state:', error)
      }
    }

    fetchGitState()

    // Poll for git state updates every 5 seconds
    const interval = setInterval(fetchGitState, 5000)
    return () => clearInterval(interval)
  }, [workspace?.id])

  // Handle Git action execution
  const handleGitAction = (actionType: string) => {
    if (!workspace || !onRequestDirectEdit) return

    if (actionType === 'merge') {
      // Show merge dialog for review
      setShowMergeDialog(true)
      return
    }

    // Execute other actions directly
    const prompt = getGitActionPrompt(
      actionType as any,
      workspace.path,
      workspace.branch,
      gitState?.behind
    )

    if (prompt) {
      onRequestDirectEdit(prompt)
    }
  }

  // Get primary action and all actions
  const primaryAction = getPrimaryGitAction(gitState)
  const allActions = getAllGitActions(gitState)

  return (
    <>
      {/* Header with icons and Smart Git button */}
      <SidebarHeader className="p-0 mt-[7px]" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="h-[36px] w-full flex flex-row items-center justify-between pl-2 pr-2">
          {/* Left icon group */}
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-sidebar-foreground"
              title="Settings (Cmd+,)"
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

          {/* Smart Git Actions button */}
          {workspace && onRequestDirectEdit && (
            <DropdownMenu>
              <div className="flex items-center gap-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
                {/* Primary action button */}
                <button
                  onClick={() => primaryAction.type && handleGitAction(primaryAction.type)}
                  disabled={primaryAction.disabled}
                  className={`px-3 py-[7px] text-sm font-medium rounded-l-md transition-colors ${
                    primaryAction.variant === 'primary'
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      : primaryAction.variant === 'destructive'
                      ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                      : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={primaryAction.tooltip}
                >
                  {primaryAction.label}
                </button>

                {/* Dropdown trigger */}
                <DropdownMenuTrigger asChild>
                  <button
                    className={`w-[28px] h-[28px] flex items-center justify-center rounded-r-md transition-colors border-l border-white/20 ${
                      primaryAction.variant === 'primary'
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        : primaryAction.variant === 'destructive'
                        ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                        : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                    }`}
                  >
                    <ChevronDown size={14} />
                  </button>
                </DropdownMenuTrigger>
              </div>

              <DropdownMenuContent align="end" className="w-[200px] bg-popover border-border shadow-2xl">
                {allActions.map((action, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => action.type && handleGitAction(action.type)}
                    disabled={action.disabled}
                    className="cursor-pointer py-2 px-3 text-sm"
                  >
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SidebarHeader>

      {/* Content area with Terminal */}
      <SidebarContent className="flex flex-col overflow-hidden p-0">
        {workspace ? (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-foreground border-b border-border">
              <TerminalIcon size={14} />
              <span>Terminal</span>
              <span className="text-[10px] text-muted-foreground">
                {workspace.displayName}
              </span>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 overflow-hidden bg-transparent">
              <Terminal key={workspace.id} workspace={workspace} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
            Select a workspace
          </div>
        )}
      </SidebarContent>

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

      {/* Merge Dialog */}
      {showMergeDialog && workspace && onRequestDirectEdit && (
        <MergeDialog
          workspace={workspace}
          onClose={() => setShowMergeDialog(false)}
          onRequestDirectEdit={(message) => {
            setShowMergeDialog(false)
            onRequestDirectEdit(message)
          }}
        />
      )}
    </>
  )
}
