import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import type { Workspace, WorkspaceCreateResult, WorkspaceListResult, WorkspaceStatus, Repository } from '@/types/workspace'
import { Plus, RefreshCw, Trash2, GitBranch, FolderGit2, Check, GitMerge, ArrowUp, ArrowDown, GitCommit, Loader2, File, Folder, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectPath } from '@/App'
import { RepositorySwitcher } from './workspace/RepositorySwitcher'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

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
    return { icon: <Loader2 size={12} className="animate-spin" />, text: 'Loading...', className: 'bg-muted text-muted-foreground' }
  }

  switch (status.status) {
    case 'merged':
      return { icon: <GitMerge size={12} />, text: 'Merged', className: 'bg-status-merged/10 text-status-merged' }
    case 'working':
      return { icon: <GitCommit size={12} />, text: 'Working', className: 'bg-status-working/10 text-status-working' }
    case 'ahead':
      return { icon: <ArrowUp size={12} />, text: `Ahead ${status.ahead}`, className: 'bg-status-ahead/10 text-status-ahead' }
    case 'behind':
      return { icon: <ArrowDown size={12} />, text: `Behind ${status.behind}`, className: 'bg-status-behind/10 text-status-behind' }
    case 'diverged':
      return { icon: <GitCommit size={12} />, text: 'Diverged', className: 'bg-status-diverged/10 text-status-diverged' }
    case 'synced':
      return { icon: <Check size={12} />, text: 'Synced', className: 'bg-status-synced/10 text-status-synced' }
    case 'local':
      return { icon: <GitBranch size={12} />, text: 'Local Only', className: 'bg-muted text-muted-foreground' }
    default:
      return { icon: <Loader2 size={12} />, text: 'Unknown', className: 'bg-muted text-muted-foreground' }
  }
}

// File tree structure for workspace files
interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  modified?: boolean
  added?: boolean
}

// File Tree Item Component
const FileTreeItem: React.FC<{
  node: FileNode
  depth: number
  onSelect?: (path: string) => void
  selectedFile?: string | null
}> = ({ node, depth, onSelect, selectedFile }) => {
  const [isOpen, setIsOpen] = useState(depth === 0) // Auto-expand root folders

  if (node.type === 'folder') {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              className="w-full"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isOpen ? (
                <ChevronDown size={14} className="flex-shrink-0" />
              ) : (
                <ChevronRight size={14} className="flex-shrink-0" />
              )}
              <Folder size={14} className="flex-shrink-0 text-sidebar-foreground-muted" />
              <span className="text-sm truncate">{node.name}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {node.children?.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                onSelect={onSelect}
                selectedFile={selectedFile}
              />
            ))}
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    )
  }

  // File node
  const isSelected = selectedFile === node.path

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => onSelect?.(node.path)}
        isActive={isSelected}
        className="w-full"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <File size={14} className="flex-shrink-0 text-sidebar-foreground-muted" />
        <span className="text-sm truncate flex-1">{node.name}</span>

        {/* Git status badges */}
        {node.modified && (
          <span className="text-[10px] px-1 rounded bg-status-working/20 text-status-working font-medium">
            M
          </span>
        )}
        {node.added && (
          <span className="text-[10px] px-1 rounded bg-status-synced/20 text-status-synced font-medium">
            A
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
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

  const handleDeleteWorkspace = (e: React.MouseEvent, workspaceId: string, workspaceName: string) => {
    e.stopPropagation()
    if (confirm(`Delete workspace "${workspaceName}"?`)) {
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

                return (
                  <SidebarMenuItem key={workspace.id}>
                    <SidebarMenuButton
                      onClick={() => onSelectWorkspace(workspace)}
                      isActive={isActive}
                      className="flex-col items-start h-auto py-2"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <FolderGit2 size={14} className="flex-shrink-0" />
                        <span className="text-sm font-medium truncate flex-1">
                          {workspace.name}
                        </span>
                      </div>

                      {showBranch && (
                        <div className="flex items-center gap-1.5 ml-5 w-full">
                          <GitBranch size={10} className="text-sidebar-foreground-muted flex-shrink-0" />
                          <span className="text-[11px] text-sidebar-foreground-muted truncate">
                            {workspace.branch}
                          </span>
                        </div>
                      )}

                      <div className="ml-5 flex items-center gap-2 flex-wrap w-full">
                        <div className={cn(
                          "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium",
                          badge.className
                        )}>
                          {badge.icon}
                          <span>{badge.text}</span>
                        </div>

                        {status && !status.clean && (
                          <div className="text-[10px] text-status-working">
                            {status.modified > 0 && `${status.modified}M`}
                            {status.added > 0 && ` ${status.added}A`}
                            {status.deleted > 0 && ` ${status.deleted}D`}
                            {status.untracked > 0 && ` ${status.untracked}U`}
                          </div>
                        )}
                      </div>
                    </SidebarMenuButton>

                    <SidebarMenuAction
                      showOnHover
                      onClick={(e) => handleDeleteWorkspace(e, workspace.id, workspace.name)}
                      className="text-sidebar-foreground-muted hover:text-destructive"
                    >
                      <Trash2 size={12} />
                      <span className="sr-only">Delete</span>
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                )
              })
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* Files Section (only when workspace selected) */}
        {selectedWorkspace && (
          <SidebarGroup>
            <SidebarGroupLabel>Files</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoadingFiles ? (
                  <div className="px-4 py-6 text-center text-sidebar-foreground-muted">
                    <Loader2 size={16} className="mx-auto animate-spin mb-2" />
                    <p className="text-xs">Loading files...</p>
                  </div>
                ) : fileTree.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sidebar-foreground-muted">
                    <p className="text-xs">No files found</p>
                  </div>
                ) : (
                  fileTree.map((node) => (
                    <FileTreeItem
                      key={node.path}
                      node={node}
                      depth={0}
                      onSelect={onFileSelect}
                      selectedFile={selectedFile}
                    />
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between text-xs text-sidebar-foreground-muted px-2">
          <span>{workspaces.length} workspace(s)</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-status-synced" />
            <span>Ready</span>
            <button
              onClick={() => {
                loadWorkspaces()
                if (workspaces.length > 0) {
                  loadStatuses(workspaces)
                }
              }}
              disabled={isLoading}
              className="ml-1 p-1 hover:bg-sidebar-accent rounded transition-colors disabled:opacity-50"
              title="Refresh workspaces"
            >
              <RefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
