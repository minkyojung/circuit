import { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react'
import { WorkspaceChatEditor } from "@/components/workspace"
import { CommitDialog } from "@/components/workspace/CommitDialog"
import { CommandPalette } from "@/components/CommandPalette"
import { AppSidebar } from "@/components/AppSidebar"
import { TodoPanel } from "@/components/TodoPanel"
import { GitTestPanel } from "@/components/git/GitTestPanel"
import { WorkspaceEmptyState } from "@/components/workspace/WorkspaceEmptyState"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { UnifiedTabs, type OpenFile } from "@/components/workspace/UnifiedTabs"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Workspace } from "@/types/workspace"
import { PanelLeft, PanelRight, FolderGit2, Columns2, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readCircuitConfig, logCircuitStatus } from '@/core/config-reader'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { TerminalProvider } from '@/contexts/TerminalContext'
import { BlockProvider } from '@/contexts/BlockContext'
import { CompactBanner } from '@/components/CompactBanner'
import { CompactUrgentModal } from '@/components/CompactUrgentModal'
import { Toaster } from 'sonner'
import { FEATURES } from '@/config/features'
import './App.css'

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

function App() {
  const [projectPath, setProjectPath] = useState<string>('')
  const [isLoadingPath, setIsLoadingPath] = useState<boolean>(true)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [currentRepository, setCurrentRepository] = useState<any>(null)

  // File tabs state (lifted from WorkspaceChatEditor)
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [unsavedFiles, setUnsavedFiles] = useState<Set<string>>(new Set())

  // View mode state
  type ViewMode = 'chat' | 'editor' | 'split'
  const [viewMode, setViewMode] = useState<ViewMode>('chat')

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

  // Handle file selection from sidebar
  const handleFileSelect = (filePath: string) => {
    console.log('[App] File selected:', filePath)
    setSelectedFile(filePath)
    setActiveFilePath(filePath)

    // Add to openFiles if not already there
    if (!openFiles.includes(filePath)) {
      setOpenFiles([...openFiles, filePath])
    }
  }

  // Handle file close from unified tabs
  const handleCloseFile = (filePath: string) => {
    setOpenFiles(openFiles.filter(f => f !== filePath))

    // Remove from unsaved files
    setUnsavedFiles(prev => {
      const next = new Set(prev)
      next.delete(filePath)
      return next
    })

    // If closing active file, switch to another file
    if (filePath === activeFilePath) {
      const remainingFiles = openFiles.filter(f => f !== filePath)
      if (remainingFiles.length > 0) {
        setActiveFilePath(remainingFiles[0])
        setSelectedFile(remainingFiles[0])
      } else {
        setActiveFilePath(null)
        setSelectedFile(null)
      }
    }
  }

  // Handle unsaved changes notification from editor
  const handleUnsavedChange = (filePath: string, hasChanges: boolean) => {
    setUnsavedFiles(prev => {
      const next = new Set(prev)
      if (hasChanges) {
        next.add(filePath)
      } else {
        next.delete(filePath)
      }
      return next
    })
  }

  // Auto-switch view mode based on open files
  useEffect(() => {
    if (openFiles.length > 0 && viewMode === 'chat') {
      setViewMode('editor')
    } else if (openFiles.length === 0 && viewMode !== 'chat') {
      setViewMode('chat')
    }
  }, [openFiles.length])

  // Reset selected file, conversation, and file tabs when workspace changes
  useEffect(() => {
    setSelectedFile(null)
    setActiveConversationId(null)
    setOpenFiles([])
    setActiveFilePath(null)
    setUnsavedFiles(new Set())
    setViewMode('chat')
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
      <BlockProvider>
        <TerminalProvider>
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
          selectedFile={selectedFile}
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
          <header
            className="flex h-[44px] shrink-0 items-center gap-2 border-b border-border px-3"
            style={{ WebkitAppRegion: 'drag' } as any}
          >
            <div
              className="grid items-center gap-2 min-w-0"
              style={{
                WebkitAppRegion: 'no-drag',
                gridTemplateColumns: selectedWorkspace && openFiles.length > 0 ? 'auto 1fr' : '1fr'
              } as any}
            >
              {/* Column 1: View mode toggle button (auto width) */}
              {selectedWorkspace && openFiles.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  {viewMode === 'editor' && (
                    <button
                      onClick={() => setViewMode('split')}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                        "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      )}
                      title="Show Chat"
                    >
                      <Columns2 size={16} />
                    </button>
                  )}
                  {viewMode === 'split' && (
                    <button
                      onClick={() => setViewMode('editor')}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                        "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      )}
                      title="Editor Only"
                    >
                      <Maximize2 size={16} />
                    </button>
                  )}
                  <Separator orientation="vertical" className="mr-2 h-4" />
                </div>
              )}

              {/* Column 2: Tabs container (flexible with overflow) */}
              <div className="min-w-0 overflow-x-auto">
                {selectedWorkspace ? (
                  <UnifiedTabs
                    workspaceId={selectedWorkspace.id}
                    workspaceName={selectedWorkspace.name}
                    activeConversationId={activeConversationId}
                    onConversationChange={setActiveConversationId}
                    openFiles={openFiles.map(path => ({
                      path,
                      unsavedChanges: unsavedFiles.has(path)
                    }))}
                    activeFilePath={activeFilePath}
                    onFileChange={setActiveFilePath}
                    onCloseFile={handleCloseFile}
                  />
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
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right side - Toggle plans button (when workspace selected) */}
            {selectedWorkspace && (
              <div
                className="flex items-center gap-2"
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
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

          {/* Main Content Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {selectedWorkspace ? (
              <>
                <WorkspaceChatEditor
                  workspace={selectedWorkspace}
                  selectedFile={selectedFile}
                  prefillMessage={chatPrefillMessage}
                  onPrefillCleared={() => setChatPrefillMessage(null)}
                  conversationId={activeConversationId}
                  onConversationChange={setActiveConversationId}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  openFiles={openFiles}
                  onUnsavedChange={handleUnsavedChange}
                />

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
        </TerminalProvider>
      </BlockProvider>
    </SettingsProvider>
  )
}

export default App
