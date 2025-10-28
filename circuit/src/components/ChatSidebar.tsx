import * as React from 'react'
import { useState, useEffect } from 'react'
import { Bookmark, Code, Terminal, X, ChevronRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BlockBookmark } from '@/types/conversation'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron')

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string | null
}

export function ChatSidebar({ isOpen, onClose, conversationId }: ChatSidebarProps) {
  const [bookmarks, setBookmarks] = useState<BlockBookmark[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load bookmarks when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadBookmarks()
    } else {
      setBookmarks([])
    }
  }, [conversationId])

  const loadBookmarks = async () => {
    setIsLoading(true)
    try {
      const result = await ipcRenderer.invoke('block:get-bookmarks')

      if (result.success && result.bookmarks) {
        setBookmarks(result.bookmarks)
      } else {
        console.error('Failed to load bookmarks:', result.error)
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteBookmark = async (bookmarkId: string) => {
    try {
      const result = await ipcRenderer.invoke('block:delete-bookmark', bookmarkId)

      if (result.success) {
        setBookmarks(bookmarks.filter(b => b.id !== bookmarkId))
      } else {
        console.error('Failed to delete bookmark:', result.error)
      }
    } catch (error) {
      console.error('Error deleting bookmark:', error)
    }
  }

  const getBlockIcon = (title: string) => {
    if (title.includes('command') || title.includes('Command')) {
      return <Terminal className="h-3.5 w-3.5 text-purple-400" />
    }
    return <Code className="h-3.5 w-3.5 text-blue-400" />
  }

  return (
    <div className="h-full w-80 flex flex-col flex-shrink-0 border-l border-border">
      {/* Header - matches AppSidebar style */}
      <div className="flex h-[44px] shrink-0 items-center justify-between px-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-yellow-500" />
          <h2 className="text-sm font-semibold text-sidebar-foreground">Bookmarks</h2>
          {bookmarks.length > 0 && (
            <span className="text-xs text-sidebar-foreground-muted">
              {bookmarks.length}
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

      {/* Content - using shadcn/ui Sidebar components */}
      <div className="flex-1 overflow-y-auto">
        <SidebarGroup className="p-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm text-sidebar-foreground-muted">
                    Loading bookmarks...
                  </p>
                </div>
              ) : bookmarks.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <Bookmark className="h-12 w-12 mx-auto mb-3 text-sidebar-foreground-muted opacity-20" />
                  <p className="text-sm text-sidebar-foreground-muted mb-1">
                    No bookmarks yet
                  </p>
                  <p className="text-xs text-sidebar-foreground-muted opacity-70">
                    Click the bookmark icon on code blocks to save them
                  </p>
                </div>
              ) : (
                bookmarks.map((bookmark) => (
                  <SidebarMenuItem key={bookmark.id} className="my-0">
                    <SidebarMenuButton
                      onClick={() => {
                        console.log('[ChatSidebar] Bookmark clicked:', bookmark)
                        // TODO: Navigate to block
                      }}
                      className="h-auto py-2 px-2 group"
                    >
                      <div className="flex gap-2 w-full min-w-0">
                        {/* Icon */}
                        <div className="flex items-center pt-[2px]">
                          {getBlockIcon(bookmark.title)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-normal text-sidebar-foreground truncate">
                            {bookmark.title || 'Untitled'}
                          </p>
                          {bookmark.tags && bookmark.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {bookmark.tags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-foreground-muted"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-sidebar-foreground-muted mt-0.5">
                            {new Date(bookmark.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteBookmark(bookmark.id)
                          }}
                          className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-sidebar-accent"
                        >
                          <X className="h-3 w-3 text-sidebar-foreground-muted" />
                        </button>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={loadBookmarks}
          disabled={isLoading}
          className="w-full justify-start text-xs text-sidebar-foreground-muted hover:text-sidebar-foreground"
        >
          <RefreshCw className={cn("h-3 w-3 mr-2", isLoading && "animate-spin")} />
          {isLoading ? 'Refreshing...' : 'Refresh bookmarks'}
        </Button>
      </div>
    </div>
  )
}
