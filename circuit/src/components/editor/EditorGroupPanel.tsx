/**
 * Editor Group Panel Component
 *
 * Renders the appropriate content based on active tab type
 * - Conversation tabs → ChatPanel
 * - File tabs → EditorPanel
 */

import { useMemo } from 'react'
import type { EditorGroup, Tab } from '@/types/editor'
import { isConversationTab, isFileTab } from '@/types/editor'
import { UniversalTabBar } from './UniversalTabBar'
import { cn } from '@/lib/utils'

// Import content panels (will be passed as props to avoid circular dependencies)
interface EditorGroupPanelProps {
  group: EditorGroup
  isFocused?: boolean
  onFocus?: () => void
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onTabDragStart?: (tabId: string, groupId: string) => void
  onTabDragEnd?: () => void
  onTabDrop?: (tabId: string, targetIndex?: number) => void

  // Content renderers
  renderConversation?: (conversationId: string, workspaceId: string) => React.ReactNode
  renderFile?: (filePath: string) => React.ReactNode
  renderEmpty?: () => React.ReactNode

  // Optional styling
  className?: string
}

export function EditorGroupPanel({
  group,
  isFocused = true,
  onFocus,
  onTabClick,
  onTabClose,
  onTabDragStart,
  onTabDragEnd,
  onTabDrop,
  renderConversation,
  renderFile,
  renderEmpty,
  className,
}: EditorGroupPanelProps) {
  // Get active tab
  const activeTab = useMemo(() => {
    if (!group.activeTabId) return null
    return group.tabs.find((t) => t.id === group.activeTabId) || null
  }, [group.tabs, group.activeTabId])

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

    // Unknown tab type
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Unknown tab type: {activeTab.type}</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'h-full flex flex-col transition-all',
        isFocused && 'ring-2 ring-blue-500/50 ring-inset',
        className
      )}
      onClick={onFocus}
    >
      {/* Tab Bar */}
      <UniversalTabBar
        groupId={group.id}
        tabs={group.tabs}
        activeTabId={group.activeTabId}
        onTabClick={onTabClick}
        onTabClose={onTabClose}
        onTabDragStart={onTabDragStart}
        onTabDragEnd={onTabDragEnd}
        onTabDrop={onTabDrop}
      />

      {/* Content Area */}
      <div className="flex-1 min-h-0">
        {renderContent()}
      </div>
    </div>
  )
}
