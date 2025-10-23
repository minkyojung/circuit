import { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DeveloperTab } from "@/components/DeveloperTab"
import { TestFixTab } from "@/components/TestFixTab"
import { DeploymentsTab } from "@/components/DeploymentsTab"
import { GitHubTab } from "@/components/GitHubTab"
import { PeekDebugPanel } from "@/components/PeekDebugPanel"
import { Wrench, Zap, Rocket, GitBranch, Plus } from 'lucide-react'
import { readCircuitConfig, logCircuitStatus } from '@/core/config-reader'
import './App.css'

type Page = 'mcp-servers' | 'testfix' | 'deployments' | 'github' | 'marketplace'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('testfix')
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
          {/* Primary Workflows */}
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
            icon={<GitBranch className="h-4 w-4" />}
            label="GitHub"
            isActive={currentPage === 'github'}
            onClick={() => setCurrentPage('github')}
          />

          {/* New Workflow Button */}
          <button
            className="w-full px-2 py-1.5 mt-1 flex items-center gap-2.5 text-xs font-normal text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--glass-hover)] transition-all duration-150 rounded"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            onClick={() => setCurrentPage('marketplace')}
          >
            <Plus className="h-4 w-4" />
            <span>New workflow</span>
          </button>

          {/* Separator */}
          <Separator className="mx-1 my-4" />

          {/* Tools */}
          <div className="px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Tools
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

          {currentPage === 'marketplace' && (
            <div className="max-w-4xl">
              <Card className="p-6 glass-card">
                <h2 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">Workflow Marketplace</h2>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Discover and install workflow templates from the community.
                </p>
              </Card>
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
        w-full px-2 py-1.5 flex items-center gap-2.5 text-xs font-normal transition-all duration-150 rounded relative
        ${isActive
          ? 'bg-[var(--circuit-orange)]/20 text-[var(--circuit-orange)] font-medium'
          : 'text-[var(--text-secondary)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-primary)]'
        }
      `}
      style={{ WebkitAppRegion: 'no-drag' } as any}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--circuit-orange)] rounded-full" />
      )}
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
