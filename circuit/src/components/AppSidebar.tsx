import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import type { Workspace, WorkspaceCreateResult, WorkspaceListResult, WorkspaceStatus, Repository } from '@/types/workspace'
import { Plus, FolderGit2, Check, GitMerge, GitCommit, Archive } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectPath } from '@/App'
import { RepositorySwitcher } from './workspace/RepositorySwitcher'
import { FileExplorer, type FileNode } from './workspace/FileExplorer'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'

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
  // If no status yet, show Clean by default (will update when loaded)
  if (!status) {
    return {
      icon: <Check size={12} />,
      text: 'Clean',
      className: 'bg-status-synced/10 text-status-synced',
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
  const [isCreating, setIsCreating] = useState(false)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)

  // Repository management
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [currentRepository, setCurrentRepository] = useState<Repository | null>(null)

  // Create a temporary repository from project path (fallback)
  const defaultRepository: Repository = useMemo(() => {
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

  // Use current repository or fallback to default
  const repository = currentRepository || defaultRepository

  // Load repositories on mount
  useEffect(() => {
    loadRepositories()
  }, [])

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces()
  }, [])

  // Auto-refresh workspaces and statuses every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadWorkspaces()
    }, 5000)

    return () => clearInterval(interval)
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

  const loadRepositories = async () => {
    try {
      const result = await ipcRenderer.invoke('repository:list')

      if (result.success && result.repositories) {
        setRepositories(result.repositories)
        // Set first repository as current if none selected
        if (!currentRepository && result.repositories.length > 0) {
          setCurrentRepository(result.repositories[0])
        }
      } else {
        console.error('Failed to load repositories:', result.error)
        // Fallback to default repository
        setRepositories([defaultRepository])
        setCurrentRepository(defaultRepository)
      }
    } catch (error) {
      console.error('Error loading repositories:', error)
      // Fallback to default repository
      setRepositories([defaultRepository])
      setCurrentRepository(defaultRepository)
    }
  }

  const loadWorkspaces = async () => {
    try {
      const result: WorkspaceListResult = await ipcRenderer.invoke('workspace:list')

      if (result.success && result.workspaces) {
        setWorkspaces(result.workspaces)
      } else {
        console.error('Failed to load workspaces:', result.error)
      }
    } catch (error) {
      console.error('Error loading workspaces:', error)
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

  const createRepository = async () => {
    try {
      const result = await ipcRenderer.invoke('repository:create')

      if (result.success && result.repository) {
        console.log('✅ Repository created:', result.repository.name)
        setRepositories([...repositories, result.repository])
        setCurrentRepository(result.repository)
      } else {
        console.error('Failed to create repository:', result.error)
        alert(`Failed to create repository: ${result.error}`)
      }
    } catch (error) {
      console.error('Error creating repository:', error)
      alert(`Error creating repository: ${error}`)
    }
  }

  const cloneRepository = async () => {
    try {
      // Prompt user for Git URL
      const url = prompt('Enter Git repository URL:', 'https://github.com/user/repo.git')

      if (!url) {
        return // User canceled
      }

      // Show loading state
      alert('Cloning repository...\nThis may take a few minutes.')

      const result = await ipcRenderer.invoke('repository:clone', url)

      if (result.success && result.repository) {
        console.log('✅ Repository cloned:', result.repository.name)
        setRepositories([...repositories, result.repository])
        setCurrentRepository(result.repository)
        alert(`Repository cloned successfully: ${result.repository.name}`)
      } else {
        console.error('Failed to clone repository:', result.error)
        alert(`Failed to clone repository: ${result.error}`)
      }
    } catch (error) {
      console.error('Error cloning repository:', error)
      alert(`Error cloning repository: ${error}`)
    }
  }

  const switchRepository = async (repo: Repository) => {
    setCurrentRepository(repo)
    // Reload workspaces for the new repository
    await loadWorkspaces()
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
          repositories={repositories.length > 0 ? repositories : [repository]}
          onSelectRepository={switchRepository}
          onCreateRepository={createRepository}
          onCloneRepository={cloneRepository}
        />
      </SidebarHeader>

      <SidebarContent>
        {/* Workspaces */}
        <SidebarGroup>
          <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
          <SidebarMenu>
            {workspaces.length === 0 ? (
              <div className="px-4 py-6 text-center" style={{ color: 'var(--sidebar-foreground-muted)' }}>
                <p className="text-sm">No workspaces yet</p>
                <p className="text-xs mt-2">Create your first workspace</p>
              </div>
            ) : (
              workspaces.map((workspace) => {
                const status = statuses[workspace.id]
                const badge = getStatusBadge(status)
                const isActive = workspace.id === selectedWorkspaceId
                const isMerged = badge.isMerged

                return (
                  <SidebarMenuItem key={workspace.id} className={cn("my-0", isMerged && "opacity-60")}>
                    <SidebarMenuButton
                      onClick={() => onSelectWorkspace(workspace)}
                      isActive={isActive}
                      className="h-auto py-2.5 px-3 group"
                    >
                      {/* Improved layout */}
                      <div className="flex items-start gap-3 w-full min-w-0">
                        {/* Icon */}
                        <FolderGit2 size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--sidebar-foreground)' }} />

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Top row: Name + Status Badge */}
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold truncate flex-1" style={{ color: 'var(--sidebar-foreground)' }}>
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
                          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--sidebar-foreground-muted)' }}>
                            {/* Branch name - always show */}
                            <span className="text-xs flex-shrink-0">{workspace.branch}</span>

                            {/* Code stats - files changed */}
                            {status && !status.clean && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {(status.added > 0 || status.modified > 0) && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-status-synced/10 text-status-synced text-[11px] font-mono font-medium">
                                    +{status.added + status.modified}
                                  </span>
                                )}
                                {status.deleted > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-status-behind/10 text-status-behind text-[11px] font-mono font-medium">
                                    -{status.deleted}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Creation time - relative format */}
                            <span className="flex-shrink-0 text-[11px]">
                              {(() => {
                                const now = Date.now()
                                const created = new Date(workspace.createdAt).getTime()

                                // Validate date - if invalid or too old (before 2020), show "just now"
                                if (isNaN(created) || created < new Date('2020-01-01').getTime()) {
                                  return 'just now'
                                }

                                const diff = now - created
                                const minutes = Math.floor(diff / 60000)
                                const hours = Math.floor(diff / 3600000)
                                const days = Math.floor(diff / 86400000)

                                if (minutes < 1) return 'just now'
                                if (minutes < 60) return `${minutes}m`
                                if (hours < 24) return `${hours}h`
                                if (days < 7) return `${days}d`
                                if (days < 30) return `${Math.floor(days / 7)}w`
                                if (days < 365) return `${Math.floor(days / 30)}mo`
                                return `${Math.floor(days / 365)}y`
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* New Workspace Button */}
        <div className="px-2 pb-2">
          <Button
            variant="ghost"
            onClick={createWorkspace}
            disabled={isCreating}
            className="w-full h-auto py-2 px-2 justify-start text-sm hover:bg-sidebar-hover transition-all duration-200"
            style={{ color: 'var(--sidebar-foreground)' }}
          >
            <Plus size={16} />
            {isCreating ? 'Creating...' : 'New Workspace'}
          </Button>
        </div>

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
        <ThemeToggle className="w-full justify-start" style={{ color: 'var(--sidebar-foreground)' }} />
      </SidebarFooter>
    </Sidebar>
  )
}
