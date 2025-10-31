/**
 * Circuit Settings Type Definitions
 *
 * Comprehensive settings structure for all Circuit features
 */

export type ClaudeModel =
  | 'claude-sonnet-4-5-20250929'
  | 'claude-opus-4-20250514'
  | 'claude-haiku-4-20250918';

export type SendKeyCombo = 'enter' | 'cmd-enter' | 'shift-enter';
export type CompletionSound = 'chime' | 'ding' | 'pop' | 'none';
export type ThemeMode = 'light' | 'dark' | 'system';
export type CompactMode = 'immediate' | 'idle' | 'prompt';

/**
 * Auto-compact settings
 * Controls when and how context compacting is triggered
 */
export interface AutoCompactSettings {
  enabled: boolean;

  // Thresholds for different warning levels
  warningThreshold: number;      // 70% - Yellow warning
  recommendThreshold: number;    // 80% - Orange recommendation
  urgentThreshold: number;       // 90% - Red urgent

  // Notification preferences
  showNotifications: boolean;     // System notifications
  showBanners: boolean;           // In-app banner
  showModals: boolean;            // Urgent modal dialog
  blockSendingAtUrgent: boolean;  // Prevent sending at 90%

  // Smart timing
  autoPromptWhenIdle: boolean;    // Wait for user idle before prompting
  idleTimeMinutes: number;        // Minutes of inactivity = idle
  cooldownMinutes: number;        // Minimum time between notifications

  // Integration
  openClaudeCodeAutomatically: boolean;  // Auto-open Claude Code terminal
  copyCommandToClipboard: boolean;       // Auto-copy /compact command
}

/**
 * Complete Circuit settings structure
 */
export interface CircuitSettings {
  // Model configuration
  model: {
    default: ClaudeModel;
  };

  // Theme settings
  theme: {
    mode: ThemeMode;
  };

  // Notification preferences
  notifications: {
    sessionComplete: boolean;
  };

  // Sound effects
  sounds: {
    completionSound: CompletionSound;
    volume: number; // 0-100
  };

  // Input behavior
  input: {
    sendWith: SendKeyCombo;
  };

  // AI behavior modifications
  aiBehavior: {
    stripAbsoluteAgreement: boolean;
  };

  // Attachment handling
  attachments: {
    autoConvertLongText: boolean;
    threshold: number; // Character count threshold
  };

  // Context management (auto-compact)
  context: AutoCompactSettings;
}

/**
 * Default settings values
 * These are the initial settings when user first opens Circuit
 */
export const defaultSettings: CircuitSettings = {
  model: {
    default: 'claude-sonnet-4-5-20250929',
  },
  theme: {
    mode: 'system',
  },
  notifications: {
    sessionComplete: true,
  },
  sounds: {
    completionSound: 'chime',
    volume: 50,
  },
  input: {
    sendWith: 'cmd-enter',
  },
  aiBehavior: {
    stripAbsoluteAgreement: false,
  },
  attachments: {
    autoConvertLongText: true,
    threshold: 5000,
  },
  context: {
    enabled: true,
    warningThreshold: 70,
    recommendThreshold: 80,
    urgentThreshold: 90,
    showNotifications: true,
    showBanners: true,
    showModals: true,
    blockSendingAtUrgent: false,
    autoPromptWhenIdle: true,
    idleTimeMinutes: 5,
    cooldownMinutes: 10,
    openClaudeCodeAutomatically: false,
    copyCommandToClipboard: true,
  },
};

/**
 * Settings version for migration
 * Increment when settings structure changes
 */
export const SETTINGS_VERSION = 1;

/**
 * Settings storage key
 */
export const SETTINGS_STORAGE_KEY = 'circuit-settings';
