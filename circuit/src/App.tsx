import { useState, useEffect, createContext, useContext, useMemo } from 'react'
import { WorkspaceChatEditor } from "@/components/workspace"
import { CommitDialog } from "@/components/workspace/CommitDialog"
import { AppSidebar } from "@/components/AppSidebar"
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
} from "@/components/ui/sidebar"
import type { Workspace } from "@/types/workspace"
import { FolderGit2, GitCommit } from 'lucide-react'
import { readCircuitConfig, logCircuitStatus } from '@/core/config-reader'
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
  const [chatPrefillMessage, setChatPrefillMessage] = useState<string | null>(null)

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

  return (
    <ProjectPathContext.Provider value={{ projectPath, isLoading: isLoadingPath }}>
      <div
        className="min-h-screen backdrop-blur-xl backdrop-saturate-150"
        style={{
          backgroundColor: 'var(--window-glass)'
        }}
      >
        <SidebarProvider>
        <AppSidebar
          selectedWorkspaceId={selectedWorkspace?.id || null}
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={setSelectedWorkspace}
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
        />
        <SidebarInset>
          {/* Main Header with Breadcrumb */}
          <header
            className="flex h-[44px] shrink-0 items-center gap-2 border-b border-border px-4"
            style={{ WebkitAppRegion: 'drag' } as any}
          >
            <div
              className="flex items-center gap-2"
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              {selectedWorkspace ? (
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        onClick={() => setSelectedWorkspace(null)}
                        className="cursor-pointer hover:text-foreground transition-colors"
                      >
                        {repositoryName}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="font-medium">
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
                      <BreadcrumbPage className="font-medium">
                        {repositoryName}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right side - Commit button (when workspace selected) */}
            {selectedWorkspace && (
              <div
                className="flex items-center gap-2"
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                <button
                  onClick={() => setShowCommitDialog(true)}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <GitCommit size={14} />
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
        </SidebarInset>
      </SidebarProvider>
      </div>
    </ProjectPathContext.Provider>
  )
}

export default App
