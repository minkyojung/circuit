/**
 * Editor Group Panel Component
 *
 * Renders the appropriate content based on active tab type
 * - Conversation tabs → ChatPanel
 * - File tabs → EditorPanel
 */

import { useMemo } from 'react'
import type { EditorGroup, Tab, ModifiedFileTabData } from '@/types/editor'
import { isConversationTab, isFileTab, isModifiedFileTab, isSettingsTab, isBrowserTab } from '@/types/editor'
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
  onCreateBrowser?: () => void

  // Content renderers
  renderConversation?: (conversationId: string, workspaceId: string) => React.ReactNode
  renderFile?: (filePath: string) => React.ReactNode
  renderModifiedFile?: (modifiedFileData: ModifiedFileTabData) => React.ReactNode
  renderSettings?: () => React.ReactNode
  renderBrowser?: (url: string, browserId: string, isActive: boolean) => React.ReactNode
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
  onCreateBrowser,
  renderConversation,
  renderFile,
  renderModifiedFile,
  renderSettings,
  renderBrowser,
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

      // Modified file tabs are visible
      if (isModifiedFileTab(tab)) return true

      // File tabs are visible
      if (isFileTab(tab)) return true

      // Settings tabs are visible
      if (isSettingsTab(tab)) return true

      // Browser tabs are visible
      if (isBrowserTab(tab)) return true

      // Default: show tab
      return true
    })
  }, [group.tabs])

  // Get active tab from visible tabs
  const activeTab = useMemo(() => {
    if (!group.activeTabId) return null
    return visibleTabs.find((t) => t.id === group.activeTabId) || null
  }, [visibleTabs, group.activeTabId])

  // Get all browser tabs (keep them mounted for WebContentsView persistence)
  const browserTabs = useMemo(() => {
    return visibleTabs.filter(isBrowserTab)
  }, [visibleTabs])

  // Render content based on active tab type
  const renderContent = () => {
    if (!activeTab) {
      if (renderEmpty) {
        return renderEmpty()
      }
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <p className="text-sm font-normal">Start new conversation or select file</p>
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

    // Modified file tab (AI-edited files)
    if (isModifiedFileTab(activeTab)) {
      if (!renderModifiedFile) {
        return (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Modified file renderer not provided</p>
          </div>
        )
      }
      return renderModifiedFile(activeTab.data)
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

    // Browser tab - handled separately (always mounted)
    if (isBrowserTab(activeTab)) {
      return null // Browser tabs are rendered separately below
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
          onCreateBrowser={onCreateBrowser}
          showCreateButton={!!currentWorkspaceId}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 relative">
        {/* Non-browser active tab content */}
        {activeTab && !isBrowserTab(activeTab) && (
          <div className="h-full w-full">
            {renderContent()}
          </div>
        )}

        {/* All browser tabs (always mounted for WebContentsView persistence) */}
        {browserTabs.map((tab) => (
          <div
            key={tab.id}
            className="h-full w-full absolute inset-0 flex flex-col"
            style={{
              display: tab.id === group.activeTabId ? 'flex' : 'none',
            }}
          >
            {renderBrowser ? (
              renderBrowser(tab.data.url, tab.id, tab.id === group.activeTabId)
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>Browser renderer not provided</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
