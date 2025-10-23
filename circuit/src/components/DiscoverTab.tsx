/**
 * Discover Tab: MCP Marketplace
 * Browse, search, and install MCP servers
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Lightbulb, Package, Check, Loader2 } from 'lucide-react'

// MCP Package type
interface MCPPackage {
  id: string
  name: string
  displayName: string
  description: string
  author: string
  stars: number
  downloads: number
  category: string
  official: boolean
  tags: string[]
  version: string
  repository?: string
}

// Real MCP servers from npm registry
const MOCK_MCPS: MCPPackage[] = [
  {
    id: '@modelcontextprotocol/server-filesystem',
    name: 'server-filesystem',
    displayName: 'Filesystem',
    description: 'Secure file operations with configurable access controls. Read, write, search, and manage files and directories on your local filesystem. Essential for file-based workflows.',
    author: 'Model Context Protocol',
    stars: 1800,
    downloads: 12000,
    category: 'System',
    official: true,
    tags: ['file', 'system', 'io'],
    version: '2.0.0',
    repository: 'https://github.com/modelcontextprotocol/servers'
  },
  {
    id: '@mseep/git-mcp-server',
    name: 'git-mcp-server',
    displayName: 'Git',
    description: 'Tools to read, search, and manipulate Git repositories. Complete Git integration for managing repositories, commits, branches, and workflow automation.',
    author: 'mseep',
    stars: 2100,
    downloads: 14000,
    category: 'Development',
    official: false,
    tags: ['git', 'repository', 'version-control'],
    version: '1.2.0',
    repository: 'https://github.com/cyanheads/git-mcp-server'
  },
  {
    id: '@modelcontextprotocol/server-memory',
    name: 'server-memory',
    displayName: 'Memory',
    description: 'Knowledge graph-based persistent memory system. Enable Claude to remember information across conversations using a structured knowledge graph.',
    author: 'Model Context Protocol',
    stars: 1500,
    downloads: 9800,
    category: 'AI',
    official: true,
    tags: ['memory', 'knowledge-graph', 'persistence'],
    version: '1.1.0',
    repository: 'https://github.com/modelcontextprotocol/servers'
  },
  {
    id: '@modelcontextprotocol/server-fetch',
    name: 'server-fetch',
    displayName: 'Fetch',
    description: 'Web content fetching and conversion for efficient LLM usage. Download and process web pages, APIs, and online resources.',
    author: 'Model Context Protocol',
    stars: 1200,
    downloads: 8200,
    category: 'Web',
    official: true,
    tags: ['http', 'web', 'fetch'],
    version: '1.0.5',
    repository: 'https://github.com/modelcontextprotocol/servers'
  },
  {
    id: '@modelcontextprotocol/server-time',
    name: 'server-time',
    displayName: 'Time',
    description: 'Time and timezone conversion capabilities. Get current time, convert between timezones, and perform date/time calculations.',
    author: 'Model Context Protocol',
    stars: 650,
    downloads: 4500,
    category: 'Utility',
    official: true,
    tags: ['time', 'timezone', 'date'],
    version: '0.9.0',
    repository: 'https://github.com/modelcontextprotocol/servers'
  },
  {
    id: '@modelcontextprotocol/server-sequential-thinking',
    name: 'server-sequential-thinking',
    displayName: 'Sequential Thinking',
    description: 'Dynamic and reflective problem-solving through thought sequences. Enhanced reasoning capabilities for complex tasks.',
    author: 'Model Context Protocol',
    stars: 890,
    downloads: 5200,
    category: 'AI',
    official: true,
    tags: ['reasoning', 'thinking', 'analysis'],
    version: '1.0.1',
    repository: 'https://github.com/modelcontextprotocol/servers'
  },
  {
    id: '@modelcontextprotocol/server-everything',
    name: 'server-everything',
    displayName: 'Everything (Test)',
    description: 'Reference/test server with prompts, resources, and tools. Exercises all features of the MCP protocol. Useful for testing MCP client implementations.',
    author: 'Model Context Protocol',
    stars: 420,
    downloads: 2100,
    category: 'Development',
    official: true,
    tags: ['test', 'reference', 'development'],
    version: '1.0.0',
    repository: 'https://github.com/modelcontextprotocol/servers'
  }
]

const CATEGORIES = ['All', 'Official', 'Development', 'AI', 'System', 'Web', 'Utility']

interface DiscoverTabProps {
  onNavigateToInstalled?: () => void
}

export function DiscoverTab({ onNavigateToInstalled }: DiscoverTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'name'>('popular')
  const [installedServers, setInstalledServers] = useState<Set<string>>(new Set())
  const [installingServers, setInstallingServers] = useState<Set<string>>(new Set())

  // Load installed servers on mount
  useEffect(() => {
    const loadInstalledServers = async () => {
      try {
        const { ipcRenderer } = window.require('electron')
        const result = await ipcRenderer.invoke('circuit:mcp-get-all-status')

        console.log('[DiscoverTab] Loaded installed servers:', result)

        if (result.success && result.statuses) {
          const installedIds = new Set<string>(result.statuses.map((s: any) => s.id as string))
          console.log('[DiscoverTab] Installed IDs:', Array.from(installedIds))
          setInstalledServers(installedIds)
        }
      } catch (error) {
        console.error('Failed to load installed servers:', error)
      }
    }

    loadInstalledServers()
  }, [])

  // Normalize MCP ID to match backend normalization
  // @example '@slack/mcp-server' -> 'slack-mcp-server'
  const normalizeId = (id: string): string => {
    return id.replace(/^@/, '').replace(/\//g, '-')
  }

  // Check if a server is installed
  const isInstalled = (mcpId: string): boolean => {
    const normalizedId = normalizeId(mcpId)
    return installedServers.has(normalizedId)
  }

  // Filter MCPs
  const filteredMCPs = MOCK_MCPS.filter(mcp => {
    const matchesSearch = mcp.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         mcp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         mcp.tags.some(tag => tag.includes(searchQuery.toLowerCase()))

    const matchesCategory = selectedCategory === 'All' ||
                           selectedCategory === 'Official' && mcp.official ||
                           mcp.category === selectedCategory

    return matchesSearch && matchesCategory
  }).sort((a, b) => {
    if (sortBy === 'popular') return b.stars - a.stars
    if (sortBy === 'name') return a.displayName.localeCompare(b.displayName)
    return 0
  })

  // Recommended MCPs (top 3 official ones)
  const recommendedMCPs = MOCK_MCPS.filter(mcp => mcp.official).slice(0, 3)

  const handleInstall = async (mcp: MCPPackage) => {
    // If already installed, navigate to Installed tab
    if (isInstalled(mcp.id)) {
      onNavigateToInstalled?.()
      return
    }

    // Mark as installing
    setInstallingServers(prev => new Set(prev).add(mcp.id))

    try {
      const { ipcRenderer } = window.require('electron')

      // 1. Install the MCP server
      // Note: Backend will normalize the ID to be filesystem-safe
      const installResult = await ipcRenderer.invoke('circuit:mcp-install', mcp.id, {
        name: mcp.displayName,
        packageId: mcp.id,
        command: 'npx',
        args: ['-y', mcp.id],
        autoStart: true,
        autoRestart: true
      })

      if (!installResult.success) {
        alert(`Installation failed: ${installResult.error}`)
        return
      }

      // Get the normalized server ID from the backend
      const serverId = installResult.serverId

      // 2. Start the server
      const startResult = await ipcRenderer.invoke('circuit:mcp-start', serverId)

      if (!startResult.success) {
        alert(`Failed to start: ${startResult.error}`)
        return
      }

      // 3. Update installed servers list with the normalized ID
      setInstalledServers(prev => new Set(prev).add(serverId))

      alert(`${mcp.displayName} installed and started successfully!`)
    } catch (error) {
      console.error('Installation error:', error)
      alert(`Installation failed: ${error}`)
    } finally {
      // Remove from installing state
      setInstallingServers(prev => {
        const next = new Set(prev)
        next.delete(mcp.id)
        return next
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold leading-tight mb-1 text-[var(--text-primary)]">Discover</h1>
        <p className="text-xs leading-normal text-[var(--text-secondary)]">
          Find and install MCP servers for Claude
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <Input
          type="text"
          placeholder="Search MCP servers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 glass-card border-[var(--glass-border)]"
        />
      </div>

      {/* Recommended Section */}
      {!searchQuery && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold leading-tight text-[var(--text-primary)]">
              Recommended
            </h2>
            <span className="text-xs leading-normal text-[var(--text-muted)]">
              Popular official servers
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {recommendedMCPs.map(mcp => {
              const isInstalling = installingServers.has(mcp.id)

              return (
                <button
                  key={mcp.id}
                  onClick={() => handleInstall(mcp)}
                  disabled={isInstalling}
                  className="p-2.5 rounded-lg bg-[var(--bg-section)] hover:bg-[var(--bg-card)] border border-white/5 hover:border-white/10 transition-colors text-left group shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    {isInstalling ? (
                      <Loader2 className="h-3.5 w-3.5 text-[var(--circuit-orange)] flex-shrink-0 mt-0.5 animate-spin" />
                    ) : (
                      <Package className="h-3.5 w-3.5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold leading-tight text-[var(--text-primary)] mb-0.5">
                        {mcp.displayName}
                        {isInstalling && <span className="ml-1 text-[var(--circuit-orange)]">Installing...</span>}
                      </h3>
                      <p className="text-[11px] leading-normal text-[var(--text-muted)] line-clamp-2">
                        {mcp.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    ⭐ {(mcp.stars / 1000).toFixed(1)}k
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`
                px-3 py-1 text-xs rounded-full transition-all
                ${selectedCategory === category
                  ? 'bg-[var(--circuit-orange)]/40 text-[var(--circuit-orange)] font-medium'
                  : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-hover)]'
                }
              `}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 text-xs rounded bg-[var(--glass-bg)] text-[var(--text-secondary)] border border-[var(--glass-border)] focus:outline-none focus:border-[var(--circuit-orange)]"
          >
            <option value="popular">Popular</option>
            <option value="recent">Recent</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {/* MCP Cards */}
      <div className="space-y-2">
        {filteredMCPs.map(mcp => (
          <Card key={mcp.id} className="p-3 bg-[var(--bg-section)] hover:bg-[var(--bg-card)] border border-white/5 hover:border-white/10 transition-colors shadow-none">
            <div className="flex items-start gap-3">
              {/* Icon/Avatar */}
              <div className="w-10 h-10 rounded-lg bg-[var(--bg-card-elevated)] flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 text-[var(--text-muted)]" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold leading-tight text-[var(--text-primary)] mb-0.5">
                      {mcp.displayName}
                    </h3>
                    <p className="text-xs leading-normal text-[var(--text-secondary)] line-clamp-1">
                      {mcp.description}
                    </p>
                  </div>
                </div>

                {/* Metadata - Simplified */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    ⭐ {(mcp.stars / 1000).toFixed(1)}k
                  </span>
                  {mcp.official && (
                    <Badge className="bg-[var(--circuit-success)]/20 text-[var(--circuit-success)] border-0 text-[11px] px-1.5 py-0">
                      Official
                    </Badge>
                  )}
                  {isInstalled(mcp.id) && (
                    <Badge className="bg-[var(--circuit-orange)]/20 text-[var(--circuit-orange)] border-0 text-[11px] px-1.5 py-0">
                      <Check className="h-2.5 w-2.5 mr-0.5" />
                      Installed
                    </Badge>
                  )}
                </div>

                {/* Actions - Simplified */}
                <div className="flex items-center gap-2">
                  {installingServers.has(mcp.id) ? (
                    <Button
                      size="sm"
                      disabled
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Installing...
                    </Button>
                  ) : isInstalled(mcp.id) ? (
                    <Button
                      onClick={() => handleInstall(mcp)}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Check className="h-3 w-3" />
                      Manage
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleInstall(mcp)}
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Download className="h-3 w-3" />
                      Add to Claude
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredMCPs.length === 0 && (
        <div className="text-center py-16">
          <Package className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
          <p className="text-xs text-[var(--text-muted)]">
            No servers found
          </p>
        </div>
      )}
    </div>
  )
}
