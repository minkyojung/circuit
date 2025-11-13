/**
 * Editor Group Panel Component
 *
 * Renders the appropriate content based on active tab type
 * - Conversation tabs → ChatPanel
 * - File tabs → EditorPanel
 */

import { useMemo } from 'react'
import type { EditorGroup, Tab } from '@/types/editor'
import { isConversationTab, isFileTab, isSettingsTab } from '@/types/editor'
import { UniversalTabBar } from './UniversalTabBar'
import { cn } from '@/lib/utils'

// Import content panels (will be passed as props to avoid circular dependencies)
interface EditorGroupPanelProps {
  group: EditorGroup
  currentWorkspaceId?: string | null
  isFocused?: boolean
  onFocus?: () => void
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onTabDragStart?: (tabId: string, groupId: string) => void
  onTabDragEnd?: () => void
  onTabDrop?: (tabId: string, targetIndex?: number) => void
  onCreateConversation?: () => void

  // Content renderers
  renderConversation?: (conversationId: string, workspaceId: string) => React.ReactNode
  renderFile?: (filePath: string) => React.ReactNode
  renderSettings?: () => React.ReactNode
  renderEmpty?: () => React.ReactNode

  // Optional styling
  className?: string
}

export function EditorGroupPanel({
  group,
  currentWorkspaceId,
  isFocused = true,
  onFocus,
  onTabClick,
  onTabClose,
  onTabDragStart,
  onTabDragEnd,
  onTabDrop,
  onCreateConversation,
  renderConversation,
  renderFile,
  renderSettings,
  renderEmpty,
  className,
}: EditorGroupPanelProps) {
  // Wrap onTabDragStart to include groupId
  const handleTabDragStart = (tabId: string) => {
    onTabDragStart?.(tabId, group.id)
  }

  // Wrap onTabDrop - groupId is already included by UniversalTabBar
  const handleTabDrop = (tabId: string, targetGroupId: string, targetIndex?: number) => {
    onTabDrop?.(tabId, targetIndex)
  }

  // Filter tabs: exclude conversation tabs (now managed by left sidebar)
  const visibleTabs = useMemo(() => {
    return group.tabs.filter((tab) => {
      // Conversation tabs are hidden (managed by left sidebar)
      if (isConversationTab(tab)) return false

      // File tabs are visible
      if (isFileTab(tab)) return true

      // Settings tabs are visible
      if (isSettingsTab(tab)) return true

      // Default: show tab
      return true
    })
  }, [group.tabs])

  // Get active tab from visible tabs
  const activeTab = useMemo(() => {
    if (!group.activeTabId) return null
    return visibleTabs.find((t) => t.id === group.activeTabId) || null
  }, [visibleTabs, group.activeTabId])

  // Render content based on active tab type
  const renderContent = () => {
    if (!activeTab) {
      if (renderEmpty) {
        return renderEmpty()
      }
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p>No tabs open</p>
            <p className="text-xs mt-2">Open a conversation or file to get started</p>
          </div>
        </div>
      )
    }

    // Conversation tab
    if (isConversationTab(activeTab)) {
      if (!renderConversation) {
        return (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Conversation renderer not provided</p>
          </div>
        )
      }
      return renderConversation(
        activeTab.data.conversationId,
        activeTab.data.workspaceId
      )
    }

    // File tab
    if (isFileTab(activeTab)) {
      if (!renderFile) {
        return (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>File renderer not provided</p>
          </div>
        )
      }
      return renderFile(activeTab.data.filePath)
    }

    // Settings tab
    if (isSettingsTab(activeTab)) {
      if (!renderSettings) {
        return (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Settings renderer not provided</p>
          </div>
        )
      }
      return renderSettings()
    }

    // Unknown tab type (should never reach here)
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Unknown tab type</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'h-full w-full flex flex-col transition-all overflow-hidden',
        className
      )}
      onClick={() => onFocus?.()}
    >
      {/* Tab Bar with focus-based opacity */}
      <div className={cn('transition-opacity', !isFocused && 'opacity-40')}>
        <UniversalTabBar
          groupId={group.id}
          tabs={visibleTabs}
          activeTabId={group.activeTabId}
          onTabClick={onTabClick}
          onTabClose={onTabClose}
          onTabDragStart={handleTabDragStart}
          onTabDragEnd={onTabDragEnd}
          onTabDrop={handleTabDrop}
          onCreateConversation={onCreateConversation}
          showCreateButton={!!currentWorkspaceId}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0">
        {renderContent()}
      </div>
    </div>
  )
}
