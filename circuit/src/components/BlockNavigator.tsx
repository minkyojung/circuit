import * as React from 'react'
import { useState, useEffect } from 'react'
import { List, Code, Terminal, FileText, GitCompare, ChevronRight, RefreshCw, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Block, BlockType } from '@/types/conversation'
// Removed shadcn/ui sidebar components to avoid SidebarProvider dependency
// Using plain HTML elements instead
import { Button } from '@/components/ui/button'

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

  // Load blocks when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadBlocks()
    } else {
      setBlocks([])
      setFilteredBlocks([])
    }
  }, [conversationId])

  // Filter blocks when type changes
  useEffect(() => {
    if (selectedType === 'all') {
      setFilteredBlocks(blocks)
    } else {
      setFilteredBlocks(blocks.filter(b => b.type === selectedType))
    }
  }, [blocks, selectedType])

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
    switch (type) {
      case 'command':
        return <Terminal className="h-3.5 w-3.5 text-purple-400" />
      case 'diff':
        return <GitCompare className="h-3.5 w-3.5 text-green-400" />
      case 'code':
        return <Code className="h-3.5 w-3.5 text-blue-400" />
      default:
        return <FileText className="h-3.5 w-3.5 text-gray-400" />
    }
  }

  const getBlockTitle = (block: Block): string => {
    const language = block.metadata?.language || 'text'
    const preview = block.content.slice(0, 50).replace(/\n/g, ' ')
    return `${language}: ${preview}${block.content.length > 50 ? '...' : ''}`
  }

  return (
    <div className="h-full w-80 flex flex-col flex-shrink-0 border-l border-border">
      {/* Header - matches AppSidebar style */}
      <div className="flex h-[44px] shrink-0 items-center justify-between px-3 border-b border-border">
        <div className="flex items-center gap-2">
          <List className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-sidebar-foreground">Blocks</h2>
          {filteredBlocks.length > 0 && (
            <span className="text-xs text-sidebar-foreground-muted">
              {filteredBlocks.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 text-sidebar-foreground-muted hover:text-sidebar-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-1 p-2 border-b border-border">
        <button
          onClick={() => setSelectedType('all')}
          className={cn(
            "px-2 py-1 text-xs rounded transition-colors",
            selectedType === 'all'
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground-muted hover:bg-sidebar-accent"
          )}
        >
          All
        </button>
        <button
          onClick={() => setSelectedType('code')}
          className={cn(
            "px-2 py-1 text-xs rounded transition-colors flex items-center gap-1",
            selectedType === 'code'
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground-muted hover:bg-sidebar-accent"
          )}
        >
          <Code className="h-3 w-3" />
          Code
        </button>
        <button
          onClick={() => setSelectedType('command')}
          className={cn(
            "px-2 py-1 text-xs rounded transition-colors flex items-center gap-1",
            selectedType === 'command'
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground-muted hover:bg-sidebar-accent"
          )}
        >
          <Terminal className="h-3 w-3" />
          Cmd
        </button>
        <button
          onClick={() => setSelectedType('diff')}
          className={cn(
            "px-2 py-1 text-xs rounded transition-colors flex items-center gap-1",
            selectedType === 'diff'
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground-muted hover:bg-sidebar-accent"
          )}
        >
          <GitCompare className="h-3 w-3" />
          Diff
        </button>
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
            <List className="h-12 w-12 mx-auto mb-3 text-sidebar-foreground-muted opacity-20" />
            <p className="text-sm text-sidebar-foreground-muted mb-1">
              No blocks found
            </p>
            <p className="text-xs text-sidebar-foreground-muted opacity-70">
              {selectedType === 'all'
                ? 'Send messages to see blocks here'
                : `No ${selectedType} blocks in this conversation`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredBlocks.map((block) => (
              <button
                key={block.id}
                onClick={() => {
                  console.log('[BlockNavigator] Block clicked:', block)
                  // TODO: Scroll to block
                }}
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
                    <p className="text-[10px] text-sidebar-foreground-muted mt-0.5 font-mono">
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
      <div className="border-t border-border p-2">
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
