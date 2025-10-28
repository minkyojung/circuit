import { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react'
import { WorkspaceChatEditor } from "@/components/workspace"
import { CommitDialog } from "@/components/workspace/CommitDialog"
import { CommandPalette } from "@/components/CommandPalette"
import { AppSidebar } from "@/components/AppSidebar"
import { BlockNavigator } from "@/components/BlockNavigator"
import { StatusBar } from "@/components/statusbar/StatusBar"
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
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Workspace } from "@/types/workspace"
import { FolderGit2, PanelLeft, PanelRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readCircuitConfig, logCircuitStatus } from '@/core/config-reader'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Toaster } from 'sonner'
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

// Custom sidebar toggle button component
function LeftSidebarToggle() {
  const { state, toggleSidebar } = useSidebar()

  return (
    <button
      onClick={toggleSidebar}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        state === "expanded"
          ? "text-foreground hover:bg-sidebar-hover"
          : "text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"
      )}
      title={state === "expanded" ? "Collapse sidebar" : "Expand sidebar"}
    >
      <PanelLeft size={16} />
    </button>
  )
}

function App() {
  const [projectPath, setProjectPath] = useState<string>('')
  const [isLoadingPath, setIsLoadingPath] = useState<boolean>(true)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showCommitDialog, setShowCommitDialog] = useState<boolean>(false)
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false)
  const [chatPrefillMessage, setChatPrefillMessage] = useState<string | null>(null)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  // Workspace navigation refs (for keyboard shortcuts)
  const workspacesRef = useRef<Workspace[]>([])
  const setWorkspacesForShortcuts = (workspaces: Workspace[]) => {
    workspacesRef.current = workspaces
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

  // Extract repository name from project path
  const repositoryName = useMemo(() => {
    return projectPath.split('/').filter(Boolean).pop() || 'Unknown Repository'
  }, [projectPath])

  // Handle file selection from sidebar
  const handleFileSelect = (filePath: string) => {
    console.log('[App] File selected:', filePath)
    setSelectedFile(filePath)
  }

  // Reset selected file when workspace changes
  useEffect(() => {
    setSelectedFile(null)
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
        />
        <SidebarInset className={cn(
          "bg-card transition-[border-radius] duration-300",
          isRightSidebarOpen && "rounded-r-xl"
        )}>
          {/* Main Header with Breadcrumb */}
          <header
            className="flex h-[44px] shrink-0 items-center gap-2 border-b border-border px-4"
            style={{ WebkitAppRegion: 'drag' } as any}
          >
            <div
              className="flex items-center gap-2"
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              <LeftSidebarToggle />
              <Separator orientation="vertical" className="mr-2 h-4" />
              {selectedWorkspace ? (
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        onClick={() => setSelectedWorkspace(null)}
                        className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {repositoryName}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="font-medium text-muted-foreground">
                        {selectedWorkspace.name}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-muted-foreground">
                        {selectedWorkspace.branch}
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

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right side - Blocks and Commit buttons (when workspace selected) */}
            {selectedWorkspace && (
              <div
                className="flex items-center gap-2"
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                <button
                  onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    isRightSidebarOpen
                      ? 'text-foreground hover:bg-sidebar-hover'
                      : 'text-muted-foreground hover:bg-sidebar-hover hover:text-foreground'
                  )}
                  title="Toggle blocks"
                >
                  <PanelRight size={16} />
                </button>
                <button
                  onClick={() => setShowCommitDialog(true)}
                  className="h-9 px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-md transition-colors flex items-center"
                >
                  Commit & PR
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
                  onConversationChange={setActiveConversationId}
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
              <div className="flex flex-1 items-center justify-center text-center p-8">
                <div>
                  <FolderGit2 size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-semibold text-foreground mb-2">No Workspace Selected</h2>
                  <p className="text-sm text-muted-foreground">
                    Select a workspace from the sidebar to start coding
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Status Bar - Bottom */}
          <StatusBar selectedWorkspace={selectedWorkspace} />
        </SidebarInset>
      </SidebarProvider>

      {/* Right Sidebar - Block Navigator */}
      <div
        className={cn(
          "h-full transition-all duration-300 ease-in-out overflow-hidden",
          isRightSidebarOpen ? "w-[17rem]" : "w-0"
        )}
      >
        <BlockNavigator
          isOpen={isRightSidebarOpen}
          onClose={() => setIsRightSidebarOpen(false)}
          conversationId={activeConversationId}
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
  )
}

export default App
