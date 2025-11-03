/**
 * WorkspaceEmptyState - Welcome screen when no workspace is selected
 *
 * Shows recent workspaces, quick actions, and helpful tips.
 * Uses the new design system (Stack, Inline) for consistent spacing.
 */

import { useState, useEffect } from 'react'
import { FolderGit2, Plus, Sparkles, GitBranch, Clock, ArrowRight } from 'lucide-react'
import { Stack } from '../ui/stack'
import { Inline } from '../ui/inline'
import { Button } from '../ui/button'
import type { Workspace } from '@/types/workspace'
import { cn } from '@/lib/utils'

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron')

interface WorkspaceEmptyStateProps {
  onSelectWorkspace: (workspace: Workspace) => void
  onCreateWorkspace: () => void
}

export function WorkspaceEmptyState({ onSelectWorkspace, onCreateWorkspace }: WorkspaceEmptyStateProps) {
  const [recentWorkspaces, setRecentWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadRecentWorkspaces()
  }, [])

  const loadRecentWorkspaces = async () => {
    try {
      const result = await ipcRenderer.invoke('workspace:list')
      if (result.success && result.workspaces) {
        // Sort by lastAccessedAt and take top 3
        const sorted = [...result.workspaces].sort((a, b) => {
          const aTime = a.lastAccessedAt || 0
          const bTime = b.lastAccessedAt || 0
          return bTime - aTime
        })
        setRecentWorkspaces(sorted.slice(0, 3))
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatLastAccessed = (timestamp?: number): string => {
    if (!timestamp) return 'Never'

    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60 * 1000) return 'Just now'
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d ago`

    const date = new Date(timestamp)
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const hasRecentWorkspaces = recentWorkspaces.length > 0

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Stack space="5" className="max-w-2xl w-full" align="center">
        {/* Welcome Header */}
        <Stack space="2" align="center">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
            <Sparkles className="w-5 h-5 text-muted-foreground" />
          </div>
          <Stack space="1" align="center">
            <h1 className="text-lg font-semibold">
              {hasRecentWorkspaces ? 'Welcome back!' : 'Welcome to Circuit'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {hasRecentWorkspaces
                ? 'Continue your work or start something new'
                : 'Your AI-powered coding workspace'}
            </p>
          </Stack>
        </Stack>

        {/* Recent Workspaces */}
        {hasRecentWorkspaces && (
          <Stack space="2.5" className="w-full">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Continue your work
            </h2>
            <Stack space="1.5">
              {recentWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  workspace={workspace}
                  onSelect={() => onSelectWorkspace(workspace)}
                  lastAccessed={formatLastAccessed(workspace.lastAccessedAt)}
                />
              ))}
            </Stack>
          </Stack>
        )}

        {/* Actions */}
        <Stack space="1.5" className="w-full">
          <Button
            onClick={onCreateWorkspace}
            variant="secondary"
            size="default"
            className="w-full"
          >
            <Plus className="w-4 h-4" />
            New Workspace
          </Button>

          {hasRecentWorkspaces && recentWorkspaces.length >= 3 && (
            <Button
              variant="outline"
              size="default"
              className="w-full"
              onClick={() => {
                // TODO: Open workspace browser/command palette
                console.log('Browse all workspaces')
              }}
            >
              <FolderGit2 className="w-4 h-4" />
              Browse All
            </Button>
          )}
        </Stack>

        {/* Quick Tip */}
        <div className="px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/30 w-full">
          <Inline space="1.5" align="center">
            <Sparkles className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Press <kbd className="px-1 py-0.5 text-[10px] font-semibold bg-background border border-border rounded">⌘K</kbd> for quick navigation
            </p>
          </Inline>
        </div>
      </Stack>
    </div>
  )
}

interface WorkspaceCardProps {
  workspace: Workspace
  onSelect: () => void
  lastAccessed: string
}

function WorkspaceCard({ workspace, onSelect, lastAccessed }: WorkspaceCardProps) {
  const [gitInfo, setGitInfo] = useState<{ branch?: string; ahead?: number; behind?: number } | null>(null)

  useEffect(() => {
    loadGitInfo()
  }, [workspace.path])

  const loadGitInfo = async () => {
    try {
      const result = await ipcRenderer.invoke('git:status', workspace.path)
      if (result.success && result.status) {
        setGitInfo({
          branch: result.status.currentBranch,
          ahead: result.status.ahead,
          behind: result.status.behind,
        })
      }
    } catch (error) {
      // Silently fail - git info is optional
    }
  }

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full px-2.5 py-2 rounded-lg border border-border",
        "bg-card hover:bg-accent/50 transition-all",
        "text-left group"
      )}
    >
      <Inline align="center" justify="between">
        {/* Left: Icon + Info */}
        <Inline space="2.5" align="center" className="min-w-0 flex-1">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted flex-shrink-0">
            <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <Stack space="1" className="min-w-0 flex-1">
            <h3 className="text-sm font-bold truncate">{workspace.displayName}</h3>
            <Inline space="1.5" align="center" className="text-[11px] text-muted-foreground flex-wrap">
              {gitInfo?.branch ? (
                <>
                  <GitBranch className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate">{gitInfo.branch}</span>
                  {gitInfo.ahead > 0 && (
                    <span className="flex-shrink-0">↑{gitInfo.ahead}</span>
                  )}
                  {gitInfo.behind > 0 && (
                    <span className="flex-shrink-0">↓{gitInfo.behind}</span>
                  )}
                  <span className="text-muted-foreground/50">•</span>
                </>
              ) : null}
              <Clock className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="flex-shrink-0">{lastAccessed}</span>
            </Inline>
          </Stack>
        </Inline>

        {/* Right: Arrow */}
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
      </Inline>
    </button>
  )
}
