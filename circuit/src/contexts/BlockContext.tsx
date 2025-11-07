import { createContext, useContext, useState, useCallback, type ReactNode, useRef, useEffect } from 'react';
import type { TerminalBlock } from '@/types/terminal';
import { getBlockManager } from '@/lib/terminal/blockManager';

interface BlockContextValue {
  // Get blocks for a workspace
  getBlocks: (workspaceId: string) => TerminalBlock[];

  // Process terminal data and update blocks
  processData: (workspaceId: string, data: string, cwd?: string) => void;

  // Clear blocks for workspace
  clearBlocks: (workspaceId: string) => void;

  // Force re-render
  refresh: () => void;
}

const BlockContext = createContext<BlockContextValue | null>(null);

interface BlockProviderProps {
  children: ReactNode;
}

export function BlockProvider({ children }: BlockProviderProps) {
  // Force re-render counter
  const [, setUpdateCounter] = useState(0);
  const blockManager = useRef(getBlockManager());

  const getBlocks = useCallback((workspaceId: string) => {
    return blockManager.current.getBlocks(workspaceId);
  }, []);

  const processData = useCallback((workspaceId: string, data: string, cwd: string = '~') => {
    blockManager.current.processData(workspaceId, data, cwd);
    // Trigger re-render
    setUpdateCounter((c) => c + 1);
  }, []);

  const clearBlocks = useCallback((workspaceId: string) => {
    blockManager.current.clearBlocks(workspaceId);
    // Trigger re-render
    setUpdateCounter((c) => c + 1);
  }, []);

  const refresh = useCallback(() => {
    setUpdateCounter((c) => c + 1);
  }, []);

  const value: BlockContextValue = {
    getBlocks,
    processData,
    clearBlocks,
    refresh,
  };

  return <BlockContext.Provider value={value}>{children}</BlockContext.Provider>;
}

export function useBlocks(): BlockContextValue {
  const context = useContext(BlockContext);
  if (!context) {
    throw new Error('useBlocks must be used within a BlockProvider');
  }
  return context;
}
