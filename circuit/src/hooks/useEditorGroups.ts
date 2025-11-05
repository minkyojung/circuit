/**
 * useEditorGroups Hook
 *
 * Centralized state management for editor groups and tabs
 * VS Code-style editor group management
 */

import { useState, useCallback } from 'react'
import type {
  EditorGroup,
  Tab,
  TabAction,
  ConversationTab,
  FileTab,
  createDefaultEditorGroups,
} from '@/types/editor'
import { DEFAULT_GROUP_ID } from '@/types/editor'

export function useEditorGroups(initialGroups?: EditorGroup[]) {
  const [editorGroups, setEditorGroups] = useState<EditorGroup[]>(
    initialGroups || [
      { id: DEFAULT_GROUP_ID, tabs: [], activeTabId: null },
    ]
  )

  // ============================================================================
  // Tab Actions
  // ============================================================================

  /**
   * Open a tab in the specified group (or default group)
   * If tab already exists in the group, activate it
   */
  const openTab = useCallback((tab: Tab, groupId?: string) => {
    setEditorGroups((prev) => {
      const targetGroupId = groupId || DEFAULT_GROUP_ID
      const newGroups = prev.map((group) => {
        if (group.id !== targetGroupId) return group

        // Check if tab already exists
        const existingTabIndex = group.tabs.findIndex((t) => t.id === tab.id)

        if (existingTabIndex >= 0) {
          // Tab exists, just activate it
          return {
            ...group,
            activeTabId: tab.id,
          }
        }

        // Add new tab
        return {
          ...group,
          tabs: [...group.tabs, tab],
          activeTabId: tab.id,
        }
      })

      return newGroups
    })
  }, [])

  /**
   * Close a tab in the specified group
   */
  const closeTab = useCallback((tabId: string, groupId: string) => {
    setEditorGroups((prev) => {
      // Prevent closing the last tab - always keep at least one tab open
      const totalTabCount = prev.reduce((sum, g) => sum + g.tabs.length, 0)
      if (totalTabCount <= 1) {
        console.log('[useEditorGroups] Cannot close last tab - at least one tab must remain open')
        return prev
      }

      return prev.map((group) => {
        if (group.id !== groupId) return group

        const newTabs = group.tabs.filter((t) => t.id !== tabId)
        let newActiveTabId = group.activeTabId

        // If we closed the active tab, activate another one
        if (group.activeTabId === tabId) {
          const closedTabIndex = group.tabs.findIndex((t) => t.id === tabId)
          if (newTabs.length > 0) {
            // Activate the tab to the right, or the one to the left if at the end
            const nextIndex = Math.min(closedTabIndex, newTabs.length - 1)
            newActiveTabId = newTabs[nextIndex]?.id || null
          } else {
            newActiveTabId = null
          }
        }

        return {
          ...group,
          tabs: newTabs,
          activeTabId: newActiveTabId,
        }
      })
    })
  }, [])

  /**
   * Activate a tab in the specified group
   */
  const activateTab = useCallback((tabId: string, groupId: string) => {
    setEditorGroups((prev) => {
      return prev.map((group) => {
        if (group.id !== groupId) return group

        // Verify tab exists
        const tabExists = group.tabs.some((t) => t.id === tabId)
        if (!tabExists) return group

        return {
          ...group,
          activeTabId: tabId,
        }
      })
    })
  }, [])

  /**
   * Move a tab from one group to another
   */
  const moveTab = useCallback(
    (tabId: string, sourceGroupId: string, targetGroupId: string, targetIndex?: number) => {
      setEditorGroups((prev) => {
        let tabToMove: Tab | null = null

        // Step 1: Remove tab from source group
        const groupsAfterRemoval = prev.map((group) => {
          if (group.id !== sourceGroupId) return group

          const tab = group.tabs.find((t) => t.id === tabId)
          if (tab) tabToMove = tab

          const newTabs = group.tabs.filter((t) => t.id !== tabId)
          let newActiveTabId = group.activeTabId

          // If we removed the active tab, activate another one
          if (group.activeTabId === tabId && newTabs.length > 0) {
            newActiveTabId = newTabs[0].id
          } else if (newTabs.length === 0) {
            newActiveTabId = null
          }

          return {
            ...group,
            tabs: newTabs,
            activeTabId: newActiveTabId,
          }
        })

        if (!tabToMove) return prev

        // Step 2: Add tab to target group
        const finalGroups = groupsAfterRemoval.map((group) => {
          if (group.id !== targetGroupId) return group

          const newTabs = [...group.tabs]
          const insertIndex = targetIndex ?? newTabs.length
          newTabs.splice(insertIndex, 0, tabToMove!)

          return {
            ...group,
            tabs: newTabs,
            activeTabId: tabToMove!.id, // Activate the moved tab
          }
        })

        return finalGroups
      })
    },
    []
  )

  /**
   * Update tab properties (e.g., unsaved changes, title)
   */
  const updateTab = useCallback(
    (tabId: string, groupId: string, updates: Partial<Tab>) => {
      setEditorGroups((prev) => {
        return prev.map((group) => {
          if (group.id !== groupId) return group

          return {
            ...group,
            tabs: group.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, ...updates } : tab
            ),
          }
        })
      })
    },
    []
  )

  /**
   * Reorder tabs within a group
   */
  const reorderTabs = useCallback((groupId: string, tabIds: string[]) => {
    setEditorGroups((prev) => {
      return prev.map((group) => {
        if (group.id !== groupId) return group

        // Create new tab order based on tabIds
        const reorderedTabs = tabIds
          .map((id) => group.tabs.find((t) => t.id === id))
          .filter((t): t is Tab => t !== undefined)

        return {
          ...group,
          tabs: reorderedTabs,
        }
      })
    })
  }, [])

  // ============================================================================
  // Group Actions
  // ============================================================================

  /**
   * Add a new editor group
   */
  const addGroup = useCallback((groupId: string) => {
    setEditorGroups((prev) => {
      // Check if group already exists
      if (prev.some((g) => g.id === groupId)) return prev

      return [
        ...prev,
        { id: groupId, tabs: [], activeTabId: null },
      ]
    })
  }, [])

  /**
   * Remove an editor group
   */
  const removeGroup = useCallback((groupId: string) => {
    setEditorGroups((prev) => {
      // Don't allow removing the last group
      if (prev.length <= 1) return prev

      return prev.filter((g) => g.id !== groupId)
    })
  }, [])

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Find a tab by ID across all groups
   */
  const findTab = useCallback(
    (tabId: string): { tab: Tab; groupId: string } | null => {
      for (const group of editorGroups) {
        const tab = group.tabs.find((t) => t.id === tabId)
        if (tab) return { tab, groupId: group.id }
      }
      return null
    },
    [editorGroups]
  )

  /**
   * Get active tab for a specific group
   */
  const getActiveTab = useCallback(
    (groupId: string): Tab | null => {
      const group = editorGroups.find((g) => g.id === groupId)
      if (!group || !group.activeTabId) return null

      return group.tabs.find((t) => t.id === group.activeTabId) || null
    },
    [editorGroups]
  )

  /**
   * Check if a tab is already open in any group
   */
  const isTabOpen = useCallback(
    (tabId: string): boolean => {
      return editorGroups.some((group) => group.tabs.some((t) => t.id === tabId))
    },
    [editorGroups]
  )

  /**
   * Get all tabs across all groups
   */
  const getAllTabs = useCallback((): Tab[] => {
    return editorGroups.flatMap((group) => group.tabs)
  }, [editorGroups])

  // ============================================================================
  // Return API
  // ============================================================================

  return {
    // State
    editorGroups,

    // Tab Actions
    openTab,
    closeTab,
    activateTab,
    moveTab,
    updateTab,
    reorderTabs,

    // Group Actions
    addGroup,
    removeGroup,

    // Utilities
    findTab,
    getActiveTab,
    isTabOpen,
    getAllTabs,
  }
}
