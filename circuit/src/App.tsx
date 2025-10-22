import { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { DeveloperTab } from "@/components/DeveloperTab"
import { TestFixTab } from "@/components/TestFixTab"
import { DeploymentsTab } from "@/components/DeploymentsTab"
import { PeekDebugPanel } from "@/components/PeekDebugPanel"
import { Store, Wrench, Package, Zap, Rocket } from 'lucide-react'
import { readCircuitConfig, logCircuitStatus } from '@/core/config-reader'
import './App.css'

type Page = 'marketplace' | 'installed' | 'developer' | 'testfix' | 'deployments'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('developer')
  const [showDebug, setShowDebug] = useState<boolean>(true)  // Set to true for debugging

  // Phase 0: .circuit/ 설정 읽기 시도
  useEffect(() => {
    const checkCircuitConfig = async () => {
      // TODO: Get actual project path from Electron main process
      const config = await readCircuitConfig('')
      logCircuitStatus(config)
    }

    checkCircuitConfig()
  }, [])

  // Listen for peek panel data and auto-switch to appropriate tab
  useEffect(() => {
    try {
      const { ipcRenderer } = window.require('electron')

      const handlePeekData = (_event: any, payload: any) => {
        // Auto-switch to appropriate tab based on data type
        if (payload.type === 'test-result') {
          setCurrentPage('testfix')
        } else if (payload.type === 'deployment') {
          setCurrentPage('deployments')
        }
        // Future: Add more cases for other data types
        // if (payload.type === 'git') setCurrentPage('git-activity')
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
    <div className="h-screen flex bg-background">
      {/* Debug Panel */}
      {showDebug && <PeekDebugPanel />}

      {/* Sidebar */}
      <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Sidebar Top - Traffic Lights Area (Fully Draggable) */}
        <div
          className="h-[44px] flex items-center px-4 border-b border-sidebar-border"
          style={{ WebkitAppRegion: 'drag' } as any}
        />

        {/* Sidebar Navigation */}
        <nav className="flex-1 py-4">
          <SidebarButton
            icon={<Store className="h-4 w-4" />}
            label="Marketplace"
            isActive={currentPage === 'marketplace'}
            onClick={() => setCurrentPage('marketplace')}
          />
          <SidebarButton
            icon={<Package className="h-4 w-4" />}
            label="Installed"
            isActive={currentPage === 'installed'}
            onClick={() => setCurrentPage('installed')}
          />
          <SidebarButton
            icon={<Zap className="h-4 w-4" />}
            label="Test-Fix"
            isActive={currentPage === 'testfix'}
            onClick={() => setCurrentPage('testfix')}
          />
          <SidebarButton
            icon={<Rocket className="h-4 w-4" />}
            label="Deployments"
            isActive={currentPage === 'deployments'}
            onClick={() => setCurrentPage('deployments')}
          />
          <SidebarButton
            icon={<Wrench className="h-4 w-4" />}
            label="Developer"
            isActive={currentPage === 'developer'}
            onClick={() => setCurrentPage('developer')}
          />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Main Header (Empty spaces draggable, interactive elements not) */}
        <header
          className="h-[44px] bg-background border-b border-border flex items-center px-4 gap-4"
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
          {currentPage === 'marketplace' && (
            <div className="max-w-4xl">
              <Card className="p-6 border-border">
                <h2 className="text-lg font-semibold mb-2">MCP Server Marketplace</h2>
                <p className="text-sm text-muted-foreground">
                  Discover and install MCP servers from the community.
                </p>
              </Card>
            </div>
          )}

          {currentPage === 'installed' && (
            <div className="max-w-4xl">
              <Card className="p-6 border-border">
                <h2 className="text-lg font-semibold mb-2">Installed Servers</h2>
                <p className="text-sm text-muted-foreground">
                  Manage your installed MCP servers.
                </p>
              </Card>
            </div>
          )}

          {currentPage === 'testfix' && (
            <div className="max-w-7xl">
              <TestFixTab />
            </div>
          )}

          {currentPage === 'deployments' && (
            <div className="max-w-7xl">
              <DeploymentsTab />
            </div>
          )}

          {currentPage === 'developer' && (
            <div className="max-w-7xl">
              <DeveloperTab />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function SidebarButton({
  icon,
  label,
  isActive,
  onClick
}: {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full px-4 py-2.5 flex items-center gap-3 text-sm font-medium transition-colors
        ${isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        }
      `}
      style={{ WebkitAppRegion: 'no-drag' } as any}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export default App
