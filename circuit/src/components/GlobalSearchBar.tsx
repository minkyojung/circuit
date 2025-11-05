/**
 * Global Search Bar Component
 *
 * VSCode-style Quick Open with multiple search modes
 * - File name search (default)
 * - Content search (% prefix)
 * - Recent workspaces
 */

import React, { useState, useRef, useEffect } from 'react';
import { FileText, Search, Clock, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

// ============================================================================
// Types
// ============================================================================

type SearchMode = 'file' | 'content' | 'menu';

interface FileResult {
  path: string;
  fullPath: string;
  name: string;
  dir: string;
  score?: number;
}

interface ContentResult {
  path: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

interface RecentWorkspace {
  id: string;
  name: string;
  path: string;
  branch: string;
  lastAccessed: number;
}

interface SearchOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  mode: SearchMode;
}

// ============================================================================
// Props
// ============================================================================

interface GlobalSearchBarProps {
  workspacePath: string;
  branchName: string;
  onFileSelect: (path: string, line?: number) => void;
  onWorkspaceSelect?: (workspace: RecentWorkspace) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function GlobalSearchBar({
  workspacePath,
  branchName,
  onFileSelect,
  onWorkspaceSelect
}: GlobalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('menu');
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [contentResults, setContentResults] = useState<ContentResult[]>([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Search options menu
  const searchOptions: SearchOption[] = [
    {
      id: 'file',
      label: 'Go to File',
      description: 'Search files by name',
      icon: <FileText size={16} />,
      shortcut: '⌘P',
      mode: 'file'
    },
    {
      id: 'content',
      label: 'Search for Text',
      description: 'Search in file contents',
      icon: <Search size={16} />,
      shortcut: '%',
      mode: 'content'
    },
    {
      id: 'recent',
      label: 'Recent Workspaces',
      description: 'Recently accessed workspaces',
      icon: <Clock size={16} />,
      mode: 'menu' // Will show recent workspaces
    }
  ];

  // Detect mode from query prefix
  useEffect(() => {
    if (query.startsWith('%')) {
      setMode('content');
    } else if (query === '' && isFocused) {
      setMode('menu');
    } else {
      setMode('file');
    }
    setSelectedIndex(0);
  }, [query, isFocused]);

  // Get clean query (without prefix)
  const cleanQuery = query.startsWith('%') ? query.slice(1).trim() : query;

  // Load recent workspaces from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('circuit-recent-workspaces');
      if (stored) {
        const workspaces: RecentWorkspace[] = JSON.parse(stored);
        // Sort by last accessed and take top 10
        const sorted = workspaces
          .sort((a, b) => b.lastAccessed - a.lastAccessed)
          .slice(0, 10);
        setRecentWorkspaces(sorted);
      }
    } catch (error) {
      console.error('[GlobalSearch] Failed to load recent workspaces:', error);
    }
  }, [isFocused]);

  // File search
  useEffect(() => {
    if (mode !== 'file' || !cleanQuery.trim()) {
      if (mode === 'file') setFileResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await ipcRenderer.invoke(
          'workspace:search-files',
          workspacePath,
          cleanQuery,
          { maxResults: 50, fuzzy: true }
        );

        if (result.success) {
          setFileResults(result.files);
        } else {
          console.error('[GlobalSearch] File search error:', result.error);
          setFileResults([]);
        }
      } catch (error) {
        console.error('[GlobalSearch] File search exception:', error);
        setFileResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [mode, cleanQuery, workspacePath]);

  // Content search
  useEffect(() => {
    if (mode !== 'content' || !cleanQuery.trim()) {
      if (mode === 'content') setContentResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await ipcRenderer.invoke(
          'workspace:search-in-files',
          workspacePath,
          cleanQuery,
          { maxResults: 100, ignoreCase: true }
        );

        if (result.success) {
          setContentResults(result.results);
        } else {
          console.error('[GlobalSearch] Content search error:', result.error);
          setContentResults([]);
        }
      } catch (error) {
        console.error('[GlobalSearch] Content search exception:', error);
        setContentResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [mode, cleanQuery, workspacePath]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentResults = getCurrentResults();

    if (currentResults.length === 0 && mode === 'menu' && searchOptions.length === 0) return;

    const maxIndex = mode === 'menu' && !cleanQuery ? searchOptions.length - 1 : currentResults.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, maxIndex));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        handleSelection();
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
    }
  };

  // Get current results based on mode
  const getCurrentResults = () => {
    if (mode === 'menu' && !cleanQuery) return searchOptions;
    if (mode === 'file') return fileResults;
    if (mode === 'content') return contentResults;
    return [];
  };

  // Handle selection
  const handleSelection = () => {
    if (mode === 'menu' && !cleanQuery) {
      // Select a search option
      const option = searchOptions[selectedIndex];
      if (option) {
        if (option.id === 'recent') {
          // Show recent workspaces
          setQuery('');
          setMode('menu');
        } else {
          setQuery(option.shortcut === '%' ? '% ' : '');
          setMode(option.mode);
        }
      }
    } else if (mode === 'file') {
      const file = fileResults[selectedIndex];
      if (file) {
        onFileSelect(file.path);
        handleClose();
      }
    } else if (mode === 'content') {
      const result = contentResults[selectedIndex];
      if (result) {
        onFileSelect(result.path, result.lineNumber);
        handleClose();
      }
    }
  };

  // Handle close
  const handleClose = () => {
    setQuery('');
    setMode('menu');
    setSelectedIndex(0);
    inputRef.current?.blur();
  };

  // Auto-scroll selected item
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    if (!isFocused) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        resultsRef.current &&
        !resultsRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFocused]);

  // Get placeholder text
  const getPlaceholder = () => {
    if (mode === 'content') return 'Search in files...';
    if (mode === 'file') return 'Go to file...';
    return `${branchName} - Quick Open`;
  };

  const shouldShowDropdown = isFocused && (mode === 'menu' || isSearching || getCurrentResults().length > 0);

  return (
    <div className="relative w-[400px]">
      {/* Search Input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          // Delay to allow click on results
          setTimeout(() => setIsFocused(false), 150);
        }}
        placeholder={getPlaceholder()}
        className={cn(
          "w-full px-3 py-1 text-sm transition-all rounded-md",
          "border-0 outline-none cursor-pointer",
          "bg-black/[0.04] hover:bg-black/[0.06] focus:bg-black/[0.08]",
          "dark:bg-white/[0.04] dark:hover:bg-white/[0.06] dark:focus:bg-white/[0.08]",
          "focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-0",
          "focus:cursor-text placeholder:text-muted-foreground",
          isFocused || query ? "text-left" : "text-center",
          !isFocused && !query && "placeholder:text-center"
        )}
      />

      {/* Dropdown */}
      <AnimatePresence>
        {shouldShowDropdown && (
          <motion.div
            ref={resultsRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "absolute top-full left-0 right-0 mt-2",
              "bg-popover border border-border rounded-md shadow-lg",
              "max-h-[400px] overflow-y-auto",
              "z-50"
            )}
          >
            {isSearching ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : mode === 'menu' && !cleanQuery ? (
              // Show search options menu
              <div className="py-1">
                {searchOptions.map((option, index) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      setSelectedIndex(index);
                      handleSelection();
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left transition-colors flex items-center gap-3",
                      selectedIndex === index
                        ? 'bg-secondary/80'
                        : 'bg-transparent hover:bg-secondary/50'
                    )}
                  >
                    <div className="text-muted-foreground">{option.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                    {option.shortcut && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {option.shortcut}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : mode === 'file' && fileResults.length > 0 ? (
              // File results
              <div>
                <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border sticky top-0 bg-popover">
                  {fileResults.length} file{fileResults.length !== 1 ? 's' : ''}
                </div>
                {fileResults.map((file, index) => (
                  <button
                    key={`${file.path}-${index}`}
                    onClick={() => {
                      onFileSelect(file.path);
                      handleClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full px-3 py-2 text-left transition-colors flex items-center gap-2",
                      "border-b border-border last:border-b-0",
                      selectedIndex === index
                        ? 'bg-secondary/80'
                        : 'bg-transparent hover:bg-secondary/50'
                    )}
                  >
                    <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{file.name}</div>
                      {file.dir && (
                        <div className="text-xs text-muted-foreground truncate">{file.dir}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : mode === 'content' && contentResults.length > 0 ? (
              // Content results
              <div>
                <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border sticky top-0 bg-popover">
                  {contentResults.length} result{contentResults.length !== 1 ? 's' : ''}
                </div>
                {contentResults.map((result, index) => (
                  <button
                    key={`${result.path}-${result.lineNumber}-${index}`}
                    onClick={() => {
                      onFileSelect(result.path, result.lineNumber);
                      handleClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full px-3 py-2 text-left transition-colors",
                      "border-b border-border last:border-b-0",
                      selectedIndex === index
                        ? 'bg-secondary/80'
                        : 'bg-transparent hover:bg-secondary/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground truncate">
                        {result.path}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        :{result.lineNumber}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {highlightMatch(result.lineContent, result.matchStart, result.matchEnd)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {mode === 'file' && 'No files found'}
                {mode === 'content' && 'No results found'}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function highlightMatch(text: string, start: number, end: number) {
  return (
    <>
      {text.substring(0, start)}
      <span className="bg-primary/20 text-primary font-semibold">
        {text.substring(start, end)}
      </span>
      {text.substring(end)}
    </>
  );
}
