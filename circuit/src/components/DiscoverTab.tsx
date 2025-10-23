/**
 * Discover Tab: MCP Marketplace
 * Browse, search, and install MCP servers
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Star, Download, ExternalLink, Lightbulb, Package, Check } from 'lucide-react'

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

// Mock data - replace with real API call
const MOCK_MCPS: MCPPackage[] = [
  {
    id: '@modelcontextprotocol/server-github',
    name: 'server-github',
    displayName: 'GitHub',
    description: 'Complete GitHub integration for managing repositories, issues, pull requests, code reviews, and CI/CD workflows. Search across organizations, create branches, review PRs, and automate your development workflow directly from Claude.',
    author: 'Model Context Protocol',
    stars: 2400,
    downloads: 15000,
    category: 'Development',
    official: true,
    tags: ['git', 'repository', 'ci-cd'],
    version: '1.2.0',
    repository: 'https://github.com/modelcontextprotocol/servers'
  },
  {
    id: '@slack/mcp-server',
    name: 'mcp-server',
    displayName: 'Slack',
    description: 'Send messages to channels and users, manage workspace channels, upload files, and interact with Slack workflows. Perfect for team communication and notifications automation.',
    author: 'Slack Technologies',
    stars: 1200,
    downloads: 8500,
    category: 'Communication',
    official: false,
    tags: ['messaging', 'collaboration'],
    version: '0.9.1',
    repository: 'https://github.com/slackapi/mcp-server'
  },
  {
    id: '@notionhq/mcp-notion',
    name: 'mcp-notion',
    displayName: 'Notion',
    description: 'Create, read, and update Notion pages and databases. Query your workspace, manage properties, and build custom workflows. Ideal for knowledge management and team documentation.',
    author: 'Notion',
    stars: 980,
    downloads: 6200,
    category: 'Productivity',
    official: false,
    tags: ['database', 'notes', 'wiki'],
    version: '1.0.3',
    repository: 'https://github.com/makenotion/mcp-notion'
  },
  {
    id: '@anthropic/mcp-server-filesystem',
    name: 'server-filesystem',
    displayName: 'Filesystem',
    description: 'Read, write, search, and manage files and directories on your local filesystem. Supports recursive operations, file watching, and batch processing. Essential for file-based workflows.',
    author: 'Anthropic',
    stars: 1800,
    downloads: 12000,
    category: 'System',
    official: true,
    tags: ['file', 'system', 'io'],
    version: '2.0.0',
    repository: 'https://github.com/anthropics/mcp-filesystem'
  },
  {
    id: '@postgres/mcp-postgres',
    name: 'mcp-postgres',
    displayName: 'PostgreSQL',
    description: 'Execute SQL queries, manage schemas, and interact with PostgreSQL databases. Supports transactions, prepared statements, and complex queries for robust database operations.',
    author: 'PostgreSQL Community',
    stars: 750,
    downloads: 4100,
    category: 'Database',
    official: false,
    tags: ['sql', 'database', 'postgresql'],
    version: '0.8.2'
  }
]

const CATEGORIES = ['All', 'Official', 'Development', 'Communication', 'Productivity', 'Database', 'System']

interface DiscoverTabProps {
  onNavigateToInstalled?: () => void
}

export function DiscoverTab({ onNavigateToInstalled }: DiscoverTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'name'>('popular')
  const [installedServers, setInstalledServers] = useState<Set<string>>(new Set())

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
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1 text-[var(--text-primary)]">Discover</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Find and install MCP servers for Claude Desktop
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
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[var(--circuit-orange)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Recommended
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              Popular official servers
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {recommendedMCPs.map(mcp => (
              <button
                key={mcp.id}
                onClick={() => handleInstall(mcp)}
                className="p-3 rounded-lg bg-[#110F0E] hover:bg-[#1a1816] transition-all text-left group shadow-none"
              >
                <div className="flex items-start gap-2 mb-2">
                  <Package className="h-4 w-4 text-[var(--circuit-orange)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-0.5">
                      {mcp.displayName}
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)] line-clamp-2">
                      {mcp.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
                  <Star className="h-2.5 w-2.5" />
                  <span>{(mcp.stars / 1000).toFixed(1)}k</span>
                </div>
              </button>
            ))}
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
                  ? 'bg-[var(--circuit-orange)]/25 text-[var(--circuit-orange)] font-medium'
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
      <div className="space-y-3">
        {filteredMCPs.map(mcp => (
          <Card key={mcp.id} className="p-4 bg-[#110F0E] hover:bg-[#1a1816] transition-colors border-0 shadow-none">
            <div className="flex items-start gap-4">
              {/* Icon/Avatar */}
              <div className="w-12 h-12 rounded-lg bg-[#1a1816] flex items-center justify-center flex-shrink-0">
                <Package className="h-6 w-6 text-[var(--circuit-orange)]" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      {mcp.displayName}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mb-2">
                      {mcp.description}
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Star className="h-3 w-3" />
                    <span>{(mcp.stars / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Download className="h-3 w-3" />
                    <span>{(mcp.downloads / 1000).toFixed(1)}k</span>
                  </div>
                  {mcp.official && (
                    <Badge className="bg-[var(--circuit-success)]/20 text-[var(--circuit-success)] border-0 text-[10px] px-2 py-0">
                      Official
                    </Badge>
                  )}
                  {isInstalled(mcp.id) && (
                    <Badge className="bg-[var(--circuit-orange)]/20 text-[var(--circuit-orange)] border-0 text-[10px] px-2 py-0">
                      <Check className="h-2.5 w-2.5 mr-1" />
                      Installed
                    </Badge>
                  )}
                  <span className="text-xs text-[var(--text-muted)]">{mcp.author}</span>
                  <span className="text-xs text-[var(--text-muted)]">v{mcp.version}</span>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 mb-3">
                  {mcp.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded bg-[var(--glass-bg)] text-[var(--text-muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isInstalled(mcp.id) ? (
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                  >
                    Try in Playground
                  </Button>
                  {mcp.repository && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 h-7 text-xs ml-auto"
                      onClick={() => window.open(mcp.repository, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Source
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredMCPs.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
          <p className="text-sm text-[var(--text-muted)]">
            No MCP servers found matching your search
          </p>
        </div>
      )}
    </div>
  )
}
