/**
 * useSettings Hook
 *
 * Manages Circuit settings with localStorage persistence
 * Provides type-safe settings access and updates
 */

import { useState, useEffect, useCallback } from 'react';
import type { OctaveSettings } from '@/types/settings';
import { defaultSettings, SETTINGS_STORAGE_KEY, SETTINGS_VERSION } from '@/types/settings';

interface StoredSettings {
  version: number;
  settings: OctaveSettings;
}

/**
 * Load settings from localStorage with migration support
 */
function loadSettings(): OctaveSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) {
      return defaultSettings;
    }

    const parsed: StoredSettings = JSON.parse(stored);

    // Version mismatch - migrate or reset
    if (parsed.version !== SETTINGS_VERSION) {
      console.log('[Settings] Version mismatch, migrating settings...');
      // For now, merge with defaults (keeps user preferences where possible)
      return {
        ...defaultSettings,
        ...parsed.settings,
      };
    }

    // Merge with defaults to handle new settings added in updates
    return {
      ...defaultSettings,
      ...parsed.settings,
      // Deep merge nested objects
      model: { ...defaultSettings.model, ...parsed.settings.model },
      theme: { ...defaultSettings.theme, ...parsed.settings.theme },
      notifications: { ...defaultSettings.notifications, ...parsed.settings.notifications },
      sounds: { ...defaultSettings.sounds, ...parsed.settings.sounds },
      input: { ...defaultSettings.input, ...parsed.settings.input },
      aiBehavior: { ...defaultSettings.aiBehavior, ...parsed.settings.aiBehavior },
      attachments: { ...defaultSettings.attachments, ...parsed.settings.attachments },
      context: { ...defaultSettings.context, ...parsed.settings.context },
    };
  } catch (error) {
    console.error('[Settings] Failed to load settings:', error);
    return defaultSettings;
  }
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: OctaveSettings): void {
  try {
    const toStore: StoredSettings = {
      version: SETTINGS_VERSION,
      settings,
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('[Settings] Failed to save settings:', error);
  }
}

/**
 * Custom hook for managing Circuit settings
 *
 * @example
 * const { settings, updateSettings, resetSettings } = useSettings();
 *
 * // Update a specific category
 * updateSettings('context', { enabled: true, warningThreshold: 75 });
 *
 * // Reset all settings
 * resetSettings();
 */
export function useSettings() {
  const [settings, setSettings] = useState<OctaveSettings>(() => loadSettings());

  // Persist to localStorage whenever settings change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  /**
   * Update settings for a specific category
   * Type-safe: only allows updating properties that exist in the category
   */
  const updateSettings = useCallback(
    <K extends keyof OctaveSettings>(
      category: K,
      updates: Partial<OctaveSettings[K]>
    ) => {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          ...updates,
        },
      }));
    },
    []
  );

  /**
   * Update a single setting value
   * Useful for simple toggles and single-value updates
   */
  const updateSetting = useCallback(
    <K extends keyof OctaveSettings, P extends keyof OctaveSettings[K]>(
      category: K,
      property: P,
      value: OctaveSettings[K][P]
    ) => {
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [property]: value,
        },
      }));
    },
    []
  );

  /**
   * Reset all settings to defaults
   */
  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  /**
   * Reset a specific category to defaults
   */
  const resetCategory = useCallback((category: keyof OctaveSettings) => {
    setSettings(prev => ({
      ...prev,
      [category]: defaultSettings[category],
    }));
  }, []);

  /**
   * Export settings as JSON (for backup)
   */
  const exportSettings = useCallback((): string => {
    return JSON.stringify({ version: SETTINGS_VERSION, settings }, null, 2);
  }, [settings]);

  /**
   * Import settings from JSON (for restore)
   */
  const importSettings = useCallback((json: string): boolean => {
    try {
      const imported: StoredSettings = JSON.parse(json);
      if (imported.version && imported.settings) {
        setSettings(imported.settings);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Settings] Failed to import settings:', error);
      return false;
    }
  }, []);

  return {
    settings,
    updateSettings,
    updateSetting,
    resetSettings,
    resetCategory,
    exportSettings,
    importSettings,
  };
}
