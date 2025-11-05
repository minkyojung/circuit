import { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react'
import { CommitDialog } from "@/components/workspace/CommitDialog"
import { CommandPalette } from "@/components/CommandPalette"
import { AppSidebar } from "@/components/AppSidebar"
import { TodoPanel } from "@/components/TodoPanel"
import { GitTestPanel } from "@/components/git/GitTestPanel"
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState"
import { ChatPanel, EditorPanel } from "@/components/workspace/WorkspaceChatEditor"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Workspace } from "@/types/workspace"
import { PanelLeft, PanelRight, FolderGit2, Columns2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readCircuitConfig, logCircuitStatus } from '@/core/config-reader'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { TerminalProvider } from '@/contexts/TerminalContext'
import { AgentProvider } from '@/contexts/AgentContext'
import { CompactBanner } from '@/components/CompactBanner'
import { CompactUrgentModal } from '@/components/CompactUrgentModal'
import { Toaster } from 'sonner'
import { FEATURES } from '@/config/features'
import { useEditorGroups } from '@/hooks/useEditorGroups'
import { createConversationTab, createFileTab } from '@/types/editor'
import type { Tab } from '@/types/editor'
import { getFileName } from '@/lib/fileUtils'
import { EditorGroupPanel } from '@/components/editor'
import { DEFAULT_GROUP_ID, SECONDARY_GROUP_ID } from '@/types/editor'
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
  isRightSidebarOpen
}: {
  selectedWorkspace: Workspace | null
  repositoryName: string
  viewMode: 'chat' | 'editor' | 'split'
  setViewMode: (mode: 'chat' | 'editor' | 'split') => void
  allTabs: Tab[]
  toggleRightSidebar: () => void
  isRightSidebarOpen: boolean
}) {
  const { state: sidebarState } = useSidebar()

  return (
    <header
      className={cn(
        "flex h-[36px] shrink-0 items-center gap-2 border-b border-border pr-3",
        sidebarState === 'collapsed' ? 'pl-[72px]' : 'pl-3'
      )}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left side - Sidebar toggle + Workspace/Repository name */}
      <div
        className="flex items-center gap-2 flex-1"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />

        {selectedWorkspace ? (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">
                  {selectedWorkspace.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium text-muted-foreground">
                  {repositoryName}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>

      {/* Right side - Controls */}
      {selectedWorkspace && (
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          {/* Split View Toggle */}
          {allTabs.length > 0 && (
            <>
              <button
                onClick={() => setViewMode(viewMode === 'split' ? 'chat' : 'split')}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  viewMode === 'split'
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
                title={viewMode === 'split' ? 'Single View' : 'Split View'}
              >
                <Columns2 size={16} />
              </button>
              <Separator orientation="vertical" className="h-4" />
            </>
          )}

          {/* Toggle Right Panel */}
          <button
            onClick={toggleRightSidebar}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              isRightSidebarOpen
                ? 'text-foreground hover:bg-sidebar-hover'
                : 'text-muted-foreground hover:bg-sidebar-hover hover:text-foreground'
            )}
            title="Toggle right panel"
          >
            <PanelRight size={16} />
          </button>
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
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false)
  const [chatPrefillMessage, setChatPrefillMessage] = useState<string | null>(null)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('circuit-right-sidebar-state')
    return saved !== null ? JSON.parse(saved) : true // 기본값: 열림
  })
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('circuit-right-sidebar-width')
    return saved ? parseInt(saved) : 320 // 기본값: 320px (20rem)
  })
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const [currentRepository, setCurrentRepository] = useState<any>(null)

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
        onConversationChange={(convId) => {
          // Update the conversation tab when conversation changes
          if (convId && convId !== conversationId) {
            const newTab = createConversationTab(convId, workspaceId, undefined, selectedWorkspace?.name)
            openTab(newTab)
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
        openFiles={openFilePaths}
        selectedFile={filePath}
        onCloseFile={(path) => {
          // Find and close the file tab
          const result = findTab(`file-${path}`)
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

  // Handle right sidebar resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      const clampedWidth = Math.max(240, Math.min(600, newWidth)) // 15rem ~ 37.5rem
      setRightSidebarWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      localStorage.setItem('circuit-right-sidebar-width', String(rightSidebarWidth))
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, rightSidebarWidth])

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
  const handleFileSelect = (filePath: string, lineStart?: number, lineEnd?: number) => {
    // Use ref to get latest focusedGroupId (avoid stale closure)
    const currentFocusedGroup = focusedGroupIdRef.current

    // Create or activate file tab
    const tab = createFileTab(filePath, getFileName(filePath))

    // Open in currently focused group (using ref for latest value)
    openTab(tab, currentFocusedGroup)

    // Store line selection for Monaco to use
    if (lineStart) {
      setFileCursorPosition({
        filePath,
        lineStart,
        lineEnd: lineEnd || lineStart
      })
    } else {
      setFileCursorPosition(null)
    }

    // Switch to split view when opening a file (if in chat mode)
    if (viewMode === 'chat') {
      setViewMode('split')
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

  // Handle tab close (works for both files and conversations)
  const handleTabClose = (tabId: string, groupId: string) => {
    console.log('[App] Closing tab:', tabId, 'from group:', groupId)
    closeTab(tabId, groupId)
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
          const createResult = await ipcRenderer.invoke('conversation:create', selectedWorkspace.id)

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
    // Command Palette (Cmd+K)
    'cmd+k': {
      handler: () => setShowCommandPalette(true),
      description: 'Open command palette',
    },

    // Workspace navigation (Cmd+1 through Cmd+9)
    'cmd+1': { handler: () => workspacesRef.current[0] && setSelectedWorkspace(workspacesRef.current[0]), description: 'Switch to workspace 1' },
    'cmd+2': { handler: () => workspacesRef.current[1] && setSelectedWorkspace(workspacesRef.current[1]), description: 'Switch to workspace 2' },
    'cmd+3': { handler: () => workspacesRef.current[2] && setSelectedWorkspace(workspacesRef.current[2]), description: 'Switch to workspace 3' },
    'cmd+4': { handler: () => workspacesRef.current[3] && setSelectedWorkspace(workspacesRef.current[3]), description: 'Switch to workspace 4' },
    'cmd+5': { handler: () => workspacesRef.current[4] && setSelectedWorkspace(workspacesRef.current[4]), description: 'Switch to workspace 5' },
    'cmd+6': { handler: () => workspacesRef.current[5] && setSelectedWorkspace(workspacesRef.current[5]), description: 'Switch to workspace 6' },
    'cmd+7': { handler: () => workspacesRef.current[6] && setSelectedWorkspace(workspacesRef.current[6]), description: 'Switch to workspace 7' },
    'cmd+8': { handler: () => workspacesRef.current[7] && setSelectedWorkspace(workspacesRef.current[7]), description: 'Switch to workspace 8' },
    'cmd+9': { handler: () => workspacesRef.current[8] && setSelectedWorkspace(workspacesRef.current[8]), description: 'Switch to workspace 9' },

    // New Workspace (Cmd+N)
    'cmd+n': {
      handler: handleCreateWorkspace,
      description: 'New workspace',
    },

    // Close current workspace (Cmd+W)
    'cmd+w': {
      handler: () => setSelectedWorkspace(null),
      description: 'Close workspace',
      enabled: !!selectedWorkspace,
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
        if (showCommandPalette) {
          setShowCommandPalette(false)
        } else if (showCommitDialog) {
          setShowCommitDialog(false)
        }
      },
      description: 'Close dialog',
      enabled: showCommandPalette || showCommitDialog,
    },
  })

  return (
    <SettingsProvider>
      <TerminalProvider>
        <AgentProvider>
          <ProjectPathContext.Provider value={{ projectPath, isLoading: isLoadingPath }}>
          <div
          className="h-screen overflow-hidden backdrop-blur-xl flex"
          style={{
            backgroundColor: 'var(--window-glass)'
          }}
        >
          <SidebarProvider className="flex-1">
        <AppSidebar
          selectedWorkspaceId={selectedWorkspace?.id || null}
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={setSelectedWorkspace}
          selectedFile={null}
          onFileSelect={handleFileSelect}
          onWorkspacesLoaded={setWorkspacesForShortcuts}
          onRepositoryChange={setCurrentRepository}
        />
        <SidebarInset className={cn(
          "bg-card transition-[border-radius] duration-300",
          isRightSidebarOpen && "rounded-r-xl"
        )}>
          {/* Compact Warning Banner */}
          <CompactBanner
            workspaceId={selectedWorkspace?.id}
            workspacePath={selectedWorkspace?.path}
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
          />

          {/* Main Content Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {selectedWorkspace ? (
              <>
                {viewMode === 'split' ? (
                  /* Split View: Two independent editor groups */
                  <ResizablePanelGroup direction="horizontal" className="h-full">
                    <ResizablePanel defaultSize={50} minSize={30}>
                      <EditorGroupPanel
                        group={primaryGroup}
                        isFocused={focusedGroupId === DEFAULT_GROUP_ID}
                        onFocus={() => setFocusedGroupId(DEFAULT_GROUP_ID)}
                        onTabClick={(tabId) => {
                          setFocusedGroupId(DEFAULT_GROUP_ID)
                          activateTab(tabId, DEFAULT_GROUP_ID)
                        }}
                        onTabClose={(tabId) => closeTab(tabId, DEFAULT_GROUP_ID)}
                        onTabDragStart={(tabId, sourceGroupId) => handleTabDragStart(tabId, sourceGroupId)}
                        onTabDragEnd={handleTabDragEnd}
                        onTabDrop={(tabId, targetIndex) => handleTabDrop(DEFAULT_GROUP_ID, targetIndex)}
                        renderConversation={renderChatPanel}
                        renderFile={renderEditorPanel}
                      />
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={50} minSize={30}>
                      <EditorGroupPanel
                        group={secondaryGroup}
                        isFocused={focusedGroupId === SECONDARY_GROUP_ID}
                        onFocus={() => setFocusedGroupId(SECONDARY_GROUP_ID)}
                        onTabClick={(tabId) => {
                          setFocusedGroupId(SECONDARY_GROUP_ID)
                          activateTab(tabId, SECONDARY_GROUP_ID)
                        }}
                        onTabClose={(tabId) => closeTab(tabId, SECONDARY_GROUP_ID)}
                        onTabDragStart={(tabId, sourceGroupId) => handleTabDragStart(tabId, sourceGroupId)}
                        onTabDragEnd={handleTabDragEnd}
                        onTabDrop={(tabId, targetIndex) => handleTabDrop(SECONDARY_GROUP_ID, targetIndex)}
                        renderConversation={renderChatPanel}
                        renderFile={renderEditorPanel}
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : (
                  /* Single View: Show primary group with tabs */
                  <EditorGroupPanel
                    group={primaryGroup}
                    isFocused={true}
                    onFocus={() => setFocusedGroupId(DEFAULT_GROUP_ID)}
                    onTabClick={(tabId) => {
                      setFocusedGroupId(DEFAULT_GROUP_ID)
                      activateTab(tabId, DEFAULT_GROUP_ID)
                    }}
                    onTabClose={(tabId) => closeTab(tabId, DEFAULT_GROUP_ID)}
                    renderConversation={renderChatPanel}
                    renderFile={renderEditorPanel}
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
                onSelectWorkspace={setSelectedWorkspace}
                onCreateWorkspace={handleCreateWorkspace}
              />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Resize Handle - Overlapping main area border */}
      {isRightSidebarOpen && (
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            "h-full w-1 -ml-1 cursor-col-resize hover:bg-accent transition-colors z-50 flex-shrink-0",
            isResizing && "bg-accent"
          )}
        />
      )}

      {/* Right Sidebar - Todo Panel */}
      <div
        className={cn(
          "h-full overflow-hidden",
          isRightSidebarOpen ? "" : "w-0"
        )}
        style={{
          width: isRightSidebarOpen ? `${rightSidebarWidth}px` : 0,
          transition: isResizing ? 'none' : 'width 0.3s ease-in-out'
        }}
      >
        <TodoPanel
          conversationId={activeConversationId}
          workspace={selectedWorkspace}
          onCommit={() => setShowCommitDialog(true)}
        />
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
        workspaces={workspacesRef.current}
        onSelectWorkspace={setSelectedWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
      />

      {/* Compact Urgent Modal */}
      <CompactUrgentModal
        workspaceId={selectedWorkspace?.id}
        workspacePath={selectedWorkspace?.path}
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
        </div>
        </ProjectPathContext.Provider>
        </AgentProvider>
      </TerminalProvider>
    </SettingsProvider>
  )
}

export default App
