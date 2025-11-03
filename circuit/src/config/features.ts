/**
 * Feature Flags Configuration
 *
 * Controls which features are enabled/disabled in the application.
 * Use environment variables to toggle features without code changes.
 */

export const FEATURES = {
  /**
   * Plan Mode - AI-powered task planning with automatic todo generation
   *
   * When enabled: Shows Plan Mode toggle button in chat input
   * When disabled: Plan Mode button is hidden, feature is completely disabled
   *
   * Environment variable: VITE_FEATURE_PLAN_MODE
   * Default: false (disabled in production)
   */
  PLAN_MODE: import.meta.env.VITE_FEATURE_PLAN_MODE === 'true',
} as const

export type FeatureFlags = typeof FEATURES

/**
 * Development-only feature check
 * Returns true if running in development mode
 */
export const isDevelopment = import.meta.env.DEV

/**
 * Helper to check if a feature is enabled
 * Usage: isFeatureEnabled('PLAN_MODE')
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return FEATURES[feature]
}
