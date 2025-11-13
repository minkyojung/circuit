import { useEffect, useState } from 'react';

type Density = 'compact' | 'comfortable';

/**
 * Custom hook for managing UI density with localStorage persistence
 * Controls spacing/padding throughout the app
 */
export function useDensity() {
  const [density, setDensity] = useState<Density>(() => {
    const stored = localStorage.getItem('octave-density') as Density;
    return stored || 'compact';
  });

  useEffect(() => {
    const root = window.document.documentElement;

    // Remove both classes
    root.classList.remove('compact', 'comfortable');

    // Add the current density class
    root.classList.add(density);

    // Persist to localStorage
    localStorage.setItem('octave-density', density);
  }, [density]);

  const toggleDensity = () => {
    setDensity((current) => current === 'compact' ? 'comfortable' : 'compact');
  };

  return {
    density,
    setDensity,
    toggleDensity,
    isCompact: density === 'compact',
    isComfortable: density === 'comfortable',
  };
}
