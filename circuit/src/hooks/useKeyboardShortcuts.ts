/**
 * useKeyboardShortcuts
 * Global keyboard shortcut management system
 *
 * Apple HIG principles:
 * - Standard shortcuts (Cmd+N, Cmd+K, etc.)
 * - Escape always cancels/closes
 * - Visual feedback for all shortcuts
 */

import { useEffect, useCallback } from 'react'

export type ShortcutKey = string

export interface ShortcutHandler {
  handler: (event: KeyboardEvent) => void
  description?: string
  enabled?: boolean
}

export type ShortcutHandlers = Record<ShortcutKey, ShortcutHandler>

/**
 * Convert KeyboardEvent to shortcut string
 * Examples:
 * - Cmd+N → 'cmd+n'
 * - Cmd+Shift+F → 'cmd+shift+f'
 * - Escape → 'escape'
 */
function getShortcutKey(event: KeyboardEvent): string {
  const parts: string[] = []

  // macOS uses metaKey (Cmd), Windows/Linux use ctrlKey
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modifier = isMac ? event.metaKey : event.ctrlKey

  if (modifier) parts.push(isMac ? 'cmd' : 'ctrl')
  if (event.shiftKey) parts.push('shift')
  if (event.altKey) parts.push('alt')

  // Normalize key name
  const key = event.key.toLowerCase()

  // Handle special keys
  if (key === 'escape') return 'escape'
  if (key === 'enter') return 'enter'
  if (key === 'tab') return 'tab'
  if (key === ' ') return 'space'
  if (key === 'arrowup') return 'up'
  if (key === 'arrowdown') return 'down'
  if (key === 'arrowleft') return 'left'
  if (key === 'arrowright') return 'right'

  // Regular key
  parts.push(key)

  return parts.join('+')
}

/**
 * Global keyboard shortcut hook
 *
 * Usage:
 * ```tsx
 * useKeyboardShortcuts({
 *   'cmd+n': {
 *     handler: () => createNewWorkspace(),
 *     description: 'New workspace',
 *   },
 *   'cmd+k': {
 *     handler: () => openCommandPalette(),
 *     description: 'Command palette',
 *   },
 * })
 * ```
 */
export function useKeyboardShortcuts(shortcuts: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const shortcutKey = getShortcutKey(event)
      const shortcut = shortcuts[shortcutKey]

      if (shortcut && shortcut.enabled !== false) {
        // Prevent default browser behavior for known shortcuts
        event.preventDefault()
        event.stopPropagation()

        // Execute handler
        shortcut.handler(event)
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [handleKeyDown])
}

/**
 * Hook for conditional shortcuts (e.g., dialog-specific)
 *
 * Usage:
 * ```tsx
 * useConditionalShortcut('escape', () => closeDialog(), isDialogOpen)
 * ```
 */
export function useConditionalShortcut(
  key: ShortcutKey,
  handler: () => void,
  enabled: boolean = true
) {
  useKeyboardShortcuts({
    [key]: {
      handler,
      enabled,
    },
  })
}

/**
 * Get platform-specific modifier key name
 */
export function getModifierKeyName(): 'Cmd' | 'Ctrl' {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? 'Cmd' : 'Ctrl'
}

/**
 * Format shortcut for display in UI
 * Example: 'cmd+shift+f' → 'Cmd+Shift+F'
 */
export function formatShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map((part) => {
      if (part === 'cmd') return getModifierKeyName()
      if (part === 'ctrl') return 'Ctrl'
      if (part === 'shift') return 'Shift'
      if (part === 'alt') return 'Alt'
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('+')
}
