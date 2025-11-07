import { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react'
import { CommitDialog } from "@/components/workspace/CommitDialog"
import { AppSidebar } from "@/components/AppSidebar"
import { TodoPanel } from "@/components/TodoPanel"
import { GitTestPanel } from "@/components/git/GitTestPanel"
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState"
import { ChatPanel, EditorPanel } from "@/components/workspace/WorkspaceChatEditor"
import { QuickOpenSearch } from "@/components/QuickOpenSearch"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Workspace } from "@/types/workspace"
import { PanelLeft, PanelRight, FolderGit2, Columns2, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readCircuitConfig, logCircuitStatus } from '@/core/config-reader'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { TerminalProvider } from '@/contexts/TerminalContext'
import { AgentProvider } from '@/contexts/AgentContext'
import { RepositoryProvider } from '@/contexts/RepositoryContext'
import { CompactBanner } from '@/components/CompactBanner'
import { CompactUrgentModal } from '@/components/CompactUrgentModal'
import { Toaster, toast } from 'sonner'
import { FEATURES } from '@/config/features'
import { useEditorGroups } from '@/hooks/useEditorGroups'
import { useWorkspaceContext } from '@/hooks/useWorkspaceContext'
import { createConversationTab, createFileTab, createSettingsTab } from '@/types/editor'
import type { Tab } from '@/types/editor'
import { getFileName } from '@/lib/fileUtils'
import { EditorGroupPanel } from '@/components/editor'
import { DEFAULT_GROUP_ID, SECONDARY_GROUP_ID } from '@/types/editor'
import { PathResolver } from '@/lib/pathResolver'
import { SettingsPanel } from '@/components/SettingsPanel'
import './App.css'

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron')

// Project Path Context
interface ProjectPathContextValue {
  projectPath: string
  isLoading: boolean
}

const ProjectPathContext = createContext<ProjectPathContextValue>({
  projectPath: '',
  isLoading: true
})

export const useProjectPath = () => useContext(ProjectPathContext)

// Header component that uses sidebar state
function MainHeader({
  selectedWorkspace,
  repositoryName,
  viewMode,
  setViewMode,
  allTabs,
  toggleRightSidebar,
  isRightSidebarOpen,
  onFileSelect,
  onWorkspaceSelect,
  activeFilePath,
  searchBarRef
}: {
  selectedWorkspace: Workspace | null
  repositoryName: string
  viewMode: 'chat' | 'editor' | 'split'
  setViewMode: (mode: 'chat' | 'editor' | 'split') => void
  allTabs: Tab[]
  toggleRightSidebar: () => void
  isRightSidebarOpen: boolean
  onFileSelect: (path: string, line?: number) => void
  onWorkspaceSelect: (workspaceId: string) => void
  activeFilePath: string | null
  searchBarRef: React.RefObject<HTMLInputElement | null>
}) {
  const { state: sidebarState } = useSidebar()

  return (
    <header
      className={cn(
        "flex h-[36px] shrink-0 items-center gap-2 border-b border-border pr-3 relative z-20",
        sidebarState === 'collapsed' ? 'pl-[80px]' : 'pl-3'
      )}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left side - Sidebar toggle */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <SidebarTrigger />
      </div>

      {/* Center - Global Search Bar */}
      {selectedWorkspace && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-24"
          style={{
            WebkitAppRegion: 'no-drag',
            width: 'min(400px, calc(100vw - 200px))'
          } as any}
        >
          <QuickOpenSearch
            ref={searchBarRef}
            workspacePath={selectedWorkspace.path}
            branchName={selectedWorkspace.branch}
            onFileSelect={onFileSelect}
            onWorkspaceSelect={onWorkspaceSelect}
            activeFilePath={activeFilePath}
          />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side - Controls */}
      {selectedWorkspace && (
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          {/* Split View Toggle */}
          {allTabs.length > 0 && (
            <>
              <Button
                onClick={() => setViewMode(viewMode === 'split' ? 'chat' : 'split')}
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7",
                  viewMode === 'split'
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground'
                )}
                title={viewMode === 'split' ? 'Single View' : 'Split View'}
              >
                <Columns2 size={16} />
              </Button>
              <Separator orientation="vertical" className="h-4" />
            </>
          )}

          {/* Toggle Right Panel */}
          <Button
            onClick={toggleRightSidebar}
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              isRightSidebarOpen
                ? 'text-foreground'
                : 'text-muted-foreground'
            )}
            title="Toggle right panel"
          >
            <PanelRight size={16} />
          </Button>
        </div>
      )}
    </header>
  )
}

function App() {
  const [projectPath, setProjectPath] = useState<string>('')
  const [isLoadingPath, setIsLoadingPath] = useState<boolean>(true)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [showCommitDialog, setShowCommitDialog] = useState<boolean>(false)
  const [chatPrefillMessage, setChatPrefillMessage] = useState<string | null>(null)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('circuit-right-sidebar-state')
    return saved !== null ? JSON.parse(saved) : true // 기본값: 열림
  })
  const [currentRepository, setCurrentRepository] = useState<any>(null)

  // State for conversation deletion confirmation modal
  const [pendingDeleteConversation, setPendingDeleteConversation] = useState<{
    conversationId: string
    tabId: string
    groupId: string
  } | null>(null)

  // Path resolver for consistent file path normalization
  const [pathResolver, setPathResolver] = useState<PathResolver | null>(null)

  // Ref for search bar (to trigger focus from keyboard shortcut)
  const searchBarRef = useRef<HTMLInputElement>(null)

  // Session ID for chat (one per workspace for now)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Initialize Claude session when workspace changes
  useEffect(() => {
    if (!selectedWorkspace) {
      console.log('[🔥 App] No workspace selected, skipping session initialization')
      return
    }

    console.log('[🔥 App] Initializing Claude session for workspace:', {
      workspacePath: selectedWorkspace.path,
      workspaceId: selectedWorkspace.id,
      workspaceName: selectedWorkspace.name
    })

    const startSession = async () => {
      try {
        console.log('[App] Starting Claude session for:', selectedWorkspace.path)
        const result = await ipcRenderer.invoke('claude:start-session', selectedWorkspace.path)

        if (result.success) {
          console.log('[App] Claude session started:', result.sessionId)
          setSessionId(result.sessionId)
        } else {
          console.error('[App] Failed to start Claude session:', result.error)
          alert(`Failed to start Claude session: ${result.error}`)
        }
      } catch (error) {
        console.error('[App] Error starting Claude session:', error)
      }
    }

    startSession()

    // Cleanup: stop session when workspace changes or component unmounts
    return () => {
      if (sessionId) {
        console.log('[App] Stopping Claude session:', sessionId)
        ipcRenderer.invoke('claude:stop-session', sessionId)
      }
    }
  }, [selectedWorkspace?.path])

  // Update PathResolver when workspace changes
  useEffect(() => {
    if (!selectedWorkspace) {
      setPathResolver(null)
      return
    }

    // ✅ For worktree-based workspaces, workspace.path IS the projectRoot
    // Example: /project/.conductor/workspaces/duck is the working directory for "duck" branch
    // Files are at: /project/.conductor/workspaces/duck/src/App.tsx
    const projectRoot = selectedWorkspace.path

    console.log('[App] Initializing PathResolver:', {
      workspaceId: selectedWorkspace.id,
      workspacePath: selectedWorkspace.path,
      projectRoot
    })
    setPathResolver(new PathResolver(projectRoot))
  }, [selectedWorkspace?.path])

  // File cursor position for jumping to line
  const [fileCursorPosition, setFileCursorPosition] = useState<{
    filePath: string
    lineStart: number
    lineEnd: number
  } | null>(null)

  // Code selection action for editor
  const [codeSelectionAction, setCodeSelectionAction] = useState<{
    type: 'ask' | 'explain' | 'optimize' | 'add-tests'
    code: string
    filePath: string
    lineStart: number
    lineEnd: number
  } | null>(null)

  // View mode state
  type ViewMode = 'chat' | 'editor' | 'split'
  const [viewMode, setViewMode] = useState<ViewMode>('chat')

  // Panel focus state (which group is currently focused)
  const [focusedGroupId, setFocusedGroupId] = useState<string>(DEFAULT_GROUP_ID)

  // Use ref to always access the latest focusedGroupId value (avoid stale closure)
  const focusedGroupIdRef = useRef<string>(DEFAULT_GROUP_ID)
  useEffect(() => {
    focusedGroupIdRef.current = focusedGroupId
  }, [focusedGroupId])

  // Context tracking for auto-compact
  const { context: workspaceContext } = useWorkspaceContext(
    selectedWorkspace?.id,
    selectedWorkspace?.path
  )

  // Drag state for tab dragging between panels
  const [draggedTab, setDraggedTab] = useState<{ tabId: string; sourceGroupId: string } | null>(null)

  // ============================================================================
  // NEW: Unified Editor Groups System
  // ============================================================================

  const {
    editorGroups,
    openTab,
    closeTab,
    activateTab,
    moveTab,
    updateTab,
    reorderTabs,
    getActiveTab,
    findTab,
    getAllTabs,
    addGroup,
    removeGroup,
  } = useEditorGroups([
    { id: DEFAULT_GROUP_ID, tabs: [], activeTabId: null },
    { id: SECONDARY_GROUP_ID, tabs: [], activeTabId: null },
  ])

  // Get specific groups for rendering
  const primaryGroup = editorGroups.find(g => g.id === DEFAULT_GROUP_ID) || editorGroups[0]
  const secondaryGroup = editorGroups.find(g => g.id === SECONDARY_GROUP_ID) || editorGroups[1]

  // Get active conversation ID for TodoPanel (from primary group's active conversation tab)
  const activeConversationId = useMemo(() => {
    const activeTab = getActiveTab(DEFAULT_GROUP_ID)
    if (activeTab && activeTab.type === 'conversation') {
      return activeTab.data.conversationId
    }
    return null
  }, [primaryGroup.activeTabId, getActiveTab])

  // Get active file path for symbol search
  const activeFilePath = useMemo(() => {
    const activeTab = getActiveTab(DEFAULT_GROUP_ID)
    if (activeTab && activeTab.type === 'file') {
      return activeTab.data.filePath
    }
    return null
  }, [primaryGroup.activeTabId, getActiveTab])

  // Render functions for panels
  const renderChatPanel = (conversationId: string, workspaceId: string) => {
    if (!selectedWorkspace) return null

    return (
      <ChatPanel
        workspace={selectedWorkspace}
        sessionId={sessionId}
        onFileEdit={handleFileSelect}
        prefillMessage={chatPrefillMessage}
        externalConversationId={conversationId}
        onPrefillCleared={() => setChatPrefillMessage(null)}
        onConversationChange={async (convId) => {
          // Update the conversation tab when conversation changes
          if (convId && convId !== conversationId) {
            try {
              // Fetch conversation to get title
              const result = await ipcRenderer.invoke('conversation:get', convId)
              const conversationTitle = result?.conversation?.title || 'Chat'

              const newTab = createConversationTab(convId, workspaceId, conversationTitle, selectedWorkspace?.name)
              openTab(newTab)
            } catch (error) {
              console.error('[App] Error fetching conversation title:', error)
              // Fallback to workspace name
              const newTab = createConversationTab(convId, workspaceId, undefined, selectedWorkspace?.name)
              openTab(newTab)
            }
          }
        }}
        onFileReferenceClick={handleFileSelect}
        codeSelectionAction={codeSelectionAction}
        onCodeSelectionHandled={() => setCodeSelectionAction(null)}
      />
    )
  }

  const renderEditorPanel = (filePath: string) => {
    if (!selectedWorkspace) return null

    // Get all file tabs for openFiles list
    const fileTabs = getAllTabs().filter(t => t.type === 'file')
    const openFilePaths = fileTabs.map(t => (t as any).data.filePath)

    return (
      <EditorPanel
        workspace={selectedWorkspace}
        sessionId={sessionId}
        openFiles={openFilePaths}
        selectedFile={filePath}
        onCloseFile={(path) => {
          // Find and close the file tab (using workspace-scoped ID)
          const tabId = `file-${selectedWorkspace.id}-${path}`
          const result = findTab(tabId)
          if (result) {
            closeTab(result.tab.id, result.groupId)
          }
        }}
        onUnsavedChange={handleUnsavedChange}
        fileCursorPosition={fileCursorPosition}
        onCodeSelectionAction={setCodeSelectionAction}
      />
    )
  }

  const renderSettingsPanel = () => {
    return <SettingsPanel workspacePath={selectedWorkspace?.path} />
  }

  // Workspace navigation refs (for keyboard shortcuts)
  const workspacesRef = useRef<Workspace[]>([])
  const setWorkspacesForShortcuts = (workspaces: Workspace[]) => {
    workspacesRef.current = workspaces
  }

  // Toggle right sidebar with localStorage persistence
  const toggleRightSidebar = () => {
    setIsRightSidebarOpen(prev => {
      const newState = !prev
      localStorage.setItem('circuit-right-sidebar-state', JSON.stringify(newState))
      return newState
    })
  }

  // Create workspace handler for Command Palette
  const handleCreateWorkspace = async () => {
    const { ipcRenderer } = window.require('electron')
    try {
      const result = await ipcRenderer.invoke('workspace:create')
      if (result.success && result.workspace) {
        // Refresh workspaces list
        const listResult = await ipcRenderer.invoke('workspace:list')
        if (listResult.success) {
          setWorkspacesForShortcuts(listResult.workspaces)
        }
      }
    } catch (error) {
      console.error('Error creating workspace:', error)
    }
  }

  // Load project path from Electron main process
  useEffect(() => {
    const loadProjectPath = async () => {
      try {
        const { ipcRenderer } = window.require('electron')
        const result = await ipcRenderer.invoke('circuit:get-project-path')

        if (result.success) {
          console.log('[App] Project path loaded:', result.projectPath)
          setProjectPath(result.projectPath)
        } else {
          console.error('[App] Failed to load project path:', result.error)
        }
      } catch (error) {
        console.error('[App] Error loading project path:', error)
      } finally {
        setIsLoadingPath(false)
      }
    }

    loadProjectPath()
  }, [])

  // Phase 0: .circuit/ 설정 읽기 시도
  useEffect(() => {
    if (!projectPath) return

    const checkCircuitConfig = async () => {
      const config = await readCircuitConfig(projectPath)
      logCircuitStatus(config)
    }

    checkCircuitConfig()
  }, [projectPath])

  // Extract repository name from current repository or project path
  const repositoryName = useMemo(() => {
    if (currentRepository?.name) {
      return currentRepository.name
    }
    return projectPath.split('/').filter(Boolean).pop() || 'Unknown Repository'
  }, [currentRepository, projectPath])

  // ============================================================================
  // NEW: File/Conversation Handlers (Unified Tab System)
  // ============================================================================

  // Handle file selection from sidebar or file reference pills
  const handleFileSelect = async (filePath: string, lineStart?: number, lineEnd?: number) => {
    // Guard: PathResolver must be initialized
    if (!pathResolver) {
      console.error('[App] PathResolver not initialized - cannot open file');
      toast.error('파일 경로 변환기가 초기화되지 않았습니다');
      return;
    }

    // Guard: Workspace must be selected
    if (!selectedWorkspace) {
      console.error('[App] No workspace selected - cannot open file');
      toast.error('워크스페이스가 선택되지 않았습니다');
      return;
    }

    // ✅ STEP 1: Normalize file path using PathResolver
    const normalizedPath = pathResolver.normalize(filePath);
    const absolutePath = pathResolver.toAbsolute(normalizedPath);

    console.log('[App] Opening file:', {
      original: filePath,
      normalized: normalizedPath,
      absolute: absolutePath,
      workspaceId: selectedWorkspace.id,
      projectRoot: pathResolver.getProjectRoot()
    });

    // ✅ STEP 2: Validate file existence
    try {
      const exists = await ipcRenderer.invoke('file-exists', absolutePath);

      if (!exists) {
        console.warn('[App] File does not exist:', normalizedPath);
        toast.error(`파일을 찾을 수 없습니다: ${normalizedPath}`);
        return;
      }
    } catch (error) {
      console.error('[App] Error checking file existence:', normalizedPath, error);
      toast.error(`파일 확인 중 오류 발생: ${normalizedPath}`);
      return;
    }

    // ✅ STEP 3: Create file tab with workspace-scoped identity
    const currentFocusedGroup = focusedGroupIdRef.current;
    const tab = createFileTab(
      normalizedPath,
      selectedWorkspace.id,  // ✅ Workspace-scoped tab ID
      getFileName(normalizedPath)
    );

    // Open in currently focused group
    openTab(tab, currentFocusedGroup);

    // ✅ STEP 4: Store line selection with normalized path
    if (lineStart) {
      setFileCursorPosition({
        filePath: normalizedPath,
        lineStart,
        lineEnd: lineEnd || lineStart
      });
    } else {
      setFileCursorPosition(null);
    }
  }

  // Handle tab click with workspace synchronization
  const handleTabClick = (tabId: string, groupId: string) => {
    setFocusedGroupId(groupId)
    activateTab(tabId, groupId)

    // Sync workspace: find the tab and update selectedWorkspace
    const tab = getAllTabs().find(t => t.id === tabId)
    if (tab && tab.type === 'conversation') {
      const tabWorkspaceId = tab.data.workspaceId
      const currentWorkspaceId = selectedWorkspace?.id

      // Only update if workspace changed
      if (tabWorkspaceId !== currentWorkspaceId) {
        const workspace = workspacesRef.current.find(w => w.id === tabWorkspaceId)
        if (workspace) {
          setSelectedWorkspace(workspace)
        }
      }
    }
  }

  // Handle workspace selection with tab synchronization
  const handleWorkspaceSelect = async (workspace: Workspace | null) => {
    if (!workspace) {
      setSelectedWorkspace(null)
      return
    }

    // Update workspace state
    setSelectedWorkspace(workspace)

    // Track recent workspace access
    try {
      const stored = localStorage.getItem('circuit-recent-workspaces')
      const recentWorkspaces = stored ? JSON.parse(stored) : []

      // Remove existing entry for this workspace
      const filtered = recentWorkspaces.filter((w: any) => w.id !== workspace.id)

      // Add to front with current timestamp
      const updated = [
        {
          id: workspace.id,
          name: workspace.name,
          path: workspace.path,
          branch: workspace.branch,
          lastAccessed: Date.now()
        },
        ...filtered
      ].slice(0, 20) // Keep max 20 recent workspaces

      localStorage.setItem('circuit-recent-workspaces', JSON.stringify(updated))
    } catch (error) {
      console.error('[App] Failed to update recent workspaces:', error)
    }

    // Find existing conversation tab for this workspace
    const allTabs = getAllTabs()
    const workspaceTab = allTabs.find(tab =>
      tab.type === 'conversation' && tab.data.workspaceId === workspace.id
    )

    if (workspaceTab) {
      // Activate existing tab
      const tabLocation = findTab(workspaceTab.id)
      if (tabLocation) {
        activateTab(workspaceTab.id, tabLocation.groupId)
      }
    } else {
      // No tab exists - load or create conversation
      try {
        // Try to get active conversation for this workspace
        const activeResult = await ipcRenderer.invoke('conversation:get-active', workspace.id)

        if (activeResult.success && activeResult.conversation) {
          // Create tab with conversation title
          const tab = createConversationTab(
            activeResult.conversation.id,
            workspace.id,
            activeResult.conversation.title,
            workspace.name
          )
          openTab(tab, DEFAULT_GROUP_ID)
        } else {
          // No active conversation - create new one
          const createResult = await ipcRenderer.invoke('conversation:create', workspace.id, {
            workspaceName: workspace.name
          })

          if (createResult.success && createResult.conversation) {
            const tab = createConversationTab(
              createResult.conversation.id,
              workspace.id,
              createResult.conversation.title,
              workspace.name
            )
            openTab(tab, DEFAULT_GROUP_ID)
          }
        }
      } catch (error) {
        console.error('[App] Error loading conversation for workspace:', error)
      }
    }
  }

  // Handle workspace selection by ID (for QuickOpenSearch)
  const handleWorkspaceSelectById = (workspaceId: string) => {
    const workspace = workspacesRef.current.find(w => w.id === workspaceId)
    if (workspace) {
      handleWorkspaceSelect(workspace)
    }
  }

  // Handle conversation selection
  const handleConversationSelect = (conversationId: string, workspaceId: string, title?: string) => {
    // Use ref to get latest focusedGroupId (avoid stale closure)
    const currentFocusedGroup = focusedGroupIdRef.current
    // Create or activate conversation tab in focused group
    const tab = createConversationTab(
      conversationId,
      workspaceId,
      title,
      selectedWorkspace?.name
    )
    openTab(tab, currentFocusedGroup)
  }

  // Handle opening settings
  const handleOpenSettings = () => {
    const currentFocusedGroup = focusedGroupIdRef.current

    // Check if settings tab already exists
    const allTabs = getAllTabs()
    const settingsTab = allTabs.find(tab => tab.type === 'settings')

    if (settingsTab) {
      // Settings tab exists, activate it
      const tabLocation = findTab(settingsTab.id)
      if (tabLocation) {
        activateTab(settingsTab.id, tabLocation.groupId)
      }
    } else {
      // Create new settings tab
      const tab = createSettingsTab()
      openTab(tab, currentFocusedGroup)
    }
  }

  // Handle new conversation creation
  const handleCreateConversation = async () => {
    if (!selectedWorkspace) return

    try {
      const createResult = await ipcRenderer.invoke('conversation:create', selectedWorkspace.id, {
        workspaceName: selectedWorkspace.name
      })

      if (createResult.success && createResult.conversation) {
        const tab = createConversationTab(
          createResult.conversation.id,
          selectedWorkspace.id,
          createResult.conversation.title,
          selectedWorkspace.name
        )
        // Open in currently focused group
        openTab(tab, focusedGroupIdRef.current)
      } else {
        console.error('[App] Failed to create conversation:', createResult.error)
      }
    } catch (error) {
      console.error('[App] Error creating conversation:', error)
    }
  }

  // VS Code style: Duplicate active tab when switching to split view
  useEffect(() => {
    if (viewMode === 'split') {
      // Get the currently active tab from primary group
      const activeTab = primaryGroup.tabs.find(t => t.id === primaryGroup.activeTabId)

      // If there's an active tab, duplicate it to secondary group
      if (activeTab && secondaryGroup.tabs.length === 0) {
        openTab(activeTab, SECONDARY_GROUP_ID)
      }
    }
  }, [viewMode])

  // Handle tab close with confirmation for conversation tabs
  const handleTabClose = (tabId: string, groupId: string) => {
    const result = findTab(tabId)
    if (!result) return

    const { tab } = result

    // Handle conversation tabs - show confirmation modal
    if (tab.type === 'conversation') {
      // Check if this is the last conversation tab
      const allConversationTabs = editorGroups.flatMap((g) =>
        g.tabs.filter((t) => t.type === 'conversation')
      )

      if (allConversationTabs.length <= 1) {
        console.log('[App] Cannot close last conversation tab')
        alert('Cannot close the last conversation tab.')
        return
      }

      // Show confirmation modal
      const conversationId = tab.data.conversationId
      setPendingDeleteConversation({
        conversationId,
        tabId: tab.id,
        groupId
      })
      console.log('[App] Showing delete confirmation for conversation:', conversationId)
      return
    }

    // Handle file tabs - check for unsaved changes
    if (tab.type === 'file' && tab.data.unsavedChanges) {
      const fileName = getFileName(tab.data.filePath)
      const confirmed = window.confirm(
        `'${fileName}' has unsaved changes. Do you want to close it?`
      )
      if (!confirmed) {
        console.log('[App] User cancelled closing file with unsaved changes')
        return
      }
    }

    // Close the tab (for file tabs and settings tabs)
    closeTab(tabId, groupId)
  }

  // Handle navigating to left or right tab (focus switch)
  const handleMoveActiveTab = (direction: 'left' | 'right') => {
    const focusedGroupId = focusedGroupIdRef.current
    const group = editorGroups.find((g) => g.id === focusedGroupId)

    if (!group || group.tabs.length === 0) {
      console.log('[App] No tabs to navigate')
      return
    }

    const currentIndex = group.tabs.findIndex((t) => t.id === group.activeTabId)

    if (currentIndex === -1) {
      console.log('[App] Could not find active tab index')
      return
    }

    // Calculate new index with wrapping
    let newIndex: number
    if (direction === 'left') {
      newIndex = currentIndex === 0 ? group.tabs.length - 1 : currentIndex - 1
    } else {
      newIndex = currentIndex === group.tabs.length - 1 ? 0 : currentIndex + 1
    }

    // Activate the tab at new index
    const targetTab = group.tabs[newIndex]
    if (targetTab) {
      activateTab(targetTab.id, focusedGroupId)
      console.log('[App] Navigated', direction, 'to tab:', targetTab.id)
    }
  }

  // Handle closing the currently active tab (triggered by Cmd+W)
  const handleCloseActiveTab = async () => {
    const focusedGroupId = focusedGroupIdRef.current
    const group = editorGroups.find((g) => g.id === focusedGroupId)
    const activeTab = group?.tabs.find((t) => t.id === group.activeTabId)

    if (!activeTab) {
      console.log('[App] No active tab to close')
      return
    }

    console.log('[App] Closing active tab:', activeTab.id, 'type:', activeTab.type)

    // Handle file tabs
    if (activeTab.type === 'file') {
      // Check for unsaved changes
      if (activeTab.data.unsavedChanges) {
        const fileName = getFileName(activeTab.data.filePath)
        const confirmed = window.confirm(
          `'${fileName}' has unsaved changes. Do you want to close it?`
        )
        if (!confirmed) {
          console.log('[App] User cancelled closing file with unsaved changes')
          return
        }
      }

      // Close the file tab
      closeTab(activeTab.id, focusedGroupId)
      return
    }

    // Handle conversation tabs
    if (activeTab.type === 'conversation') {
      // Check if this is the last conversation tab
      const allConversationTabs = editorGroups.flatMap((g) =>
        g.tabs.filter((t) => t.type === 'conversation')
      )

      if (allConversationTabs.length <= 1) {
        console.log('[App] Cannot close last conversation tab')
        alert('Cannot close the last conversation tab.')
        return
      }

      // Show confirmation modal before deleting
      const conversationId = activeTab.data.conversationId
      setPendingDeleteConversation({
        conversationId,
        tabId: activeTab.id,
        groupId: focusedGroupId
      })
      console.log('[App] Showing delete confirmation for conversation:', conversationId)
      return
    }

    // Handle settings tabs
    if (activeTab.type === 'settings') {
      // Simply close the settings tab
      closeTab(activeTab.id, focusedGroupId)
      console.log('[App] Settings tab closed')
      return
    }
  }

  // Confirm and execute conversation deletion
  const confirmDeleteConversation = async () => {
    if (!pendingDeleteConversation) return

    const { conversationId, tabId, groupId } = pendingDeleteConversation

    try {
      console.log('[App] Confirming deletion of conversation:', conversationId)
      const result = await ipcRenderer.invoke('conversation:delete', conversationId)

      if (result.success) {
        // Close the tab
        closeTab(tabId, groupId)
        console.log('[App] Conversation deleted and tab closed:', conversationId)
      } else {
        console.error('[App] Failed to delete conversation:', result.error)
        alert(`Failed to delete conversation: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[App] Error deleting conversation:', error)
      alert(`Error deleting conversation: ${error}`)
    } finally {
      // Clear the pending deletion state
      setPendingDeleteConversation(null)
    }
  }

  // Handle unsaved changes notification from editor
  const handleUnsavedChange = (filePath: string, hasChanges: boolean) => {
    // Find the file tab
    const result = findTab(`file-${filePath}`)
    if (result) {
      updateTab(result.tab.id, result.groupId, {
        data: {
          ...result.tab.data,
          unsavedChanges: hasChanges
        }
      } as any)
    }
  }

  // Drag and drop handlers
  const handleTabDragStart = (tabId: string, groupId: string) => {
    setDraggedTab({ tabId, sourceGroupId: groupId })
  }

  const handleTabDragEnd = () => {
    setDraggedTab(null)
  }

  const handleTabDrop = (targetGroupId: string, targetIndex?: number) => {
    if (!draggedTab) return

    const { tabId, sourceGroupId } = draggedTab

    // If dropping on the same group, ignore (let tab reordering handle it)
    if (sourceGroupId === targetGroupId) {
      setDraggedTab(null)
      return
    }

    // Move tab between groups
    moveTab(tabId, sourceGroupId, targetGroupId, targetIndex)
    setDraggedTab(null)

    // Focus the target group
    setFocusedGroupId(targetGroupId)
  }

  // Get all tabs for header controls
  const allTabs = getAllTabs()

  // Auto-load or create default conversation when workspace is selected
  useEffect(() => {
    if (!selectedWorkspace) return

    const loadDefaultConversation = async () => {
      const { ipcRenderer } = window.require('electron')

      try {
        // Get all conversations for this workspace
        const result = await ipcRenderer.invoke('conversation:list', selectedWorkspace.id)

        if (result.success && result.conversations && result.conversations.length > 0) {
          // Load the most recently viewed or oldest conversation
          const sortedConversations = [...result.conversations].sort(
            (a, b) => (b.lastViewedAt || b.updatedAt) - (a.lastViewedAt || a.updatedAt)
          )
          const defaultConversation = sortedConversations[0]

          // Create and open tab for default conversation
          const conversationTab = createConversationTab(
            defaultConversation.id,
            selectedWorkspace.id,
            defaultConversation.title,
            selectedWorkspace.name
          )
          openTab(conversationTab, DEFAULT_GROUP_ID)
        } else {
          // No conversations exist, create a new one
          const createResult = await ipcRenderer.invoke('conversation:create', selectedWorkspace.id, {
            workspaceName: selectedWorkspace.name
          })

          if (createResult.success && createResult.conversation) {
            const conversationTab = createConversationTab(
              createResult.conversation.id,
              selectedWorkspace.id,
              createResult.conversation.title,
              selectedWorkspace.name
            )
            openTab(conversationTab, DEFAULT_GROUP_ID)
          }
        }
      } catch (error) {
        console.error('[App] Error loading default conversation:', error)
      }
    }

    loadDefaultConversation()
  }, [selectedWorkspace?.id])

  // Reset state when workspace changes (but not tabs - handled by loadDefaultConversation)
  useEffect(() => {
    setViewMode('chat')
    setFileCursorPosition(null)
    setChatPrefillMessage(null)
    setSessionId(null)
    setCodeSelectionAction(null)
  }, [selectedWorkspace?.id])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    // Quick Open (Cmd+P) - Focus search bar
    'cmd+p': {
      handler: () => searchBarRef.current?.focus(),
      description: 'Quick Open',
      enabled: !!selectedWorkspace,
    },

    // Workspace navigation (Cmd+1 through Cmd+9)
    'cmd+1': { handler: () => workspacesRef.current[0] && handleWorkspaceSelect(workspacesRef.current[0]), description: 'Switch to workspace 1' },
    'cmd+2': { handler: () => workspacesRef.current[1] && handleWorkspaceSelect(workspacesRef.current[1]), description: 'Switch to workspace 2' },
    'cmd+3': { handler: () => workspacesRef.current[2] && handleWorkspaceSelect(workspacesRef.current[2]), description: 'Switch to workspace 3' },
    'cmd+4': { handler: () => workspacesRef.current[3] && handleWorkspaceSelect(workspacesRef.current[3]), description: 'Switch to workspace 4' },
    'cmd+5': { handler: () => workspacesRef.current[4] && handleWorkspaceSelect(workspacesRef.current[4]), description: 'Switch to workspace 5' },
    'cmd+6': { handler: () => workspacesRef.current[5] && handleWorkspaceSelect(workspacesRef.current[5]), description: 'Switch to workspace 6' },
    'cmd+7': { handler: () => workspacesRef.current[6] && handleWorkspaceSelect(workspacesRef.current[6]), description: 'Switch to workspace 7' },
    'cmd+8': { handler: () => workspacesRef.current[7] && handleWorkspaceSelect(workspacesRef.current[7]), description: 'Switch to workspace 8' },
    'cmd+9': { handler: () => workspacesRef.current[8] && handleWorkspaceSelect(workspacesRef.current[8]), description: 'Switch to workspace 9' },

    // New Workspace (Cmd+N)
    'cmd+n': {
      handler: handleCreateWorkspace,
      description: 'New workspace',
    },

    // Close active tab (Cmd+W)
    'cmd+w': {
      handler: handleCloseActiveTab,
      description: 'Close active tab',
      enabled: primaryGroup.tabs.length > 0,
    },

    // Move active tab left (Cmd+Shift+[)
    'cmd+shift+[': {
      handler: () => handleMoveActiveTab('left'),
      description: 'Move tab left',
      enabled: primaryGroup.tabs.length > 0,
    },

    // Move active tab right (Cmd+Shift+])
    'cmd+shift+]': {
      handler: () => handleMoveActiveTab('right'),
      description: 'Move tab right',
      enabled: primaryGroup.tabs.length > 0,
    },

    // Close current workspace (Cmd+Shift+W)
    'cmd+shift+w': {
      handler: () => handleWorkspaceSelect(null),
      description: 'Close workspace',
      enabled: !!selectedWorkspace,
    },

    // Open Settings (Cmd+,)
    'cmd+,': {
      handler: handleOpenSettings,
      description: 'Open settings',
    },

    // Commit dialog (Cmd+Enter when workspace is selected)
    'cmd+enter': {
      handler: () => setShowCommitDialog(true),
      description: 'Open commit dialog',
      enabled: !!selectedWorkspace,
    },

    // Close dialogs with Escape
    'escape': {
      handler: () => {
        if (showCommitDialog) {
          setShowCommitDialog(false)
        }
      },
      description: 'Close dialog',
      enabled: showCommitDialog,
    },
  })

  return (
    <SettingsProvider>
      <TerminalProvider>
        <AgentProvider>
          <RepositoryProvider value={currentRepository} onChange={setCurrentRepository}>
            <ProjectPathContext.Provider value={{ projectPath, isLoading: isLoadingPath }}>
          <div
          className="h-screen overflow-hidden backdrop-blur-xl flex"
          style={{
            backgroundColor: 'var(--window-glass)'
          }}
        >
          <SidebarProvider>
        <AppSidebar
          selectedWorkspaceId={selectedWorkspace?.id || null}
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={handleWorkspaceSelect}
          selectedFile={null}
          onFileSelect={handleFileSelect}
          onWorkspacesLoaded={setWorkspacesForShortcuts}
          onRepositoryChange={setCurrentRepository}
        />

      <SidebarInset className="flex-1 flex flex-col overflow-hidden bg-card">
        {/* Header - Fixed Height */}
        <div className="shrink-0">
          {/* Compact Warning Banner */}
          <CompactBanner
            workspaceId={selectedWorkspace?.id}
            workspacePath={selectedWorkspace?.path}
            context={workspaceContext}
          />

          {/* Main Header with Breadcrumb */}
          <MainHeader
            selectedWorkspace={selectedWorkspace}
            repositoryName={repositoryName}
            viewMode={viewMode}
            setViewMode={setViewMode}
            allTabs={allTabs}
            toggleRightSidebar={toggleRightSidebar}
            isRightSidebarOpen={isRightSidebarOpen}
            onFileSelect={handleFileSelect}
            onWorkspaceSelect={handleWorkspaceSelectById}
            activeFilePath={activeFilePath}
            searchBarRef={searchBarRef}
          />
        </div>

        {/* Main Content Area - Flex 1 */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col overflow-hidden">
            {selectedWorkspace ? (
              <>
                {viewMode === 'split' ? (
                  /* Split View: Two independent editor groups */
                  <ResizablePanelGroup direction="horizontal" className="h-full">
                    <ResizablePanel defaultSize={50} minSize={30}>
                      <EditorGroupPanel
                        group={primaryGroup}
                        currentWorkspaceId={selectedWorkspace?.id}
                        isFocused={focusedGroupId === DEFAULT_GROUP_ID}
                        onFocus={() => setFocusedGroupId(DEFAULT_GROUP_ID)}
                        onTabClick={(tabId) => handleTabClick(tabId, DEFAULT_GROUP_ID)}
                        onTabClose={(tabId) => handleTabClose(tabId, DEFAULT_GROUP_ID)}
                        onTabDragStart={(tabId, sourceGroupId) => handleTabDragStart(tabId, sourceGroupId)}
                        onTabDragEnd={handleTabDragEnd}
                        onTabDrop={(tabId, targetIndex) => handleTabDrop(DEFAULT_GROUP_ID, targetIndex)}
                        onCreateConversation={handleCreateConversation}
                        renderConversation={renderChatPanel}
                        renderFile={renderEditorPanel}
                        renderSettings={renderSettingsPanel}
                      />
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={50} minSize={30}>
                      <EditorGroupPanel
                        group={secondaryGroup}
                        currentWorkspaceId={selectedWorkspace?.id}
                        isFocused={focusedGroupId === SECONDARY_GROUP_ID}
                        onFocus={() => setFocusedGroupId(SECONDARY_GROUP_ID)}
                        onTabClick={(tabId) => handleTabClick(tabId, SECONDARY_GROUP_ID)}
                        onTabClose={(tabId) => handleTabClose(tabId, SECONDARY_GROUP_ID)}
                        onTabDragStart={(tabId, sourceGroupId) => handleTabDragStart(tabId, sourceGroupId)}
                        onTabDragEnd={handleTabDragEnd}
                        onTabDrop={(tabId, targetIndex) => handleTabDrop(SECONDARY_GROUP_ID, targetIndex)}
                        onCreateConversation={handleCreateConversation}
                        renderConversation={renderChatPanel}
                        renderFile={renderEditorPanel}
                        renderSettings={renderSettingsPanel}
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : (
                  /* Single View: Show primary group with tabs */
                  <EditorGroupPanel
                    group={primaryGroup}
                    currentWorkspaceId={selectedWorkspace?.id}
                    isFocused={true}
                    onFocus={() => setFocusedGroupId(DEFAULT_GROUP_ID)}
                    onTabClick={(tabId) => handleTabClick(tabId, DEFAULT_GROUP_ID)}
                    onTabClose={(tabId) => handleTabClose(tabId, DEFAULT_GROUP_ID)}
                    onCreateConversation={handleCreateConversation}
                    renderConversation={renderChatPanel}
                    renderFile={renderEditorPanel}
                    renderSettings={renderSettingsPanel}
                  />
                )}

                {/* Commit Dialog */}
                {showCommitDialog && (
                  <CommitDialog
                    workspace={selectedWorkspace}
                    onClose={() => setShowCommitDialog(false)}
                    onSuccess={() => {
                      setShowCommitDialog(false);
                      // Optionally refresh workspace list or show success message
                    }}
                    onRequestDirectEdit={(message) => {
                      setShowCommitDialog(false);
                      setChatPrefillMessage(message);
                    }}
                  />
                )}
              </>
            ) : (
              <WorkspaceEmptyState
                onSelectWorkspace={handleWorkspaceSelect}
                onCreateWorkspace={handleCreateWorkspace}
              />
            )}
          </div>
        </div>
      </SidebarInset>

      {/* Right Sidebar - Same structure as left sidebar */}
      {isRightSidebarOpen && (
        <Sidebar side="right" variant="inset" collapsible="none" className="w-[400px]">
          <TodoPanel
            conversationId={activeConversationId}
            workspace={selectedWorkspace}
            onCommit={() => setShowCommitDialog(true)}
            onFileSelect={handleFileSelect}
            onOpenSettings={handleOpenSettings}
          />
        </Sidebar>
      )}
      </SidebarProvider>

      {/* Compact Urgent Modal */}
      <CompactUrgentModal
        workspaceId={selectedWorkspace?.id}
        workspacePath={selectedWorkspace?.path}
        context={workspaceContext}
      />

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: 'var(--radius-lg)',
          },
        }}
      />

      {/* Conversation Delete Confirmation Dialog */}
      <AlertDialog
        open={pendingDeleteConversation !== null}
        onOpenChange={(open) => !open && setPendingDeleteConversation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </div>
            </ProjectPathContext.Provider>
          </RepositoryProvider>
        </AgentProvider>
      </TerminalProvider>
    </SettingsProvider>
  )
}

export default App
