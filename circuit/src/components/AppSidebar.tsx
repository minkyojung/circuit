import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import type { Workspace, WorkspaceCreateResult, WorkspaceListResult, WorkspaceStatus, Repository } from '@/types/workspace'
import { Plus, GitBranch, Check, GitMerge, GitCommit, Archive, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectPath } from '@/App'
import { RepositorySwitcher } from './workspace/RepositorySwitcher'
import { CloneRepositoryDialog } from './workspace/CloneRepositoryDialog'
import { FileExplorer, type FileNode } from './workspace/FileExplorer'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { listItemVariants } from '@/lib/motion-tokens'

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron')

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  selectedWorkspaceId: string | null
  selectedWorkspace: Workspace | null
  onSelectWorkspace: (workspace: Workspace | null) => void
  selectedFile: string | null
  onFileSelect: (filePath: string) => void
  onWorkspacesLoaded?: (workspaces: Workspace[]) => void
}

const getStatusBadge = (status?: WorkspaceStatus) => {
  // If no status yet, show Clean by default (will update when loaded)
  if (!status) {
    return {
      icon: <Check size={12} strokeWidth={1.5} />,
      text: 'Clean',
      className: 'bg-status-synced/10 text-status-synced',
      isMerged: false
    }
  }

  // Check if workspace is merged
  if (status.status === 'merged') {
    return {
      icon: <GitMerge size={12} strokeWidth={1.5} />,
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
      icon: <GitCommit size={12} strokeWidth={1.5} />,
      text: 'Modified',
      className: 'bg-status-working/10 text-status-working',
      isMerged: false
    }
  }

  return {
    icon: <Check size={12} strokeWidth={1.5} />,
    text: 'Clean',
    className: 'bg-status-synced/10 text-status-synced',
    isMerged: false
  }
}

export function AppSidebar({ selectedWorkspaceId, selectedWorkspace, onSelectWorkspace, selectedFile, onFileSelect, onWorkspacesLoaded, ...props }: AppSidebarProps) {
  const { projectPath } = useProjectPath()
  const { state } = useSidebar()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [statuses, setStatuses] = useState<Record<string, WorkspaceStatus>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)

  // Repository management
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [currentRepository, setCurrentRepository] = useState<Repository | null>(null)
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false)

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
    const statusPromises = workspaceList.map(async (workspace) => {
      try {
        const result = await ipcRenderer.invoke('workspace:get-status', workspace.path)
        if (result.success && result.status) {
          return { id: workspace.id, status: result.status }
        }
      } catch (error) {
        console.error(`Failed to get status for ${workspace.name}:`, error)
      }
      return null
    })

    const results = await Promise.all(statusPromises)
    const newStatuses: Record<string, WorkspaceStatus> = {}
    results.forEach((result) => {
      if (result) {
        newStatuses[result.id] = result.status
      }
    })

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
        // Notify parent for keyboard shortcuts
        onWorkspacesLoaded?.(result.workspaces)
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

  const cloneRepository = async (url: string) => {
    try {
      const result = await ipcRenderer.invoke('repository:clone', url)

      if (result.success && result.repository) {
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

  const openCloneDialog = () => {
    setIsCloneDialogOpen(true)
  }

  const switchRepository = async (repo: Repository) => {
    setCurrentRepository(repo)
    // Reload workspaces for the new repository
    await loadWorkspaces()
  }

  const archiveWorkspace = async (workspaceId: string) => {
    try {
      const result = await ipcRenderer.invoke('workspace:archive', workspaceId)

      if (result.success) {
        // Reload workspaces to update the list
        await loadWorkspaces()

        // Clear active workspace if it was archived
        if (selectedWorkspaceId === workspaceId) {
          onSelectWorkspace(null)
        }
      } else {
        console.error('Failed to archive workspace:', result.error)
        alert(`Failed to archive workspace: ${result.error}`)
      }
    } catch (error) {
      console.error('Error archiving workspace:', error)
      alert(`Error archiving workspace: ${error}`)
    }
  }

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      const result = await ipcRenderer.invoke('workspace:delete', workspaceId)

      if (result.success) {
        // Reload workspaces to update the list
        await loadWorkspaces()

        // Clear active workspace if it was deleted
        if (selectedWorkspaceId === workspaceId) {
          onSelectWorkspace(null)
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

  const handleArchiveWorkspace = (e: React.MouseEvent, workspaceId: string, workspaceName: string) => {
    e.stopPropagation()
    const message = `Archive workspace "${workspaceName}"?\n\nArchived workspaces can be restored from the Archive tab.`

    if (confirm(message)) {
      archiveWorkspace(workspaceId)
    }
  }

  const handleDeleteWorkspace = (e: React.MouseEvent, workspaceId: string, workspaceName: string) => {
    e.stopPropagation()
    const message = `Permanently delete workspace "${workspaceName}"?\n\nThis will remove the worktree and all local changes.\nThis action cannot be undone.`

    if (confirm(message)) {
      deleteWorkspace(workspaceId)
    }
  }

  const handleRefreshFileTree = () => {
    if (selectedWorkspace) {
      setIsLoadingFiles(true)
      ipcRenderer.invoke('workspace:get-file-tree', selectedWorkspace.path)
        .then((result: any) => {
          if (result.success && result.fileTree) {
            setFileTree(result.fileTree)
          }
        })
        .finally(() => setIsLoadingFiles(false))
    }
  }

  return (
    <>
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className={cn(
        state === "collapsed" && "pl-16"
      )}>
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
          onCloneRepository={openCloneDialog}
        />
      </SidebarHeader>

      <SidebarContent>
        {/* Workspaces */}
        <SidebarGroup>
          <SidebarMenu>
            {workspaces.filter(w => !w.archived).length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-6 text-center"
                style={{ color: 'var(--sidebar-foreground-muted)' }}
              >
                <p className="text-sm">No workspaces yet</p>
                <p className="text-xs mt-2">Create your first workspace</p>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {workspaces.filter(w => !w.archived).map((workspace, index) => {
                  const status = statuses[workspace.id]
                  const badge = getStatusBadge(status)
                  const isActive = workspace.id === selectedWorkspaceId
                  const isMerged = badge.isMerged

                  return (
                    <motion.div
                      key={workspace.id}
                      custom={index}
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                    >
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <SidebarMenuItem className={cn("my-0", isMerged && "opacity-60")}>
                            <motion.div
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.98 }}
                              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                            >
                              <SidebarMenuButton
                                onClick={() => onSelectWorkspace(workspace)}
                                isActive={isActive}
                                className="h-auto py-2 px-2 group transition-all duration-200 ease-out"
                              >
                      {/* Improved layout */}
                      <div className="flex gap-3 w-full min-w-0">
                        {/* Branch icon - aligned with first line text */}
                        <div className="flex items-center pt-[3px]">
                          <GitBranch
                            size={14}
                            strokeWidth={1.5}
                            className={cn(
                              "flex-shrink-0 transition-all duration-200",
                              isActive
                                ? "text-sidebar-foreground opacity-80"
                                : "text-sidebar-foreground-muted opacity-70"
                            )}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Top row: Name + Diff */}
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-base font-normal truncate flex-1 transition-colors duration-200",
                              isActive
                                ? "text-sidebar-foreground"
                                : "text-sidebar-foreground-muted"
                            )}>
                              {workspace.name}
                            </span>

                            {/* Diff stats - always show */}
                            <div className="flex items-center gap-0.5 text-sm font-mono flex-shrink-0">
                              <span className={cn(
                                status && (status.added > 0 || status.modified > 0)
                                  ? "text-green-400/70"
                                  : "text-sidebar-foreground-muted opacity-20"
                              )}>
                                +{status ? (status.added + status.modified) : 0}
                              </span>
                              <span className={cn(
                                status && status.deleted > 0
                                  ? "text-red-400/70"
                                  : "text-sidebar-foreground-muted opacity-20"
                              )}>
                                -{status ? status.deleted : 0}
                              </span>
                            </div>
                          </div>

                          {/* Bottom row: Branch + Date */}
                          <div className="flex items-center gap-1.5 text-xs font-normal text-sidebar-foreground opacity-50">
                            {/* Branch name */}
                            <span className="flex-shrink-0">{workspace.branch}</span>

                            {/* Divider */}
                            <span>·</span>

                            {/* Date */}
                            <span className="flex-shrink-0">
                              {(() => {
                                const now = Date.now()
                                const created = new Date(workspace.createdAt).getTime()

                                if (isNaN(created) || created < new Date('2020-01-01').getTime()) {
                                  return 'now'
                                }

                                const diff = now - created
                                const minutes = Math.floor(diff / 60000)
                                const hours = Math.floor(diff / 3600000)
                                const days = Math.floor(diff / 86400000)

                                if (minutes < 1) return 'now'
                                if (minutes < 60) return `${minutes}m ago`
                                if (hours < 24) return `${hours}h ago`
                                if (days < 7) return `${days}d ago`
                                if (days < 30) return `${Math.floor(days / 7)}w ago`
                                if (days < 365) return `${Math.floor(days / 30)}mo ago`
                                return `${Math.floor(days / 365)}y ago`
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                          </SidebarMenuButton>
                            </motion.div>
                          </SidebarMenuItem>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem
                            onClick={(e) => handleArchiveWorkspace(e, workspace.id, workspace.name)}
                            className="gap-2"
                          >
                            <Archive size={14} />
                            Archive
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onClick={(e) => handleDeleteWorkspace(e, workspace.id, workspace.name)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 size={14} />
                            Delete
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* New Workspace Button */}
        <div className="px-2 pb-2">
          <Button
            variant="ghost"
            onClick={createWorkspace}
            disabled={isCreating}
            className="w-full h-auto py-2 px-2 justify-start text-base font-normal text-sidebar-foreground-muted hover:bg-sidebar-hover transition-all duration-200 ease-out"
          >
            <Plus size={18} strokeWidth={1.5} />
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
            onRefresh={handleRefreshFileTree}
          />
        )}
      </SidebarContent>
    </Sidebar>

    {/* Clone Repository Dialog */}
    <CloneRepositoryDialog
      isOpen={isCloneDialogOpen}
      onClose={() => setIsCloneDialogOpen(false)}
      onClone={cloneRepository}
    />
    </>
  )
}
