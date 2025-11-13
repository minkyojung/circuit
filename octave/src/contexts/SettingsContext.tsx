/**
 * Settings Context
 *
 * Provides global access to Circuit settings throughout the app
 * Wraps useSettings hook for convenient access
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { useSettings } from '@/hooks/useSettings';
import type { OctaveSettings } from '@/types/settings';

interface SettingsContextType {
  settings: OctaveSettings;
  updateSettings: <K extends keyof OctaveSettings>(
    category: K,
    updates: Partial<OctaveSettings[K]>
  ) => void;
  updateSetting: <K extends keyof OctaveSettings, P extends keyof OctaveSettings[K]>(
    category: K,
    property: P,
    value: OctaveSettings[K][P]
  ) => void;
  resetSettings: () => void;
  resetCategory: (category: keyof OctaveSettings) => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
}

/**
 * Settings Provider Component
 *
 * Wraps the app to provide settings access to all components
 *
 * @example
 * // In App.tsx
 * <SettingsProvider>
 *   <YourApp />
 * </SettingsProvider>
 */
export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const settingsHook = useSettings();

  return (
    <SettingsContext.Provider value={settingsHook}>
      {children}
    </SettingsContext.Provider>
  );
};

/**
 * Hook to access settings context
 *
 * Must be used within a SettingsProvider
 *
 * @example
 * function MyComponent() {
 *   const { settings, updateSettings } = useSettingsContext();
 *
 *   const handleToggle = () => {
 *     updateSettings('context', { enabled: !settings.context.enabled });
 *   };
 *
 *   return <button onClick={handleToggle}>Toggle</button>;
 * }
 */
export const useSettingsContext = (): SettingsContextType => {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }

  return context;
};

/**
 * Optional: Hook to access a specific settings category
 * Provides better type inference and less verbose access
 *
 * @example
 * const contextSettings = useSettingsCategory('context');
 * console.log(contextSettings.warningThreshold); // Type-safe!
 */
export function useSettingsCategory<K extends keyof OctaveSettings>(
  category: K
): OctaveSettings[K] {
  const { settings } = useSettingsContext();
  return settings[category];
}
