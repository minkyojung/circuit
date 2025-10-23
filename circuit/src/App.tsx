import { useState, useEffect, createContext, useContext } from 'react'
import { InstalledTab } from "@/components/InstalledTab"
import { DiscoverTab } from "@/components/DiscoverTab"
import { PlaygroundTab } from "@/components/PlaygroundTab"
import { DashboardTab } from "@/components/DashboardTab"
import { TestFixTab } from "@/components/TestFixTab"
import { PeekDebugPanel } from "@/components/PeekDebugPanel"
import { Package, Server, FlaskConical, LayoutDashboard, Zap } from 'lucide-react'
import { readCircuitConfig, logCircuitStatus } from '@/core/config-reader'
import './App.css'

type Page = 'dashboard' | 'discover' | 'installed' | 'playground' | 'test-fix'

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
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [showDebug] = useState<boolean>(false)  // Debug panel hidden by default
  const [projectPath, setProjectPath] = useState<string>('')
  const [isLoadingPath, setIsLoadingPath] = useState<boolean>(true)

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

  // Listen for peek panel data and auto-switch to appropriate tab
  useEffect(() => {
    try {
      const { ipcRenderer } = window.require('electron')

      const handlePeekData = (_event: any, payload: any) => {
        // Auto-switch to discover for all workflow events
        if (payload.type === 'test-result' || payload.type === 'deployment' || payload.type === 'github') {
          setCurrentPage('discover')
        }
      }

      ipcRenderer.on('peek:data-opened', handlePeekData)

      return () => {
        ipcRenderer.removeListener('peek:data-opened', handlePeekData)
      }
    } catch (e) {
      console.warn('IPC not available for peek data listener:', e)
    }
  }, [])

  return (
    <ProjectPathContext.Provider value={{ projectPath, isLoading: isLoadingPath }}>
      <div className="h-screen flex bg-gradient-to-br from-[#0f0d0c] to-[#1a1412]">
        {/* Debug Panel */}
        {showDebug && <PeekDebugPanel />}

      {/* Sidebar */}
      <aside className="w-[200px] glass-sidebar flex flex-col">
        {/* Sidebar Top - Traffic Lights Area (Fully Draggable) */}
        <div
          className="h-[44px] flex items-center px-4"
          style={{ WebkitAppRegion: 'drag' } as any}
        />

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-auto py-3 px-2">
          {/* Dashboard */}
          <SidebarButton
            icon={<LayoutDashboard className="h-4 w-4" />}
            label="Dashboard"
            isActive={currentPage === 'dashboard'}
            onClick={() => setCurrentPage('dashboard')}
          />

          {/* Discover */}
          <SidebarButton
            icon={<Package className="h-4 w-4" />}
            label="Discover"
            isActive={currentPage === 'discover'}
            onClick={() => setCurrentPage('discover')}
          />

          {/* Installed */}
          <SidebarButton
            icon={<Server className="h-4 w-4" />}
            label="Installed"
            isActive={currentPage === 'installed'}
            onClick={() => setCurrentPage('installed')}
          />

          {/* Playground */}
          <SidebarButton
            icon={<FlaskConical className="h-4 w-4" />}
            label="Playground"
            isActive={currentPage === 'playground'}
            onClick={() => setCurrentPage('playground')}
          />

          {/* Test-Fix Loop */}
          <SidebarButton
            icon={<Zap className="h-4 w-4" />}
            label="Test-Fix Loop"
            isActive={currentPage === 'test-fix'}
            onClick={() => setCurrentPage('test-fix')}
          />
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
          {currentPage === 'dashboard' && (
            <div className="max-w-6xl mx-auto">
              <DashboardTab />
            </div>
          )}

          {currentPage === 'discover' && (
            <div className="max-w-5xl mx-auto">
              <DiscoverTab onNavigateToInstalled={() => setCurrentPage('installed')} />
            </div>
          )}

          {currentPage === 'installed' && (
            <div className="max-w-4xl mx-auto">
              <InstalledTab />
            </div>
          )}

          {currentPage === 'playground' && (
            <div className="h-full">
              <PlaygroundTab />
            </div>
          )}

          {currentPage === 'test-fix' && (
            <div className="max-w-5xl mx-auto">
              <TestFixTab />
            </div>
          )}
        </div>
      </main>
      </div>
    </ProjectPathContext.Provider>
  )
}

function SidebarButton({
  icon,
  label,
  isActive,
  onClick,
  badge
}: {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
  badge?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full px-2 py-1.5 flex items-center gap-2.5 text-xs transition-all duration-150 rounded
        ${isActive
          ? 'bg-[var(--circuit-orange)]/25 text-[var(--circuit-orange)] font-medium'
          : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-primary)] font-normal'
        }
      `}
      style={{ WebkitAppRegion: 'no-drag' } as any}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[var(--glass-hover)] text-[var(--text-muted)]">
          {badge}
        </span>
      )}
    </button>
  )
}

export default App
