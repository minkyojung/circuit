import { useEffect, useState } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import type { ThemeMode } from '@/types/settings';

/**
 * Custom hook for managing theme state integrated with settings system
 * Supports light, dark, and system preference modes
 * Now uses the unified settings context instead of direct localStorage
 */
export function useTheme() {
  const { settings, updateSetting } = useSettingsContext();
  const theme = settings.theme.mode;

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = window.document.documentElement;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

    const effectiveTheme = theme === 'system' ? systemTheme : theme;

    // Update DOM
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);

    // Update resolved theme state
    setResolvedTheme(effectiveTheme);
  }, [theme]);

  // Listen to system theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const systemTheme = mediaQuery.matches ? 'dark' : 'light';
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(systemTheme);
      setResolvedTheme(systemTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    updateSetting('theme', 'mode', newTheme);
  };

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme: () => {
      const current = theme;
      let next: ThemeMode;
      if (current === 'light') next = 'dark';
      else if (current === 'dark') next = 'system';
      else next = 'light';
      setTheme(next);
    },
  };
}
