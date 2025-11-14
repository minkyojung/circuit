import * as React from 'react'
import { useEffect, useState, useCallback, useMemo } from 'react'
import type { Workspace, WorkspaceStatus, Repository } from '@/types/workspace'
import type { SimpleBranchPlan } from '@/types/plan'
import type { Conversation } from '@/types/conversation'
import { Plus, GitBranch, Check, GitMerge, GitCommit, Archive, Trash2, ChevronRight, ChevronDown, MessageSquare, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectPath } from '@/App'
import { RepositorySwitcher } from './workspace/RepositorySwitcher'
import { CloneRepositoryDialog } from './workspace/CloneRepositoryDialog'
import { FileExplorer, type FileNode } from './workspace/FileExplorer'
import { useRepositories } from '@/hooks/useRepositories'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useGitStatus } from '@/hooks/useGitStatus'
import { useFileTree } from '@/hooks/useFileTree'
import { useBranchPlan } from '@/hooks/useBranchPlan'
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

const ipcRenderer = window.electron.ipcRenderer;

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  selectedWorkspaceId: string | null
  selectedWorkspace: Workspace | null
  onSelectWorkspace: (workspace: Workspace | null) => void
  selectedFile: string | null
  onFileSelect: (filePath: string) => void
  onWorkspacesLoaded?: (workspaces: Workspace[]) => void
  onRepositoryChange?: (repository: Repository | null) => void
  onSelectConversation?: (conversationId: string) => void
  activeConversationId?: string | null
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

export function AppSidebar({ selectedWorkspaceId, selectedWorkspace, onSelectWorkspace, selectedFile, onFileSelect, onWorkspacesLoaded, onRepositoryChange, onSelectConversation, activeConversationId, ...props }: AppSidebarProps) {
  const { projectPath } = useProjectPath()
  const { state } = useSidebar()

  // Extract workspaces management to custom hook
  const {
    workspaces,
    isCreating,
    loadWorkspaces,
    createWorkspace: createWorkspaceAction,
    archiveWorkspace: archiveWorkspaceAction,
    deleteWorkspace: deleteWorkspaceAction,
    setWorkspaces,
  } = useWorkspaces({ onWorkspacesLoaded })

  // Plans management for selected workspace
  const {
    allPlans,
    loading: loadingPlans,
    refresh: refreshPlans,
    analyzePlan,
    generatePlan,
    executePlan,
  } = useBranchPlan(selectedWorkspace?.id)

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationsByPlan, setConversationsByPlan] = useState<Record<string, Conversation[]>>({})
  const [loadingConversations, setLoadingConversations] = useState(false)

  // All conversations (plan + general) sorted by updatedAt
  const allConversations = useMemo(() => {
    const planConversations = Object.values(conversationsByPlan).flat()
    return [...planConversations, ...conversations].sort((a, b) => {
      // Parse ISO strings or numbers
      const aTime = typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : a.updatedAt
      const bTime = typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : b.updatedAt
      return bTime - aTime // Most recent first
    })
  }, [conversations, conversationsByPlan])

  // Expanded plans state (for collapsible UI)
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set())

  // Toggle plan expansion
  const togglePlanExpansion = useCallback((planId: string) => {
    setExpandedPlans(prev => {
      const next = new Set(prev)
      if (next.has(planId)) {
        next.delete(planId)
      } else {
        next.add(planId)
      }
      return next
    })
  }, [])

  // Handle plan creation completion
  const handlePlanCreated = useCallback(async (planId: string, firstConversationId?: string) => {
    // Refresh plans and conversations
    await refreshPlans()

    // Reload conversations to get newly created ones
    if (selectedWorkspace) {
      const result = await ipcRenderer.invoke('conversation:list', selectedWorkspace.id)
      if (result.success && result.conversations) {
        const allConvs: Conversation[] = result.conversations
        const generalConvs = allConvs.filter(c => !c.planId)
        setConversations(generalConvs)

        const byPlan: Record<string, Conversation[]> = {}
        allConvs.forEach(c => {
          if (c.planId) {
            if (!byPlan[c.planId]) {
              byPlan[c.planId] = []
            }
            byPlan[c.planId].push(c)
          }
        })
        setConversationsByPlan(byPlan)
      }
    }

    // Auto-expand the newly created plan
    setExpandedPlans(prev => new Set([...prev, planId]))

    // Select first conversation if available
    if (firstConversationId) {
      onSelectConversation?.(firstConversationId)
    }
  }, [refreshPlans, selectedWorkspace, onSelectConversation])

  // Extract repositories management to custom hook
  const {
    repositories,
    currentRepository: repository,
    isCloneDialogOpen,
    loadRepositories,
    createRepository: createRepositoryAction,
    cloneRepository: cloneRepositoryAction,
    removeRepository: removeRepositoryAction,
    switchRepository: switchRepositoryAction,
    openCloneDialog,
    closeCloneDialog,
  } = useRepositories({
    projectPath,
    onRepositoryChange,
    onWorkspaceLoad: (workspaces, repositoryPath) => {
      setWorkspaces(workspaces)
      onWorkspacesLoaded?.(workspaces)
    },
  })

  // Extract git status management to custom hook
  const { statuses } = useGitStatus(workspaces, repository?.id)

  // Extract file tree management to custom hook
  const { fileTree, isLoadingFiles, refresh: refreshFileTree } = useFileTree(selectedWorkspace?.path)

  // Load repositories on mount
  useEffect(() => {
    loadRepositories()
  }, [loadRepositories])

  // Load workspaces when repository changes
  useEffect(() => {
    if (repository) {
      loadWorkspaces(repository.path)
    }
  }, [repository.id, loadWorkspaces])

  // Load conversations when workspace changes
  useEffect(() => {
    const loadConversations = async () => {
      if (!selectedWorkspace) {
        setConversations([])
        setConversationsByPlan({})
        setExpandedPlans(new Set()) // Clear expanded plans on workspace switch
        return
      }

      // Clear expanded plans when switching workspaces
      setExpandedPlans(new Set())

      try {
        setLoadingConversations(true)

        // Load all conversations for workspace
        const result = await ipcRenderer.invoke('conversation:list', selectedWorkspace.id)

        if (result.success && result.conversations) {
          const allConvs: Conversation[] = result.conversations

          // Separate general conversations (planId = null) from plan conversations
          const generalConvs = allConvs.filter(c => !c.planId)
          setConversations(generalConvs)

          // Group conversations by planId
          const byPlan: Record<string, Conversation[]> = {}
          allConvs.forEach(c => {
            if (c.planId) {
              if (!byPlan[c.planId]) {
                byPlan[c.planId] = []
              }
              byPlan[c.planId].push(c)
            }
          })
          setConversationsByPlan(byPlan)
        }
      } catch (error) {
        console.error('[AppSidebar] Failed to load conversations:', error)
      } finally {
        setLoadingConversations(false)
      }
    }

    loadConversations()
  }, [selectedWorkspace?.id])

  // Listen for plan:created event to refresh sidebar
  useEffect(() => {
    const handlePlanCreated = async (event: any, data: { planId: string; workspaceId: string }) => {
      console.log('[AppSidebar] Plan created event received:', data);

      // Only refresh if it's for the current workspace
      if (selectedWorkspace && data.workspaceId === selectedWorkspace.id) {
        try {
          // Reload conversations to show newly created plan conversations
          const result = await ipcRenderer.invoke('conversation:list', selectedWorkspace.id);

          if (result.success && result.conversations) {
            const allConvs: Conversation[] = result.conversations;

            // Separate general conversations from plan conversations
            const generalConvs = allConvs.filter(c => !c.planId);
            setConversations(generalConvs);

            // Group conversations by planId
            const byPlan: Record<string, Conversation[]> = {};
            allConvs.forEach(c => {
              if (c.planId) {
                if (!byPlan[c.planId]) {
                  byPlan[c.planId] = [];
                }
                byPlan[c.planId].push(c);
              }
            });
            setConversationsByPlan(byPlan);

            // Auto-expand the newly created plan
            setExpandedPlans(prev => new Set([...prev, data.planId]));

            console.log('[AppSidebar] Sidebar refreshed after plan creation');
          }
        } catch (error) {
          console.error('[AppSidebar] Failed to refresh after plan creation:', error);
        }
      }
    };

    ipcRenderer.on('plan:created', handlePlanCreated);

    return () => {
      ipcRenderer.removeListener('plan:created', handlePlanCreated);
    };
  }, [selectedWorkspace?.id]);

  // Wrapper functions that delegate to hooks
  const createWorkspace = async () => {
    if (!repository) {
      alert('Please select a repository first')
      return
    }
    await createWorkspaceAction(repository.path)
  }

  const archiveWorkspace = async (workspaceId: string) => {
    if (!repository) return
    await archiveWorkspaceAction(workspaceId, repository.path)
    // Clear active workspace if it was archived
    if (selectedWorkspaceId === workspaceId) {
      onSelectWorkspace(null)
    }
  }

  const deleteWorkspace = async (workspaceId: string) => {
    if (!repository) return
    await deleteWorkspaceAction(workspaceId, repository.path)
    // Clear active workspace if it was deleted
    if (selectedWorkspaceId === workspaceId) {
      onSelectWorkspace(null)
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

  return (
    <>
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className={cn(
        state === "collapsed" && "pl-16"
      )}>
        {/* Traffic Lights Area (Fully Draggable) */}
        <div
          className="h-[36px] -m-2 mb-0 -ml-2"
          style={{ WebkitAppRegion: 'drag' } as any}
        />

        {/* Repository Switcher */}
        <RepositorySwitcher
          currentRepository={repository}
          repositories={repositories.length > 0 ? repositories : [repository]}
          onSelectRepository={switchRepositoryAction}
          onCreateRepository={createRepositoryAction}
          onCloneRepository={openCloneDialog}
          onRemoveRepository={removeRepositoryAction}
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

        {/* Conversations Section (only when workspace selected) */}
        {selectedWorkspace && (
          <>
            {/* All Conversations (plan + general) */}
            <SidebarGroup>
              <div className="px-4 py-2 text-xs font-semibold text-sidebar-foreground-muted uppercase tracking-wide">
                Conversations
              </div>
              <SidebarMenu>
                {allConversations.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-4 py-4 text-center"
                    style={{ color: 'var(--sidebar-foreground-muted)' }}
                  >
                    <p className="text-xs">No conversations yet</p>
                  </motion.div>
                ) : (
                  allConversations.map((conv) => {
                    // Check if this conversation belongs to a plan
                    const isPlanConversation = !!conv.planId
                    const Icon = isPlanConversation ? FolderKanban : MessageSquare

                    return (
                      <SidebarMenuItem key={conv.id} className="my-0">
                        <SidebarMenuButton
                          onClick={() => onSelectConversation?.(conv.id)}
                          isActive={activeConversationId === conv.id}
                          className="h-auto py-2 px-2 group transition-all duration-200 ease-out"
                        >
                          <div className="flex gap-3 w-full min-w-0">
                            <Icon size={14} strokeWidth={1.5} className="text-sidebar-foreground-muted mt-[3px]" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-normal truncate text-sidebar-foreground">
                                {conv.title}
                              </div>
                              {isPlanConversation && (
                                <div className="text-xs text-sidebar-foreground opacity-40">
                                  Plan
                                </div>
                              )}
                            </div>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })
                )}
              </SidebarMenu>

              {/* New Conversation Button */}
              <div className="px-2 pb-2">
                <Button
                  variant="ghost"
                  onClick={() => console.log('Create new conversation')}
                  className="w-full h-auto py-2 px-2 justify-start text-sm font-normal text-sidebar-foreground-muted hover:bg-sidebar-hover transition-all duration-200 ease-out"
                >
                  <Plus size={16} strokeWidth={1.5} />
                  New Conversation
                </Button>
              </div>
            </SidebarGroup>
          </>
        )}

        {/* Files Section (only when workspace selected) */}
        {selectedWorkspace && (
          <FileExplorer
            fileTree={fileTree}
            isLoading={isLoadingFiles}
            onFileSelect={onFileSelect}
            selectedFile={selectedFile}
            onRefresh={refreshFileTree}
          />
        )}
      </SidebarContent>
    </Sidebar>

    {/* Clone Repository Dialog */}
    <CloneRepositoryDialog
      isOpen={isCloneDialogOpen}
      onClose={closeCloneDialog}
      onClone={cloneRepositoryAction}
    />
    </>
  )
}
