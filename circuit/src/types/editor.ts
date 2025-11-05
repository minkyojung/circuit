/**
 * Unified Editor System Types
 *
 * VS Code-style editor groups with unified tabs for conversations and files
 */

// ============================================================================
// Tab Types
// ============================================================================

export type TabType = 'conversation' | 'file' | 'settings'

// Conversation-specific data
export interface ConversationTabData {
  conversationId: string
  workspaceId: string
  workspaceName?: string
  title?: string
  lastViewedAt?: number
  updatedAt?: number
}

// File-specific data
export interface FileTabData {
  filePath: string
  unsavedChanges?: boolean
  language?: string
}

// Settings-specific data (empty for now)
export interface SettingsTabData {
  // No additional data needed for settings tab
}

// Base tab interface
export interface BaseTab {
  id: string
  type: TabType
  title: string
}

// Conversation tab
export interface ConversationTab extends BaseTab {
  type: 'conversation'
  data: ConversationTabData
}

// File tab
export interface FileTab extends BaseTab {
  type: 'file'
  data: FileTabData
}

// Settings tab
export interface SettingsTab extends BaseTab {
  type: 'settings'
  data: SettingsTabData
}

// Union type for all tabs
export type Tab = ConversationTab | FileTab | SettingsTab

// ============================================================================
// Editor Group Types
// ============================================================================

export interface EditorGroup {
  id: string
  tabs: Tab[]
  activeTabId: string | null
}

// ============================================================================
// Tab Action Types (for reducer pattern)
// ============================================================================

export type TabAction =
  | { type: 'OPEN_TAB'; tab: Tab; groupId?: string }
  | { type: 'CLOSE_TAB'; tabId: string; groupId: string }
  | { type: 'ACTIVATE_TAB'; tabId: string; groupId: string }
  | { type: 'MOVE_TAB'; tabId: string; sourceGroupId: string; targetGroupId: string; targetIndex?: number }
  | { type: 'UPDATE_TAB'; tabId: string; groupId: string; updates: Partial<Tab> }
  | { type: 'REORDER_TABS'; groupId: string; tabIds: string[] }
  | { type: 'SPLIT_GROUP'; sourceGroupId: string; newGroupId: string }
  | { type: 'CLOSE_GROUP'; groupId: string }

// ============================================================================
// Helper Types
// ============================================================================

export interface TabDropTarget {
  groupId: string
  index?: number
}

export interface DraggedTab {
  tabId: string
  sourceGroupId: string
}

// ============================================================================
// Type Guards
// ============================================================================

export function isConversationTab(tab: Tab): tab is ConversationTab {
  return tab.type === 'conversation'
}

export function isFileTab(tab: Tab): tab is FileTab {
  return tab.type === 'file'
}

export function isSettingsTab(tab: Tab): tab is SettingsTab {
  return tab.type === 'settings'
}

// ============================================================================
// Tab Factory Functions
// ============================================================================

export function createConversationTab(
  conversationId: string,
  workspaceId: string,
  title?: string,
  workspaceName?: string
): ConversationTab {
  return {
    id: `conversation-${conversationId}`,
    type: 'conversation',
    title: title || `${workspaceName || 'Chat'}`,
    data: {
      conversationId,
      workspaceId,
      workspaceName,
      title,
      updatedAt: Date.now(),
    },
  }
}

export function createFileTab(
  filePath: string,
  title?: string,
  unsavedChanges?: boolean
): FileTab {
  // Extract filename from path if title not provided
  const fileName = title || filePath.split('/').pop() || filePath

  return {
    id: `file-${filePath}`,
    type: 'file',
    title: fileName,
    data: {
      filePath,
      unsavedChanges: unsavedChanges || false,
    },
  }
}

export function createSettingsTab(): SettingsTab {
  return {
    id: 'settings',
    type: 'settings',
    title: 'Settings',
    data: {},
  }
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_GROUP_ID = 'group-1'
export const SECONDARY_GROUP_ID = 'group-2'

export const createDefaultEditorGroups = (): EditorGroup[] => [
  { id: DEFAULT_GROUP_ID, tabs: [], activeTabId: null },
  { id: SECONDARY_GROUP_ID, tabs: [], activeTabId: null },
]
