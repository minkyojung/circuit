import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { Code, Terminal, FileText, GitCompare, RefreshCw, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Block, BlockType } from '@/types/conversation'
// Removed shadcn/ui sidebar components to avoid SidebarProvider dependency
// Using plain HTML elements instead
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron')

interface BlockNavigatorProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string | null
}

export function BlockNavigator({ isOpen, onClose, conversationId }: BlockNavigatorProps) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [filteredBlocks, setFilteredBlocks] = useState<Block[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<BlockType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Load blocks when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadBlocks()
    } else {
      setBlocks([])
      setFilteredBlocks([])
    }
  }, [conversationId])

  // Filter blocks when type or search query changes
  useEffect(() => {
    let filtered = blocks

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(b => b.type === selectedType)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(b =>
        b.content.toLowerCase().includes(query) ||
        (b.metadata?.language?.toLowerCase().includes(query)) ||
        (b.metadata?.fileName?.toLowerCase().includes(query))
      )
    }

    setFilteredBlocks(filtered)
  }, [blocks, selectedType, searchQuery])

  // Calculate block counts by type
  const blockCounts = useMemo(() => {
    return {
      all: blocks.length,
      code: blocks.filter(b => b.type === 'code').length,
      command: blocks.filter(b => b.type === 'command').length,
      diff: blocks.filter(b => b.type === 'diff').length,
    }
  }, [blocks])

  const loadBlocks = async () => {
    if (!conversationId) return

    setIsLoading(true)
    try {
      const result = await ipcRenderer.invoke('message:load', conversationId)

      if (result.success && result.messages) {
        // Flatten blocks from all messages
        const allBlocks: Block[] = []
        result.messages.forEach((message: any) => {
          if (message.blocks && message.blocks.length > 0) {
            message.blocks.forEach((block: Block) => {
              // Only include interesting block types
              if (['code', 'command', 'diff'].includes(block.type)) {
                allBlocks.push(block)
              }
            })
          }
        })
        setBlocks(allBlocks)
      } else {
        console.error('Failed to load blocks:', result.error)
      }
    } catch (error) {
      console.error('Error loading blocks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getBlockIcon = (type: BlockType) => {
    const iconClass = "text-sidebar-foreground-muted"
    const size = 14
    const strokeWidth = 1.5

    switch (type) {
      case 'command':
        return <Terminal className={iconClass} size={size} strokeWidth={strokeWidth} />
      case 'diff':
        return <GitCompare className={iconClass} size={size} strokeWidth={strokeWidth} />
      case 'code':
        return <Code className={iconClass} size={size} strokeWidth={strokeWidth} />
      default:
        return <FileText className={iconClass} size={size} strokeWidth={strokeWidth} />
    }
  }

  const getBlockTitle = (block: Block): string => {
    const language = block.metadata?.language || 'text'
    const preview = block.content.slice(0, 50).replace(/\n/g, ' ')
    return `${language}: ${preview}${block.content.length > 50 ? '...' : ''}`
  }

  const handleBlockClick = (blockId: string) => {
    const element = document.querySelector(`[data-block-id="${blockId}"]`)
    if (element) {
      // Smooth scroll to block
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })

      // Add highlight effect
      element.classList.add('block-highlight')
      setTimeout(() => {
        element.classList.remove('block-highlight')
      }, 2000)
    } else {
      console.warn('[BlockNavigator] Block element not found:', blockId)
    }
  }

  return (
    <div className="h-full w-[17rem] flex flex-col flex-shrink-0">
      {/* Header with integrated filter buttons - draggable */}
      <div
        className="flex h-[44px] shrink-0 items-start pt-3 px-3"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        {/* Filter buttons without icons and counts */}
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => setSelectedType('all')}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              selectedType === 'all'
                ? "bg-secondary text-secondary-foreground"
                : "text-sidebar-foreground-muted hover:bg-sidebar-accent"
            )}
          >
            All
          </button>
          <button
            onClick={() => setSelectedType('code')}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              selectedType === 'code'
                ? "bg-secondary text-secondary-foreground"
                : "text-sidebar-foreground-muted hover:bg-sidebar-accent"
            )}
          >
            Code
          </button>
          <button
            onClick={() => setSelectedType('command')}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              selectedType === 'command'
                ? "bg-secondary text-secondary-foreground"
                : "text-sidebar-foreground-muted hover:bg-sidebar-accent"
            )}
          >
            Cmd
          </button>
          <button
            onClick={() => setSelectedType('diff')}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              selectedType === 'diff'
                ? "bg-secondary text-secondary-foreground"
                : "text-sidebar-foreground-muted hover:bg-sidebar-accent"
            )}
          >
            Diff
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "h-[30px] pl-3 pr-8 py-0 text-sm bg-sidebar-accent border-sidebar-border",
              "placeholder:text-sidebar-foreground-muted placeholder:opacity-70",
              "focus-visible:ring-1 focus-visible:ring-sidebar-ring"
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-sidebar-hover transition-colors"
            >
              <X size={12} strokeWidth={1.5} className="text-sidebar-foreground-muted" />
            </button>
          )}
        </div>
      </div>

      {/* Content - using plain HTML instead of shadcn/ui components */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-sidebar-foreground-muted">
              Loading blocks...
            </p>
          </div>
        ) : filteredBlocks.length === 0 ? (
          <div className="px-3 py-6 text-center">
            {searchQuery ? (
              <>
                <Search className="h-12 w-12 mx-auto mb-3 text-sidebar-foreground-muted opacity-20" />
                <p className="text-sm text-sidebar-foreground-muted mb-1">
                  No results for "{searchQuery}"
                </p>
                <p className="text-xs text-sidebar-foreground-muted opacity-70">
                  Try different keywords or clear filters
                </p>
              </>
            ) : (
              <>
                <FileText className="h-12 w-12 mx-auto mb-3 text-sidebar-foreground-muted opacity-20" />
                <p className="text-sm text-sidebar-foreground-muted mb-1">
                  No blocks found
                </p>
                <p className="text-xs text-sidebar-foreground-muted opacity-70">
                  {selectedType === 'all'
                    ? 'Send messages to see blocks here'
                    : `No ${selectedType} blocks in this conversation`}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredBlocks.map((block) => (
              <button
                key={block.id}
                onClick={() => handleBlockClick(block.id)}
                className={cn(
                  "w-full text-left rounded-md transition-colors",
                  "hover:bg-sidebar-accent focus:bg-sidebar-accent",
                  "focus:outline-none focus:ring-2 focus:ring-sidebar-ring",
                  "py-2 px-2 group"
                )}
              >
                <div className="flex gap-2 w-full min-w-0">
                  {/* Icon */}
                  <div className="flex items-center pt-[2px]">
                    {getBlockIcon(block.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-normal text-sidebar-foreground truncate">
                      {getBlockTitle(block)}
                    </p>
                    <p className="text-[10px] text-sidebar-foreground-muted mt-1 font-mono">
                      {block.content.split('\n').length} lines
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={loadBlocks}
          disabled={isLoading}
          className="w-full justify-start text-xs text-sidebar-foreground-muted hover:text-sidebar-foreground"
        >
          <RefreshCw className={cn("h-3 w-3 mr-2", isLoading && "animate-spin")} />
          {isLoading ? 'Refreshing...' : 'Refresh blocks'}
        </Button>
      </div>
    </div>
  )
}
