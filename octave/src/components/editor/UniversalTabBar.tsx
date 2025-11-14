/**
 * Universal Tab Bar Component
 *
 * Unified tab bar that handles both conversation and file tabs
 * Supports drag & drop for tab reordering and moving between groups
 */

import { useState } from 'react'
import { X, Circle, MessageCircle, Plus, Settings, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tab, ConversationTab, FileTab } from '@/types/editor'
import { isConversationTab, isFileTab, isModifiedFileTab, isSettingsTab } from '@/types/editor'
import { getIconForFile } from 'vscode-material-icon-theme-js'

// Import Material Icon Theme SVGs
import ReactTsIcon from 'material-icon-theme/icons/react_ts.svg?react'
import ReactIcon from 'material-icon-theme/icons/react.svg?react'
import TypeScriptIcon from 'material-icon-theme/icons/typescript.svg?react'
import JavaScriptIcon from 'material-icon-theme/icons/javascript.svg?react'
import JsonIcon from 'material-icon-theme/icons/nodejs.svg?react'
import CssIcon from 'material-icon-theme/icons/css.svg?react'
import ScssIcon from 'material-icon-theme/icons/sass.svg?react'
import HtmlIcon from 'material-icon-theme/icons/html.svg?react'
import MarkdownIcon from 'material-icon-theme/icons/markdown.svg?react'
import PythonIcon from 'material-icon-theme/icons/python.svg?react'
import RustIcon from 'material-icon-theme/icons/rust.svg?react'
import GoIcon from 'material-icon-theme/icons/go.svg?react'
import YamlIcon from 'material-icon-theme/icons/yaml.svg?react'
import DefaultIcon from 'material-icon-theme/icons/file.svg?react'

// Icon map
const iconComponentMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'react_ts.svg': ReactTsIcon,
  'react.svg': ReactIcon,
  'typescript.svg': TypeScriptIcon,
  'javascript.svg': JavaScriptIcon,
  'nodejs.svg': JsonIcon,
  'json.svg': JsonIcon,
  'yaml.svg': YamlIcon,
  'css.svg': CssIcon,
  'sass.svg': ScssIcon,
  'html.svg': HtmlIcon,
  'markdown.svg': MarkdownIcon,
  'python.svg': PythonIcon,
  'rust.svg': RustIcon,
  'go.svg': GoIcon,
  'file.svg': DefaultIcon,
}

const getFileIconComponent = (filename: string): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
  const iconName = getIconForFile(filename)
  if (!iconName) return DefaultIcon
  return iconComponentMap[iconName] || DefaultIcon
}

// ============================================================================
// Props
// ============================================================================

interface UniversalTabBarProps {
  groupId: string
  tabs: Tab[]
  activeTabId: string | null
  onTabClick: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onTabDragStart?: (tabId: string, groupId: string) => void
  onTabDragEnd?: () => void
  onTabDrop?: (tabId: string, targetGroupId: string, targetIndex?: number) => void
  onCreateConversation?: () => void
  showCreateButton?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function UniversalTabBar({
  groupId,
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabDragStart,
  onTabDragEnd,
  onTabDrop,
  onCreateConversation,
  showCreateButton = false,
}: UniversalTabBarProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('tabId', tabId)
    e.dataTransfer.setData('sourceGroupId', groupId)
    onTabDragStart?.(tabId, groupId)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDragOverIndex(null)
    onTabDragEnd?.()
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    const tabId = e.dataTransfer.getData('tabId')

    if (tabId) {
      onTabDrop?.(tabId, groupId, targetIndex)
    }

    setDragOverIndex(null)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the tab bar entirely
    if (e.currentTarget === e.target) {
      setDragOverIndex(null)
    }
  }

  if (tabs.length === 0) {
    return (
      <div className="flex items-center h-10 bg-card px-2 py-1" />
    )
  }

  return (
    <div
      className="flex items-center gap-0 overflow-x-auto scrollbar-thin border-b border-border bg-card px-2 py-1"
      onDragLeave={handleDragLeave}
    >
      {tabs.map((tab, index) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onClick={() => onTabClick(tab.id)}
          onClose={() => onTabClose(tab.id)}
          onDragStart={(e) => handleDragStart(e, tab.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          showDropIndicator={dragOverIndex === index}
        />
      ))}

      {/* New Conversation Button */}
      {showCreateButton && onCreateConversation && (
        <button
          onClick={onCreateConversation}
          className={cn(
            "ml-1 flex items-center justify-center",
            "w-7 h-7 rounded-md transition-all flex-shrink-0",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-secondary/50",
            "group"
          )}
          title="New conversation (Cmd+T)"
        >
          <Plus size={16} className="group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  )
}

// ============================================================================
// Tab Item Component
// ============================================================================

interface TabItemProps {
  tab: Tab
  isActive: boolean
  onClick: () => void
  onClose: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  showDropIndicator?: boolean
}

function TabItem({
  tab,
  isActive,
  onClick,
  onClose,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  showDropIndicator,
}: TabItemProps) {
  const isConversation = isConversationTab(tab)
  const isFile = isFileTab(tab)
  const isModifiedFile = isModifiedFileTab(tab)
  const isSettings = isSettingsTab(tab)

  // Get icon based on tab type
  let Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> = DefaultIcon
  if (isConversation) {
    Icon = MessageCircle as any
  } else if (isModifiedFile) {
    Icon = FileCode as any  // AI-modified file icon
  } else if (isFile) {
    Icon = getFileIconComponent(tab.data.filePath)
  } else if (isSettings) {
    Icon = Settings as any
  }

  // Check for unsaved changes (files only)
  const hasUnsavedChanges = isFile && tab.data.unsavedChanges

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2 px-2 py-[7px] transition-colors',
        'text-sm font-medium whitespace-nowrap cursor-pointer select-none',
        'rounded-md',
        isActive
          ? 'bg-secondary text-secondary-foreground'
          : 'bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground',
        showDropIndicator && 'border-l-2 border-primary',
        isModifiedFile && 'border-l-2 border-orange-500'  // AI-modified file indicator
      )}
    >
      {/* Icon */}
      <Icon className="shrink-0 w-4 h-4" />

      {/* Title */}
      <span className="max-w-[200px] truncate">{tab.title}</span>

      {/* Close button or unsaved indicator */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className={cn(
          'ml-1 w-4 h-4 flex items-center justify-center rounded transition-all flex-shrink-0',
          hasUnsavedChanges
            ? 'text-foreground hover:bg-secondary'
            : 'text-muted-foreground/40 hover:text-foreground hover:bg-secondary',
          'opacity-100'
        )}
        title={hasUnsavedChanges ? 'Unsaved changes - Click to close' : 'Close tab'}
      >
        {hasUnsavedChanges ? (
          <Circle size={8} fill="currentColor" />
        ) : (
          <X size={14} />
        )}
      </button>
    </div>
  )
}
