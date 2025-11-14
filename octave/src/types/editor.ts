/**
 * Unified Editor System Types
 *
 * VS Code-style editor groups with unified tabs for conversations and files
 */

// ============================================================================
// Tab Types
// ============================================================================

export type TabType = 'conversation' | 'file' | 'settings' | 'modified-file'

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
  filePath: string         // Workspace-relative path (e.g., "src/App.tsx")
  workspaceId: string      // Workspace identifier (e.g., "duck", "swan")
  unsavedChanges?: boolean
  language?: string
}

// Modified file-specific data (AI-edited files)
export interface ModifiedFileTabData {
  filePath: string                // Workspace-relative path
  workspaceId: string             // Workspace identifier
  conversationId: string          // Which conversation modified this file
  changeType: 'created' | 'modified' | 'deleted'
  additions: number               // Number of lines added
  deletions: number               // Number of lines deleted
  diffLines?: Array<{            // Line-by-line diff data
    type: 'add' | 'remove' | 'unchanged'
    content: string
  }>
  oldContent?: string             // Original content (for diff)
  newContent?: string             // Modified content
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

// Modified file tab (AI-edited files)
export interface ModifiedFileTab extends BaseTab {
  type: 'modified-file'
  data: ModifiedFileTabData
}

// Settings tab
export interface SettingsTab extends BaseTab {
  type: 'settings'
  data: SettingsTabData
}

// Union type for all tabs
export type Tab = ConversationTab | FileTab | ModifiedFileTab | SettingsTab

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

export function isModifiedFileTab(tab: Tab): tab is ModifiedFileTab {
  return tab.type === 'modified-file'
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

/**
 * Create a file tab
 *
 * IMPORTANT: filePath MUST be pre-normalized by PathResolver
 * This function does NOT perform path normalization
 *
 * @param filePath - Workspace-relative path (e.g., "src/App.tsx")
 * @param workspaceId - Workspace identifier (e.g., "duck", "swan")
 * @param title - Display title (defaults to filename)
 * @param unsavedChanges - Whether file has unsaved changes
 */
export function createFileTab(
  filePath: string,
  workspaceId: string,
  title?: string,
  unsavedChanges?: boolean
): FileTab {
  // Extract filename from path if title not provided
  const fileName = title || filePath.split('/').pop() || filePath

  return {
    id: `file-${workspaceId}-${filePath}`,  // Globally unique: workspace + path
    type: 'file',
    title: fileName,
    data: {
      filePath,
      workspaceId,
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

/**
 * Create a modified file tab (AI-edited file)
 *
 * @param filePath - Workspace-relative path
 * @param workspaceId - Workspace identifier
 * @param conversationId - Conversation that modified this file
 * @param changeType - Type of change (created/modified/deleted)
 * @param additions - Number of lines added
 * @param deletions - Number of lines deleted
 * @param diffLines - Line-by-line diff data
 */
export function createModifiedFileTab(
  filePath: string,
  workspaceId: string,
  conversationId: string,
  changeType: 'created' | 'modified' | 'deleted',
  additions: number,
  deletions: number,
  diffLines?: Array<{ type: 'add' | 'remove' | 'unchanged'; content: string }>,
  oldContent?: string,
  newContent?: string
): ModifiedFileTab {
  // Extract filename from path
  const fileName = filePath.split('/').pop() || filePath

  return {
    id: `modified-file-${workspaceId}-${conversationId}-${filePath}`,
    type: 'modified-file',
    title: fileName,
    data: {
      filePath,
      workspaceId,
      conversationId,
      changeType,
      additions,
      deletions,
      diffLines,
      oldContent,
      newContent,
    },
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
