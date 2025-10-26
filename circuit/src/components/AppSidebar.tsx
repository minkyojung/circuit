import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import type { Workspace, WorkspaceCreateResult, WorkspaceListResult, WorkspaceStatus, Repository } from '@/types/workspace'
import { Plus, RefreshCw, Trash2, GitBranch, FolderGit2, Check, GitMerge, ArrowUp, ArrowDown, GitCommit, Loader2, Archive } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectPath } from '@/App'
import { RepositorySwitcher } from './workspace/RepositorySwitcher'
import { FileExplorer, type FileNode } from './workspace/FileExplorer'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { ThemeToggleIcon } from '@/components/ThemeToggle'
import { DensityToggleIcon } from '@/components/DensityToggle'

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron')

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  selectedWorkspaceId: string | null
  selectedWorkspace: Workspace | null
  onSelectWorkspace: (workspace: Workspace) => void
  selectedFile: string | null
  onFileSelect: (filePath: string) => void
}

const getStatusBadge = (status?: WorkspaceStatus) => {
  if (!status) {
    return {
      icon: <Loader2 size={12} className="animate-spin" />,
      text: 'Loading...',
      className: 'bg-muted text-muted-foreground',
      isMerged: false
    }
  }

  // Check if workspace is merged
  if (status.status === 'merged') {
    return {
      icon: <GitMerge size={12} />,
      text: 'Merged',
      className: 'bg-status-merged/10 text-status-merged',
      isMerged: true
    }
  }

  // Simplified status: Clean or Modified
  const hasChanges = !status.clean ||
    status.modified > 0 ||
    status.added > 0 ||
    status.deleted > 0 ||
    status.untracked > 0

  if (hasChanges) {
    return {
      icon: <GitCommit size={12} />,
      text: 'Modified',
      className: 'bg-status-working/10 text-status-working',
      isMerged: false
    }
  }

  return {
    icon: <Check size={12} />,
    text: 'Clean',
    className: 'bg-status-synced/10 text-status-synced',
    isMerged: false
  }
}

export function AppSidebar({ selectedWorkspaceId, selectedWorkspace, onSelectWorkspace, selectedFile, onFileSelect, ...props }: AppSidebarProps) {
  const { projectPath } = useProjectPath()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [statuses, setStatuses] = useState<Record<string, WorkspaceStatus>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)

  // Create a temporary repository from project path
  const repository: Repository = useMemo(() => {
    const projectName = projectPath.split('/').filter(Boolean).pop() || 'Unknown Project'
    return {
      id: 'temp-repo-1',
      name: projectName,
      path: projectPath,
      remoteUrl: null,
      defaultBranch: 'main',
      createdAt: new Date().toISOString(),
    }
  }, [projectPath])

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces()
  }, [])

  // Load statuses for all workspaces
  const loadStatuses = async (workspaceList: Workspace[]) => {
    const newStatuses: Record<string, WorkspaceStatus> = {}

    for (const workspace of workspaceList) {
      try {
        const result = await ipcRenderer.invoke('workspace:get-status', workspace.path)
        if (result.success && result.status) {
          newStatuses[workspace.id] = result.status
        }
      } catch (error) {
        console.error(`Failed to get status for ${workspace.name}:`, error)
      }
    }

    setStatuses(newStatuses)
  }

  // Auto-refresh statuses every 30 seconds
  useEffect(() => {
    if (workspaces.length === 0) return

    loadStatuses(workspaces)

    const interval = setInterval(() => {
      loadStatuses(workspaces)
    }, 30000)

    return () => clearInterval(interval)
  }, [workspaces])

  // Load file tree when workspace is selected
  useEffect(() => {
    if (!selectedWorkspace) {
      setFileTree([])
      return
    }

    const loadFileTree = async () => {
      setIsLoadingFiles(true)
      try {
        const result = await ipcRenderer.invoke('workspace:get-file-tree', selectedWorkspace.path)

        if (result.success && result.fileTree) {
          setFileTree(result.fileTree)
        } else {
          console.error('Failed to load file tree:', result.error)
          setFileTree([])
        }
      } catch (error) {
        console.error('Error loading file tree:', error)
        setFileTree([])
      } finally {
        setIsLoadingFiles(false)
      }
    }

    loadFileTree()
  }, [selectedWorkspace?.path])

  const loadWorkspaces = async () => {
    setIsLoading(true)
    try {
      const result: WorkspaceListResult = await ipcRenderer.invoke('workspace:list')

      if (result.success && result.workspaces) {
        setWorkspaces(result.workspaces)
      } else {
        console.error('Failed to load workspaces:', result.error)
      }
    } catch (error) {
      console.error('Error loading workspaces:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createWorkspace = async () => {
    setIsCreating(true)
    try {
      const result: WorkspaceCreateResult = await ipcRenderer.invoke('workspace:create')

      if (result.success && result.workspace) {
        console.log('✅ Workspace created:', result.workspace.name)
        setWorkspaces([...workspaces, result.workspace])
      } else {
        console.error('Failed to create workspace:', result.error)
        alert(`Failed to create workspace: ${result.error}`)
      }
    } catch (error) {
      console.error('Error creating workspace:', error)
      alert(`Error creating workspace: ${error}`)
    } finally {
      setIsCreating(false)
    }
  }

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      const result = await ipcRenderer.invoke('workspace:delete', workspaceId)

      if (result.success) {
        console.log('✅ Workspace deleted:', workspaceId)
        setWorkspaces(workspaces.filter((w) => w.id !== workspaceId))

        // Clear active workspace if it was deleted
        if (selectedWorkspaceId === workspaceId) {
          onSelectWorkspace(null as any)
        }
      } else {
        console.error('Failed to delete workspace:', result.error)
        alert(`Failed to delete workspace: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting workspace:', error)
      alert(`Error deleting workspace: ${error}`)
    }
  }

  const handleDeleteWorkspace = (e: React.MouseEvent, workspaceId: string, workspaceName: string, isMerged: boolean = false) => {
    e.stopPropagation()
    const action = isMerged ? 'Archive' : 'Delete'
    const message = isMerged
      ? `Archive workspace "${workspaceName}"? This will remove it from the list.`
      : `Delete workspace "${workspaceName}"?`

    if (confirm(message)) {
      deleteWorkspace(workspaceId)
    }
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        {/* Traffic Lights Area (Fully Draggable) */}
        <div
          className="h-[44px] -m-2 mb-0"
          style={{ WebkitAppRegion: 'drag' } as any}
        />

        {/* Repository Switcher */}
        <RepositorySwitcher
          currentRepository={repository}
          repositories={[repository]}
          onCreateRepository={() => {
            console.log('Create new repository')
          }}
        />
      </SidebarHeader>

      <SidebarContent>
        {/* New Workspace Button */}
        <div className="px-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={createWorkspace}
            disabled={isCreating}
            className="w-full justify-start text-sidebar-foreground-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
          >
            <Plus size={14} />
            {isCreating ? 'Creating...' : 'New Workspace'}
          </Button>
        </div>

        {/* Workspaces */}
        <SidebarGroup>
          <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
          <SidebarMenu>
            {workspaces.length === 0 ? (
              <div className="px-4 py-6 text-center text-sidebar-foreground-muted">
                <p className="text-sm">No workspaces yet</p>
                <p className="text-xs mt-2">Create your first workspace</p>
              </div>
            ) : (
              workspaces.map((workspace) => {
                const status = statuses[workspace.id]
                const badge = getStatusBadge(status)
                const isActive = workspace.id === selectedWorkspaceId
                const showBranch = workspace.name !== workspace.branch
                const isMerged = badge.isMerged

                return (
                  <SidebarMenuItem key={workspace.id} className={cn("my-0", isMerged && "opacity-60")}>
                    <SidebarMenuButton
                      onClick={() => onSelectWorkspace(workspace)}
                      isActive={isActive}
                      className="h-auto py-2.5 px-3 pr-8 group"
                    >
                      {/* Improved layout */}
                      <div className="flex items-start gap-3 w-full min-w-0">
                        {/* Icon */}
                        <FolderGit2 size={16} className="flex-shrink-0 text-sidebar-foreground-muted/40 mt-0.5" />

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Top row: Name + Status Badge */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate flex-1">
                              {workspace.name}
                            </span>

                            {/* Clean status: hoverable archive button */}
                            {status?.status === 'merged' || (status?.clean && !isMerged) ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWorkspace(e, workspace.id, workspace.name, true);
                                }}
                                className={cn(
                                  "group/badge inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0 transition-all",
                                  status?.status === 'merged'
                                    ? "bg-status-merged/10 text-status-merged hover:bg-orange-500/20 hover:text-orange-600"
                                    : "bg-status-synced/10 text-status-synced hover:bg-orange-500/20 hover:text-orange-600"
                                )}
                              >
                                <Archive size={12} className="opacity-0 group-hover/badge:opacity-100 -ml-1 group-hover/badge:ml-0 transition-all" />
                                <span className="group-hover/badge:hidden">
                                  {status?.status === 'merged' ? 'Merged' : 'Clean'}
                                </span>
                                <span className="hidden group-hover/badge:inline">Archive</span>
                              </button>
                            ) : (
                              <div className={cn(
                                "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0",
                                badge.className
                              )}>
                                {badge.icon}
                                <span>{badge.text}</span>
                              </div>
                            )}
                          </div>

                          {/* Bottom row: Metadata and stats (always visible) */}
                          <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground-muted">
                            {/* Branch name (only if different) */}
                            {showBranch && (
                              <div className="flex items-center gap-1 truncate">
                                <GitBranch size={11} className="flex-shrink-0" />
                                <span className="truncate text-[11px]">{workspace.branch}</span>
                              </div>
                            )}

                            {/* Code stats - files changed */}
                            {status && !status.clean && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {(status.added > 0 || status.modified > 0) && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-status-synced/10 text-status-synced text-[10px] font-mono font-medium">
                                    +{status.added + status.modified}
                                  </span>
                                )}
                                {status.deleted > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-status-behind/10 text-status-behind text-[10px] font-mono font-medium">
                                    -{status.deleted}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Creation time - always show */}
                            <span className="flex-shrink-0 text-[10px]">
                              {new Date(workspace.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>

                            {/* Original workspace name - only show if different from display name */}
                            {showBranch && workspace.name !== workspace.branch && (
                              <span className="flex-shrink-0 text-[10px] opacity-50 truncate max-w-[100px]">
                                ({workspace.branch})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </SidebarMenuButton>

                    <SidebarMenuAction
                      showOnHover
                      onClick={(e) => handleDeleteWorkspace(e, workspace.id, workspace.name, isMerged)}
                      className={cn(
                        "top-1/2 -translate-y-1/2",
                        isMerged
                          ? "text-sidebar-foreground-muted hover:text-orange-500"
                          : "text-sidebar-foreground-muted hover:text-destructive"
                      )}
                      title={isMerged ? "Archive workspace" : "Delete workspace"}
                    >
                      {isMerged ? <Archive size={14} /> : <Trash2 size={14} />}
                      <span className="sr-only">{isMerged ? "Archive" : "Delete"}</span>
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                )
              })
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* Files Section (only when workspace selected) */}
        {selectedWorkspace && (
          <FileExplorer
            fileTree={fileTree}
            isLoading={isLoadingFiles}
            onFileSelect={onFileSelect}
            selectedFile={selectedFile}
          />
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between text-xs px-2 py-2">
          {/* Left: GitHub Status */}
          <div className="flex items-center gap-2 text-sidebar-foreground-muted">
            <div className="h-2 w-2 rounded-full bg-status-synced animate-pulse" />
            <span className="font-medium">Ready</span>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                loadWorkspaces()
                if (workspaces.length > 0) {
                  loadStatuses(workspaces)
                }
              }}
              disabled={isLoading}
              className="p-1.5 hover:bg-sidebar-accent rounded transition-colors disabled:opacity-50 text-sidebar-foreground-muted hover:text-sidebar-foreground"
              title="Refresh workspaces"
            >
              <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
            </button>
            <DensityToggleIcon className="hover:bg-sidebar-accent" />
            <ThemeToggleIcon className="hover:bg-sidebar-accent" />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
