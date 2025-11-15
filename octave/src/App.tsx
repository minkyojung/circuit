import { useState, useEffect, createContext, useContext, useMemo, useRef, useCallback } from 'react'
import { CommitDialog } from "@/components/workspace/CommitDialog"
import { AppSidebar } from "@/components/AppSidebar"
import { TodoPanel } from "@/components/TodoPanel"
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState"
import { ChatPanel, EditorPanel } from "@/components/workspace/WorkspaceChatEditor"
import { ChatPanelRenderer } from "@/components/panels/ChatPanelRenderer"
import { EditorPanelRenderer } from "@/components/panels/EditorPanelRenderer"
import { SettingsPanelRenderer } from "@/components/panels/SettingsPanelRenderer"
import { ModifiedFileRenderer } from "@/components/panels/ModifiedFileRenderer"
import { SimpleBrowserTab } from "@/components/browser/SimpleBrowserTab"
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
import { readOctaveConfig, logOctaveStatus } from '@/core/config-reader'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAppKeyboardShortcuts } from '@/hooks/useAppKeyboardShortcuts'
import { useConversationManagement } from '@/hooks/useConversationManagement'
import { useFileNavigation } from '@/hooks/useFileNavigation'
import { useWorkspaceNavigation } from '@/hooks/useWorkspaceNavigation'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { TerminalProvider } from '@/contexts/TerminalContext'
import { AgentProvider } from '@/contexts/AgentContext'
import { RepositoryProvider } from '@/contexts/RepositoryContext'
import { CompactBanner } from '@/components/CompactBanner'
import { UnifiedOnboardingDialog } from '@/components/onboarding/UnifiedOnboardingDialog'
import { CompactUrgentModal } from '@/components/CompactUrgentModal'
import { UpdateNotification } from '@/components/UpdateNotification'
import { Toaster, toast } from 'sonner'
import { FEATURES } from '@/config/features'
import { useEditorGroups } from '@/hooks/useEditorGroups'
import { useWorkspaceContext } from '@/hooks/useWorkspaceContext'
import { createConversationTab, createFileTab, createModifiedFileTab, createSettingsTab, createBrowserTab } from '@/types/editor'
import type { Tab } from '@/types/editor'
import { getFileName } from '@/lib/fileUtils'
import { EditorGroupPanel } from '@/components/editor'
import { DEFAULT_GROUP_ID, SECONDARY_GROUP_ID } from '@/types/editor'
import { PathResolver } from '@/lib/pathResolver'
import { SettingsPanel } from '@/components/SettingsPanel'
import { isOnboardingComplete, migrateAllLocalStorageKeys } from '@/lib/onboarding'
import './App.css'

const ipcRenderer = window.electron.ipcRenderer;

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
  // 🔄 Run localStorage migration on app startup (once)
  useEffect(() => {
    migrateAllLocalStorageKeys();
  }, []);

  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => !isOnboardingComplete())
  const [projectPath, setProjectPath] = useState<string>('')
  const [isLoadingPath, setIsLoadingPath] = useState<boolean>(true)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [showCommitDialog, setShowCommitDialog] = useState<boolean>(false)
  const [chatPrefillMessage, setChatPrefillMessage] = useState<string | null>(null)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('octave-right-sidebar-state')
    return saved !== null ? JSON.parse(saved) : false // 기본값: 닫힘 (Content Area를 위해)
  })
  const [currentRepository, setCurrentRepository] = useState<any>(null)

  // Path resolver for consistent file path normalization
  const [pathResolver, setPathResolver] = useState<PathResolver | null>(null)

  // Ref for search bar (to trigger focus from keyboard shortcut)
  const searchBarRef = useRef<HTMLInputElement>(null)

  // Session ID for chat (one per workspace for now)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Active conversation ID (selected from left sidebar)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  // Onboarding is now handled by unified dialog (no separate checks needed)

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

  // Conversation management (extracted to custom hook)
  const {
    handleConversationSelect,
    handleCreateConversation,
    confirmDeleteConversation,
    pendingDeleteConversation,
    setPendingDeleteConversation,
  } = useConversationManagement({
    selectedWorkspace,
    setActiveConversationId,
    closeTab,
  })

  // ============================================================================
  // Browser tab creation
  // ============================================================================
  const handleCreateBrowser = useCallback(() => {
    if (!selectedWorkspace) {
      console.warn('[App] Cannot create browser: no workspace selected')
      return
    }

    // Create browser tab with default URL
    // User can change URL in the browser's address bar
    const url = 'http://localhost:3000'
    const browserTab = createBrowserTab(url, selectedWorkspace.id)
    openTab(browserTab, focusedGroupId)
    console.log('[App] Browser tab created:', url)
  }, [selectedWorkspace, openTab, focusedGroupId])

  // ============================================================================
  // Auto-create modified-file tabs when AI edits files
  // ============================================================================
  useEffect(() => {
    if (!activeConversationId || !selectedWorkspace) return

    const handleMessageAdded = async () => {
      try {
        // Fetch latest messages
        const result = await ipcRenderer.invoke('message:list', activeConversationId)
        if (!result.success || !result.messages) return

        // Find the last assistant message with file-summary block
        const messages = result.messages.reverse() // Most recent first
        let latestFileSummary: any = null

        for (const message of messages) {
          if (message.role !== 'assistant' || !message.blocks) continue

          const fileSummaryBlock = message.blocks.find((b: any) => b.type === 'file-summary')
          if (fileSummaryBlock && fileSummaryBlock.metadata?.files) {
            latestFileSummary = fileSummaryBlock.metadata
            break
          }
        }

        if (!latestFileSummary || !latestFileSummary.files) return

        // Create modified-file tabs for each file
        console.log('[App] Creating modified-file tabs for', latestFileSummary.files.length, 'files')
        for (const fileChange of latestFileSummary.files) {
          const tab = createModifiedFileTab(
            fileChange.filePath,
            selectedWorkspace.id,
            activeConversationId,
            fileChange.changeType || 'modified',
            fileChange.additions || 0,
            fileChange.deletions || 0,
            fileChange.diffLines,
            fileChange.oldContent,
            fileChange.newContent
          )

          // Open tab in focused group
          openTab(tab, focusedGroupId)
        }
      } catch (error) {
        console.error('[App] Error creating modified-file tabs:', error)
      }
    }

    // Listen for new messages
    ipcRenderer.on(`conversation:${activeConversationId}:message-added`, handleMessageAdded)

    // Also run once on conversation change
    handleMessageAdded()

    return () => {
      ipcRenderer.removeListener(`conversation:${activeConversationId}:message-added`, handleMessageAdded)
    }
  }, [activeConversationId, selectedWorkspace, openTab, focusedGroupId])

  // ============================================================================
  // TEST: Auto-create browser tab for quick validation
  // DISABLED: Only create browser tab when explicitly requested by user
  // ============================================================================
  // useEffect(() => {
  //   if (!selectedWorkspace) return
  //   // Check if a browser tab already exists
  //   const allTabs = getAllTabs()
  //   const hasBrowserTab = allTabs.some(tab => tab.type === 'browser')
  //   if (!hasBrowserTab) {
  //     // Create a test browser tab pointing to localhost:3000
  //     const browserTab = createBrowserTab('http://localhost:3000', selectedWorkspace.id)
  //     openTab(browserTab, focusedGroupId)
  //     console.log('[App] Test browser tab created: localhost:3000')
  //   }
  // }, [selectedWorkspace, openTab, focusedGroupId, getAllTabs])

  // File navigation (extracted to custom hook)
  const {
    handleFileSelect,
    handleUnsavedChange,
    fileCursorPosition,
  } = useFileNavigation({
    pathResolver,
    selectedWorkspace,
    openTab,
    findTab,
    updateTab,
    focusedGroupIdRef,
  })

  // Workspace navigation (extracted to custom hook)
  const {
    handleWorkspaceSelect,
    handleWorkspaceSelectById,
    workspacesRef,
    setWorkspacesForShortcuts: originalSetWorkspacesForShortcuts,
  } = useWorkspaceNavigation({
    setSelectedWorkspace,
    getAllTabs,
    findTab,
    activateTab,
    openTab,
  })

  // Wrap setWorkspacesForShortcuts to validate selectedWorkspace when workspaces change
  const setWorkspacesForShortcuts = useCallback((workspaces: Workspace[]) => {
    // Update workspaces ref
    originalSetWorkspacesForShortcuts(workspaces)

    // Validate selectedWorkspace against new workspaces list
    if (selectedWorkspace) {
      const isValid = workspaces.some(w => w.id === selectedWorkspace.id)

      if (!isValid) {
        console.log('[App] Selected workspace not found in current repository workspaces, clearing selection:', {
          selectedWorkspaceId: selectedWorkspace.id,
          selectedWorkspaceName: selectedWorkspace.name,
          currentWorkspacesCount: workspaces.length
        })
        setSelectedWorkspace(null)
        setActiveConversationId(null)
      }
    }
  }, [selectedWorkspace, originalSetWorkspacesForShortcuts, setSelectedWorkspace, setActiveConversationId])

  // Note: activeConversationId is now managed as state (see line ~232)
  // No longer extracted from tabs since conversation tabs are removed in Phase 2

  // Get active file path for symbol search
  const activeFilePath = useMemo(() => {
    const activeTab = getActiveTab(DEFAULT_GROUP_ID)
    if (activeTab && activeTab.type === 'file') {
      return activeTab.data.filePath
    }
    return null
  }, [primaryGroup.activeTabId, getActiveTab])

  // Render functions for panels (now using dedicated components)
  const renderChatPanel = (conversationId: string, workspaceId: string) => (
    <ChatPanelRenderer
      conversationId={conversationId}
      workspaceId={workspaceId}
      selectedWorkspace={selectedWorkspace}
      sessionId={sessionId}
      handleFileSelect={handleFileSelect}
      chatPrefillMessage={chatPrefillMessage}
      setChatPrefillMessage={setChatPrefillMessage}
      openTab={openTab}
      codeSelectionAction={codeSelectionAction}
      setCodeSelectionAction={setCodeSelectionAction}
    />
  )

  const renderEditorPanel = (filePath: string) => (
    <EditorPanelRenderer
      filePath={filePath}
      selectedWorkspace={selectedWorkspace}
      sessionId={sessionId}
      getAllTabs={getAllTabs}
      findTab={findTab}
      closeTab={closeTab}
      handleUnsavedChange={handleUnsavedChange}
      fileCursorPosition={fileCursorPosition}
      setCodeSelectionAction={setCodeSelectionAction}
    />
  )

  const renderSettingsPanel = () => (
    <SettingsPanelRenderer selectedWorkspace={selectedWorkspace} />
  )

  const renderModifiedFilePanel = (modifiedFileData: import('@/types/editor').ModifiedFileTabData) => (
    <ModifiedFileRenderer
      modifiedFileData={modifiedFileData}
      workspacePath={selectedWorkspace.path}
    />
  )

  const renderBrowserPanel = (url: string, browserId: string, isActive: boolean) => (
    <SimpleBrowserTab browserId={browserId} url={url} isActive={isActive} />
  )

  // Toggle right sidebar with localStorage persistence
  const toggleRightSidebar = () => {
    setIsRightSidebarOpen(prev => {
      const newState = !prev
      localStorage.setItem('octave-right-sidebar-state', JSON.stringify(newState))
      return newState
    })
  }

  // Create workspace handler for Command Palette
  const handleCreateWorkspace = async () => {
    const ipcRenderer = window.electron.ipcRenderer;
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
        const ipcRenderer = window.electron.ipcRenderer;
        const result = await ipcRenderer.invoke('octave:get-project-path')

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

    const checkOctaveConfig = async () => {
      const config = await readOctaveConfig(projectPath)
      logOctaveStatus(config)
    }

    checkOctaveConfig()
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
    if (!selectedWorkspace) {
      setActiveConversationId(null)
      return
    }

    const loadDefaultConversation = async () => {
      const ipcRenderer = window.electron.ipcRenderer;

      try {
        // Get all conversations for this workspace
        const result = await ipcRenderer.invoke('conversation:list', selectedWorkspace.id)

        if (result.success && result.conversations && result.conversations.length > 0) {
          // Load the most recently viewed or oldest conversation
          const sortedConversations = [...result.conversations].sort(
            (a, b) => (b.lastViewedAt || b.updatedAt) - (a.lastViewedAt || a.updatedAt)
          )
          const defaultConversation = sortedConversations[0]

          // Set active conversation (no tab creation)
          setActiveConversationId(defaultConversation.id)
          console.log('[App] Default conversation loaded:', defaultConversation.id)
        } else {
          // No conversations exist, create a new one
          const createResult = await ipcRenderer.invoke('conversation:create', selectedWorkspace.id, {
            workspaceName: selectedWorkspace.name
          })

          if (createResult.success && createResult.conversation) {
            // Set newly created conversation as active
            setActiveConversationId(createResult.conversation.id)
            console.log('[App] New conversation created and set as active:', createResult.conversation.id)
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
    setChatPrefillMessage(null)
    setSessionId(null)
    setCodeSelectionAction(null)
  }, [selectedWorkspace?.id])

  // Keyboard shortcuts (extracted to custom hook)
  const keyboardShortcuts = useAppKeyboardShortcuts({
    selectedWorkspace,
    primaryGroup,
    searchBarRef,
    showCommitDialog,
    workspacesRef,
    handleCreateWorkspace,
    handleCloseActiveTab,
    handleMoveActiveTab,
    handleWorkspaceSelect,
    handleOpenSettings,
    setShowCommitDialog,
  })
  useKeyboardShortcuts(keyboardShortcuts)

  // Handle unified onboarding completion
  const handleOnboardingComplete = (registeredRepoIds?: string[]) => {
    console.log('[App] Unified onboarding complete')
    console.log('[App] Registered repository IDs:', registeredRepoIds)
    setShowOnboarding(false)

    // Reload to show newly registered repositories
    // This ensures AppSidebar picks up the new repos and switches to them
    if (registeredRepoIds && registeredRepoIds.length > 0) {
      console.log('[App] Reloading to display new repositories...')
      // Small delay to ensure electron-store is updated
      setTimeout(() => {
        window.location.reload()
      }, 500)
    }
  }

  return (
    <>
      {/* Update Notification Banner */}
      <UpdateNotification />

      {/* Unified Onboarding Dialog */}
      <UnifiedOnboardingDialog
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      {/* Main App */}
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
          onSelectConversation={handleConversationSelect}
          activeConversationId={activeConversationId}
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
                  /* Split View: ChatPanel (left 30%) + EditorGroupPanel (right 70%) */
                  <ResizablePanelGroup direction="horizontal" className="h-full">
                    {/* Left: ChatPanel */}
                    <ResizablePanel defaultSize={30} minSize={20}>
                      <div className="h-full flex flex-col overflow-hidden">
                        {activeConversationId ? (
                          renderChatPanel(activeConversationId, selectedWorkspace.id)
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <p>Select a conversation from the sidebar</p>
                          </div>
                        )}
                      </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Right: EditorGroupPanel (File/Modified-file/Settings tabs) */}
                    <ResizablePanel defaultSize={70} minSize={50}>
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
                        onCreateBrowser={handleCreateBrowser}
                        renderFile={renderEditorPanel}
                        renderModifiedFile={renderModifiedFilePanel}
                        renderSettings={renderSettingsPanel}
                        renderBrowser={renderBrowserPanel}
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : (
                  /* Single View: Horizontal split - Chat (left 30%) + EditorGroupPanel (right 70%) */
                  <ResizablePanelGroup direction="horizontal" className="h-full">
                    {/* Left: ChatPanel */}
                    <ResizablePanel defaultSize={30} minSize={20}>
                      <div className="h-full flex flex-col overflow-hidden">
                        {activeConversationId ? (
                          renderChatPanel(activeConversationId, selectedWorkspace.id)
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <p>Select a conversation from the sidebar</p>
                          </div>
                        )}
                      </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Right: EditorGroupPanel (File/Modified-file/Settings tabs) */}
                    <ResizablePanel defaultSize={70} minSize={50}>
                      <EditorGroupPanel
                        group={primaryGroup}
                        currentWorkspaceId={selectedWorkspace?.id}
                        isFocused={focusedGroupId === DEFAULT_GROUP_ID}
                        onFocus={() => setFocusedGroupId(DEFAULT_GROUP_ID)}
                        onTabClick={(tabId) => handleTabClick(tabId, DEFAULT_GROUP_ID)}
                        onTabClose={(tabId) => handleTabClose(tabId, DEFAULT_GROUP_ID)}
                        onCreateBrowser={handleCreateBrowser}
                        renderFile={renderEditorPanel}
                        renderModifiedFile={renderModifiedFilePanel}
                        renderSettings={renderSettingsPanel}
                        renderBrowser={renderBrowserPanel}
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
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
            onRequestDirectEdit={(message) => {
              setChatPrefillMessage(message);
            }}
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
    </>
  )
}

export default App
