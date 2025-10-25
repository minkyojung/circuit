import { useState, useEffect, createContext, useContext } from 'react'
import { WorkspaceManager, WorkspaceChatEditor } from "@/components/workspace"
import { CommitDialog } from "@/components/workspace/CommitDialog"
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


  return (
    <ProjectPathContext.Provider value={{ projectPath, isLoading: isLoadingPath }}>
      <div className="h-screen flex bg-gradient-to-br from-[#0f0d0c] to-[#1a1412]">
      {/* Sidebar */}
      <aside className="w-[200px] glass-sidebar flex flex-col">
        {/* Sidebar Top - Traffic Lights Area (Fully Draggable) */}
        <div
          className="h-[44px] flex items-center px-4"
          style={{ WebkitAppRegion: 'drag' } as any}
        />

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-auto py-3 px-2">
          {/* Workspace */}
          <div className="px-2 py-1.5 flex items-center gap-2.5 text-xs bg-[var(--circuit-orange)]/25 text-[var(--circuit-orange)] font-medium rounded">
            <FolderGit2 className="h-4 w-4" />
            <span className="flex-1 text-left">Workspace</span>
          </div>
        </nav>

        {/* Bottom Status Bar */}
        <div className="p-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--circuit-success)]" />
            <span>Ready</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Main Header (Empty spaces draggable, interactive elements not) */}
        <header
          className="h-[44px] bg-transparent flex items-center px-4 gap-4"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          {/* Left side - could add branch selector or other controls */}
          <div
            className="flex items-center gap-2"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            {/* Placeholder for future controls */}
          </div>

          {/* Center - Empty space for dragging */}
          <div className="flex-1" />

          {/* Right side - could add buttons */}
          <div
            className="flex items-center gap-2"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            {/* Placeholder for future buttons */}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-8">
          <div className="h-full">
            {selectedWorkspace ? (
              <div className="h-full flex flex-col">
                {/* Workspace Header */}
                <div className="h-[60px] border-b border-[#333] flex items-center justify-between px-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedWorkspace(null)}
                      className="text-sm text-[#888] hover:text-white transition-colors"
                    >
                      ← Back to Workspaces
                    </button>
                    <div className="h-4 w-[1px] bg-[#333]" />
                    <FolderGit2 size={18} color="#4CAF50" />
                    <span className="text-lg font-semibold">{selectedWorkspace.name}</span>
                    <span className="text-sm text-[#888]">({selectedWorkspace.branch})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCommitDialog(true)}
                      className="px-4 py-2 bg-[#4CAF50] hover:bg-[#45a049] text-white text-sm font-medium rounded transition-colors flex items-center gap-2"
                    >
                      <GitCommit size={16} />
                      Commit & Create PR
                    </button>
                  </div>
                </div>

                {/* Chat + Editor Layout */}
                <div className="flex-1 overflow-hidden">
                  <WorkspaceChatEditor
                    workspace={selectedWorkspace}
                    prefillMessage={chatPrefillMessage}
                    onPrefillCleared={() => setChatPrefillMessage(null)}
                  />
                </div>

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
              </div>
            ) : (
              <WorkspaceManager onSelectWorkspace={setSelectedWorkspace} />
            )}
          </div>
        </div>
      </main>
      </div>
    </ProjectPathContext.Provider>
  )
}

export default App
