/**
 * useAutoCompact Hook
 *
 * Monitors context usage and triggers compact warnings/recommendations
 * based on configurable thresholds
 *
 * Features:
 * - Multi-level warnings (warning, recommend, urgent)
 * - User idle detection
 * - Cooldown between notifications
 * - Dismissible warnings
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import type { ContextMetrics } from '@/types/metrics';

export type CompactLevel = 'normal' | 'warning' | 'recommend' | 'urgent';

interface CompactState {
  level: CompactLevel;
  lastNotified: number | null;
  userDismissed: boolean;
}

interface UseAutoCompactOptions {
  workspaceId?: string;
  workspacePath?: string;
  context: ContextMetrics | null; // Now required, not optional
}

interface UseAutoCompactReturn {
  // State
  compactState: CompactState;
  isUserIdle: boolean;
  percentage: number;

  // UI flags
  shouldShowBanner: boolean;
  shouldShowModal: boolean;
  shouldBlockSending: boolean;

  // Actions
  dismissWarning: () => void;
  openClaudeCode: () => void;
  copyCompactCommand: () => void;
}

/**
 * Auto-compact hook
 *
 * @example
 * const {
 *   compactState,
 *   shouldShowBanner,
 *   dismissWarning,
 *   copyCompactCommand
 * } = useAutoCompact({
 *   workspaceId: workspace.id,
 *   workspacePath: workspace.path
 * });
 */
export function useAutoCompact(options: UseAutoCompactOptions): UseAutoCompactReturn {
  const { workspaceId, workspacePath, context } = options;
  const { settings } = useSettingsContext();

  const [compactState, setCompactState] = useState<CompactState>({
    level: 'normal',
    lastNotified: null,
    userDismissed: false,
  });

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isUserIdle, setIsUserIdle] = useState(false);

  // ============================================================================
  // User Idle Detection
  // ============================================================================

  useEffect(() => {
    if (!settings.context.enabled || !settings.context.autoPromptWhenIdle) {
      return;
    }

    const resetIdleTimer = () => {
      setIsUserIdle(false);

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = setTimeout(() => {
        setIsUserIdle(true);
      }, settings.context.idleTimeMinutes * 60 * 1000);
    };

    // Track user activity
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);

    resetIdleTimer();

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [settings.context.enabled, settings.context.autoPromptWhenIdle, settings.context.idleTimeMinutes]);

  // ============================================================================
  // Determine Compact Level
  // ============================================================================

  useEffect(() => {
    if (!context || !settings.context.enabled) {
      setCompactState(prev => ({ ...prev, level: 'normal' }));
      return;
    }

    const { percentage } = context;
    const { warningThreshold, recommendThreshold, urgentThreshold } = settings.context;

    let newLevel: CompactLevel = 'normal';

    if (percentage >= urgentThreshold) {
      newLevel = 'urgent';
    } else if (percentage >= recommendThreshold) {
      newLevel = 'recommend';
    } else if (percentage >= warningThreshold) {
      newLevel = 'warning';
    }

    setCompactState(prev => {
      // Reset dismissed flag if level increased
      const shouldResetDismissed = newLevel !== 'normal' && newLevel !== prev.level;

      return {
        ...prev,
        level: newLevel,
        userDismissed: shouldResetDismissed ? false : prev.userDismissed,
      };
    });
  }, [context?.percentage, settings.context]);

  // ============================================================================
  // Trigger Notifications
  // ============================================================================

  useEffect(() => {
    // Don't notify if normal level or user dismissed
    if (compactState.level === 'normal' || compactState.userDismissed) {
      return;
    }

    // Don't notify if notifications disabled
    if (!settings.context.showNotifications) {
      return;
    }

    // Check cooldown
    const now = Date.now();
    const cooldown = settings.context.cooldownMinutes * 60 * 1000;

    if (compactState.lastNotified && (now - compactState.lastNotified) < cooldown) {
      return;
    }

    // For non-urgent levels, wait until user is idle
    if (compactState.level !== 'urgent' && settings.context.autoPromptWhenIdle && !isUserIdle) {
      return;
    }

    // Trigger notification
    triggerCompactNotification(compactState.level, context?.percentage || 0);

    setCompactState(prev => ({
      ...prev,
      lastNotified: now,
    }));
  }, [compactState.level, compactState.userDismissed, compactState.lastNotified, isUserIdle, settings.context, context?.percentage]);

  // ============================================================================
  // Notification Function
  // ============================================================================

  const triggerCompactNotification = useCallback((level: CompactLevel, percentage: number) => {
    if (level === 'normal') return; // Skip notification for normal level

    const messages: Record<Exclude<CompactLevel, 'normal'>, { title: string; body: string }> = {
      warning: {
        title: 'Context Warning',
        body: `Session context at ${percentage.toFixed(0)}%. Consider compacting soon.`,
      },
      recommend: {
        title: 'Compact Recommended',
        body: `Session context at ${percentage.toFixed(0)}%. Time to compact!`,
      },
      urgent: {
        title: 'Compact Urgently Needed',
        body: `Session context critically full (${percentage.toFixed(0)}%). Run /compact in Claude Code now.`,
      },
    };

    const message = messages[level];

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(message.title, {
        body: message.body,
        icon: '/icon.png',
        tag: 'circuit-compact', // Replace previous notification
        requireInteraction: level === 'urgent', // Stay until dismissed for urgent
      });
    }

    // Request permission if not granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Electron IPC notification (if available)
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('show-notification', {
        title: message.title,
        body: message.body,
        urgency: level === 'urgent' ? 'critical' : 'normal',
      });
    }
  }, []);

  // ============================================================================
  // Action Functions
  // ============================================================================

  const dismissWarning = useCallback(() => {
    setCompactState(prev => ({ ...prev, userDismissed: true }));
  }, []);

  const openClaudeCode = useCallback(() => {
    if (window.electron?.ipcRenderer && workspacePath) {
      // Try to open Claude Code terminal at workspace path
      window.electron.ipcRenderer.send('open-claude-code', {
        workspaceId,
        workspacePath,
      });
    } else {
      // Fallback: copy instructions
      console.log('[useAutoCompact] Opening Claude Code not available');
    }
  }, [workspaceId, workspacePath]);

  const copyCompactCommand = useCallback(() => {
    navigator.clipboard.writeText('/compact').then(
      () => {
        console.log('[useAutoCompact] /compact command copied to clipboard');
      },
      (err) => {
        console.error('[useAutoCompact] Failed to copy command:', err);
      }
    );
  }, []);

  // ============================================================================
  // Return Values
  // ============================================================================

  const percentage = context?.percentage || 0;

  return {
    // State
    compactState,
    isUserIdle,
    percentage,

    // UI flags
    shouldShowBanner: compactState.level !== 'normal' && !compactState.userDismissed && settings.context.showBanners,
    shouldShowModal: compactState.level === 'urgent' && !compactState.userDismissed && settings.context.showModals,
    shouldBlockSending: compactState.level === 'urgent' && settings.context.blockSendingAtUrgent,

    // Actions
    dismissWarning,
    openClaudeCode,
    copyCompactCommand,
  };
}
