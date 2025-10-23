import { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DeveloperTab } from "@/components/DeveloperTab"
import { TestFixTab } from "@/components/TestFixTab"
import { DeploymentsTab } from "@/components/DeploymentsTab"
import { GitHubTab } from "@/components/GitHubTab"
import { PeekDebugPanel } from "@/components/PeekDebugPanel"
import { Store, Wrench, Package, Zap, Rocket, GitBranch } from 'lucide-react'
import { readCircuitConfig, logCircuitStatus } from '@/core/config-reader'
import './App.css'

type Page = 'browse' | 'installed' | 'mcp-servers' | 'testfix' | 'deployments' | 'github'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('mcp-servers')
  const [showDebug] = useState<boolean>(false)  // Debug panel hidden by default

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
        } else if (payload.type === 'github') {
          setCurrentPage('github')
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
    <div className="h-screen flex bg-gradient-to-br from-[#1a1412] to-[#2d2522]">
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
        <nav className="flex-1 overflow-auto py-3">
          {/* Section: Marketplace */}
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Marketplace
          </div>
          <SidebarButton
            icon={<Store className="h-3.5 w-3.5" />}
            label="Browse"
            isActive={currentPage === 'browse'}
            onClick={() => setCurrentPage('browse')}
          />
          <SidebarButton
            icon={<Package className="h-3.5 w-3.5" />}
            label="Installed"
            isActive={currentPage === 'installed'}
            onClick={() => setCurrentPage('installed')}
          />

          {/* Separator */}
          <Separator className="mx-3 my-3" />

          {/* Section: Workflows */}
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Workflows
          </div>
          <SidebarButton
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Test-Fix"
            isActive={currentPage === 'testfix'}
            onClick={() => setCurrentPage('testfix')}
          />
          <SidebarButton
            icon={<Rocket className="h-3.5 w-3.5" />}
            label="Deployments"
            isActive={currentPage === 'deployments'}
            onClick={() => setCurrentPage('deployments')}
          />
          <SidebarButton
            icon={<GitBranch className="h-3.5 w-3.5" />}
            label="GitHub"
            isActive={currentPage === 'github'}
            onClick={() => setCurrentPage('github')}
          />

          {/* Separator */}
          <Separator className="mx-3 my-3" />

          {/* Section: Developer */}
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Developer
          </div>
          <SidebarButton
            icon={<Wrench className="h-3.5 w-3.5" />}
            label="MCP Servers"
            isActive={currentPage === 'mcp-servers'}
            onClick={() => setCurrentPage('mcp-servers')}
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
          {currentPage === 'browse' && (
            <div className="max-w-4xl">
              <Card className="p-6 glass-card">
                <h2 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">MCP Server Marketplace</h2>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Discover and install MCP servers from the community.
                </p>
              </Card>
            </div>
          )}

          {currentPage === 'installed' && (
            <div className="max-w-4xl">
              <Card className="p-6 glass-card">
                <h2 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">Installed Servers</h2>
                <p className="text-sm text-[var(--text-tertiary)]">
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

          {currentPage === 'github' && (
            <div className="max-w-7xl">
              <GitHubTab />
            </div>
          )}

          {currentPage === 'mcp-servers' && (
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
        w-full px-3 py-1.5 flex items-center gap-2.5 text-xs font-normal transition-all duration-150
        ${isActive
          ? 'bg-[var(--circuit-orange)]/15 text-[var(--circuit-orange)] border-l-2 border-[var(--circuit-orange)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-primary)]'
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
