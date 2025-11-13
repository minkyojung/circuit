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
export type CompletionSound = 'none' | 'subtle' | 'classic' | 'modern';
export type ThemeMode = 'light' | 'dark' | 'system';
export type CompactMode = 'immediate' | 'idle' | 'prompt';
export type TerminalMode = 'classic' | 'modern';
export type TerminalRenderer = 'canvas' | 'webgl' | 'dom';
export type AIMode = 'fast' | 'balanced' | 'accurate';

/**
 * Monaco Editor AI settings
 * Controls AI-powered features in the code editor
 */
export interface MonacoAISettings {
  // Feature toggles
  enableAutocompletion: boolean;    // AI-powered Tab completion
  enableHover: boolean;              // AI code explanations on hover
  enableInlineSuggestions: boolean;  // Show inline AI suggestions

  // Performance settings
  aiMode: AIMode;                    // Speed vs accuracy tradeoff
  completionDelay: number;           // Delay before showing completion (ms)

  // Advanced
  cacheCompletions: boolean;         // Cache frequent completions
  maxTokens: number;                 // Max tokens for completions
}

/**
 * Terminal settings
 * Controls terminal mode and features
 */
export interface TerminalSettings {
  // Terminal mode (classic xterm.js vs modern Warp-style)
  mode: TerminalMode;

  // Rendering engine
  renderer: TerminalRenderer;

  // Modern mode features (Warp-style)
  modernFeatures: {
    enableBlocks: boolean;              // Group commands and outputs as blocks
    enableEnhancedInput: boolean;       // Monaco-based input editor
    showTimestamps: boolean;            // Show command execution timestamps
    highlightFailedCommands: boolean;   // Highlight blocks with non-zero exit codes
    enableWorkflows: boolean;           // Save and execute command workflows
  };

  // Classic mode features
  classicFeatures: {
    scrollback: number;                 // Number of lines to keep in history
    cursorBlink: boolean;               // Enable cursor blinking
    fontSize: number;                   // Font size in pixels
  };
}

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

  // Monaco Editor AI features
  monaco: MonacoAISettings;

  // Terminal configuration
  terminal: TerminalSettings;

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
    completionSound: 'subtle',
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
  monaco: {
    enableAutocompletion: true,
    enableHover: true,
    enableInlineSuggestions: true,
    aiMode: 'fast', // Default to fast (10-15% accuracy loss acceptable)
    completionDelay: 300, // 300ms delay
    cacheCompletions: true,
    maxTokens: 150, // Keep completions concise
  },
  terminal: {
    mode: 'classic', // Start with classic mode for safety
    renderer: 'canvas', // Canvas for transparency support
    modernFeatures: {
      enableBlocks: true,
      enableEnhancedInput: true,
      showTimestamps: true,
      highlightFailedCommands: true,
      enableWorkflows: false, // Enable later when implemented
    },
    classicFeatures: {
      scrollback: 1000,
      cursorBlink: true,
      fontSize: 12,
    },
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
