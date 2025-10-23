/**
 * Feature Flags System
 *
 * Enables gradual rollout of new features with ability to toggle on/off
 * without code deployment. Critical for large-scale changes like history feature.
 */

export interface FeatureFlags {
  // History Feature
  historyEnabled: boolean           // Phase 1: Basic history tracking
  historyRealtime: boolean          // Phase 3: Real-time streaming
  historyAnalytics: boolean         // Phase 4: Analytics dashboard
  historyAdvancedFilters: boolean   // Phase 2: Advanced filtering

  // Tool Inspector Feature
  toolInspector: boolean            // Interactive tool testing UI
  toolReplay: boolean               // Replay previous tool calls

  // Performance Optimizations
  virtualScrolling: boolean         // Virtual scrolling for large lists
  eventBasedUpdates: boolean        // Event-based instead of polling
}

const DEFAULT_FLAGS: FeatureFlags = {
  // History - Enable basic history tracking
  historyEnabled: true,
  historyRealtime: false,
  historyAnalytics: true,  // Enable analytics for dashboard
  historyAdvancedFilters: false,

  // Tool Inspector
  toolInspector: false,
  toolReplay: false,

  // Performance
  virtualScrolling: false,
  eventBasedUpdates: false,
}

const STORAGE_KEY = 'circuit:feature-flags'

/**
 * Get current feature flags from localStorage
 * Falls back to defaults if not set
 */
export function getFeatureFlags(): FeatureFlags {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults to handle new flags
      return { ...DEFAULT_FLAGS, ...parsed }
    }
  } catch (error) {
    console.error('[FeatureFlags] Error loading flags:', error)
  }

  return { ...DEFAULT_FLAGS }
}

/**
 * Update a single feature flag
 */
export function setFeatureFlag(key: keyof FeatureFlags, value: boolean): void {
  try {
    const flags = getFeatureFlags()
    flags[key] = value
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags))

    console.log(`[FeatureFlags] ${key} = ${value}`)

    // Dispatch custom event for React components to listen
    window.dispatchEvent(new CustomEvent('circuit:feature-flags-changed', {
      detail: { key, value, flags }
    }))
  } catch (error) {
    console.error('[FeatureFlags] Error setting flag:', error)
  }
}

/**
 * Toggle a feature flag
 */
export function toggleFeatureFlag(key: keyof FeatureFlags): void {
  const flags = getFeatureFlags()
  setFeatureFlag(key, !flags[key])
}

/**
 * Reset all flags to defaults
 */
export function resetFeatureFlags(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FLAGS))
    window.dispatchEvent(new CustomEvent('circuit:feature-flags-changed', {
      detail: { flags: DEFAULT_FLAGS }
    }))
    console.log('[FeatureFlags] Reset to defaults')
  } catch (error) {
    console.error('[FeatureFlags] Error resetting flags:', error)
  }
}

/**
 * React hook for using feature flags with reactive updates
 */
export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = React.useState<FeatureFlags>(getFeatureFlags)

  React.useEffect(() => {
    const handleFlagsChanged = () => {
      setFlags(getFeatureFlags())
    }

    window.addEventListener('circuit:feature-flags-changed', handleFlagsChanged)
    return () => {
      window.removeEventListener('circuit:feature-flags-changed', handleFlagsChanged)
    }
  }, [])

  return flags
}

/**
 * React hook for using a single feature flag
 */
export function useFeatureFlag(key: keyof FeatureFlags): boolean {
  const flags = useFeatureFlags()
  return flags[key]
}

// Import React for hooks
import React from 'react'
