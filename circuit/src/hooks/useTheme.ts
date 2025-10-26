import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

/**
 * Custom hook for managing theme state with localStorage persistence
 * Supports light, dark, and system preference modes
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first
    const stored = localStorage.getItem('circuit-theme') as Theme;
    return stored || 'system';
  });

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

    // Persist to localStorage
    localStorage.setItem('circuit-theme', theme);
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

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme: () => {
      setTheme((current) => {
        if (current === 'light') return 'dark';
        if (current === 'dark') return 'system';
        return 'light';
      });
    },
  };
}
