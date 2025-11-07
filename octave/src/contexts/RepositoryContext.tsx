/**
 * RepositoryContext - Manages currently selected repository across the app
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Repository } from '@/types/workspace';

interface RepositoryContextValue {
  /** Currently selected repository */
  currentRepository: Repository | null;

  /** Update the current repository */
  setCurrentRepository: (repository: Repository | null) => void;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

interface RepositoryProviderProps {
  children: ReactNode;
  /** Controlled value for current repository */
  value?: Repository | null;
  /** Callback when repository changes */
  onChange?: (repository: Repository | null) => void;
}

export const RepositoryProvider: React.FC<RepositoryProviderProps> = ({
  children,
  value: controlledValue,
  onChange
}) => {
  const [internalValue, setInternalValue] = useState<Repository | null>(null);

  // Use controlled value if provided, otherwise use internal state
  const currentRepository = controlledValue !== undefined ? controlledValue : internalValue;

  const handleSetRepository = useCallback((repository: Repository | null) => {
    if (onChange) {
      onChange(repository);
    } else {
      setInternalValue(repository);
    }
  }, [onChange]);

  const contextValue = {
    currentRepository,
    setCurrentRepository: handleSetRepository,
  };

  return (
    <RepositoryContext.Provider value={contextValue}>
      {children}
    </RepositoryContext.Provider>
  );
};

/**
 * Hook to access current repository context
 * @throws Error if used outside RepositoryProvider
 */
export const useRepository = (): RepositoryContextValue => {
  const context = useContext(RepositoryContext);

  if (!context) {
    throw new Error('useRepository must be used within a RepositoryProvider');
  }

  return context;
};

/**
 * Hook to safely access repository context (returns null if not available)
 */
export const useRepositorySafe = (): RepositoryContextValue | null => {
  return useContext(RepositoryContext);
};
