/**
 * TodoPanel - Right Sidebar with Terminal
 *
 * Contains:
 * - Smart Commit interface
 * - Terminal
 */

import { useState, useEffect } from 'react'
import { Terminal as TerminalIcon } from 'lucide-react'
import type { Workspace } from '@/types/workspace'
import type { GitWorkspaceState } from '../../electron/gitHandlers'
import { Terminal } from '@/components/Terminal'
import { CommitInterface } from '@/components/git/CommitInterface'
import {
  SidebarContent,
} from '@/components/ui/sidebar'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'

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

  return (
    <>
      {/* Content area with Smart Commit and Terminal */}
      <SidebarContent className="flex flex-col overflow-hidden p-0">
        {workspace ? (
          <ResizablePanelGroup direction="vertical">
            {/* Smart Commit Panel */}
            <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
              <CommitInterface
                workspacePath={workspace.path}
                stagedCount={gitState?.staged || 0}
                gitState={gitState}
                onCommitSuccess={() => {
                  // Refresh git state after commit
                  ipcRenderer.invoke('git:get-workspace-state', workspace.path).then(result => {
                    if (result.success && result.data) {
                      setGitState(result.data.state)
                    }
                  })
                  // Notify parent
                  onCommit?.()
                }}
              />
            </ResizablePanel>

            {/* Resizable Handle */}
            <ResizableHandle />

            {/* Terminal Panel */}
            <ResizablePanel defaultSize={50} minSize={30}>
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
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
            Select a workspace
          </div>
        )}
      </SidebarContent>
    </>
  )
}
