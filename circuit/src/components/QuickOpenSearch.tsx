/**
 * Quick Open Search - VSCode Style
 *
 * Simple and reliable file/content search
 * - Default: File name search
 * - % prefix: Content search
 * - @ prefix: Recent workspaces
 * - # prefix: Go to Symbol (current file)
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FileText, Clock, Folder, Braces, Box, Type, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

// @ts-ignore
const ipcRenderer = window.electron.ipcRenderer;

// ============================================================================
// Types
// ============================================================================

interface FileResult {
  path: string;
  fullPath: string;
  name: string;
  dir: string;
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

interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'const';
  line: number;
}

interface QuickOpenSearchProps {
  workspacePath: string;
  branchName: string;
  onFileSelect: (path: string, line?: number) => void;
  onWorkspaceSelect?: (workspaceId: string) => void;
  activeFilePath?: string | null;
}

// ============================================================================
// Main Component
// ============================================================================

export const QuickOpenSearch = forwardRef<HTMLInputElement, QuickOpenSearchProps>(
  function QuickOpenSearch({ workspacePath, branchName, onFileSelect, onWorkspaceSelect, activeFilePath }, ref) {
    const [query, setQuery] = useState('');
    const [fileResults, setFileResults] = useState<FileResult[]>([]);
    const [contentResults, setContentResults] = useState<ContentResult[]>([]);
    const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
    const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [containerWidth, setContainerWidth] = useState(400);

    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Expose focus method
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    // Track container width for responsive placeholder
    useEffect(() => {
      if (!containerRef.current) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });

      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }, []);

    // Generate responsive placeholder
    const getPlaceholder = () => {
      return branchName;
    };

    // Determine search mode
    const isSymbolSearch = query.startsWith('#');
    const isWorkspaceSearch = query.startsWith('@');
    const isContentSearch = query.startsWith('%');
    const searchQuery = (isSymbolSearch || isWorkspaceSearch || isContentSearch) ? query.slice(1).trim() : query.trim();

    // Load recent workspaces
    useEffect(() => {
      if (!isWorkspaceSearch) {
        setRecentWorkspaces([]);
        return;
      }

      try {
        const stored = localStorage.getItem('circuit-recent-workspaces');
        if (stored) {
          const workspaces: RecentWorkspace[] = JSON.parse(stored);
          const sorted = workspaces
            .sort((a, b) => b.lastAccessed - a.lastAccessed)
            .slice(0, 10);

          // Filter by search query if provided
          if (searchQuery) {
            const filtered = sorted.filter(w =>
              w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              w.branch.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setRecentWorkspaces(filtered);
          } else {
            setRecentWorkspaces(sorted);
          }
        } else {
          setRecentWorkspaces([]);
        }
      } catch (error) {
        console.error('[QuickOpen] Failed to load recent workspaces:', error);
        setRecentWorkspaces([]);
      }
    }, [isWorkspaceSearch, searchQuery]);

    // Load symbols from current file
    useEffect(() => {
      if (!isSymbolSearch || !activeFilePath) {
        setSymbols([]);
        return;
      }

      const loadSymbols = async () => {
        try {
          const result = await ipcRenderer.invoke('typescript:get-outline', activeFilePath);
          if (result.success && result.outline) {
            const flatSymbols: SymbolInfo[] = [];

            // Flatten nested outline structure
            const flatten = (items: any[]) => {
              for (const item of items) {
                flatSymbols.push({
                  name: item.name,
                  kind: item.kind,
                  line: item.line
                });
                if (item.children && item.children.length > 0) {
                  flatten(item.children);
                }
              }
            };

            flatten(result.outline);

            // Filter by search query if provided
            if (searchQuery) {
              const filtered = flatSymbols.filter(s =>
                s.name.toLowerCase().includes(searchQuery.toLowerCase())
              );
              setSymbols(filtered);
            } else {
              setSymbols(flatSymbols);
            }
          } else {
            setSymbols([]);
          }
        } catch (error) {
          console.error('[QuickOpen] Failed to load symbols:', error);
          setSymbols([]);
        }
      };

      loadSymbols();
    }, [isSymbolSearch, activeFilePath, searchQuery]);

    // File search
    useEffect(() => {
      if (isContentSearch || isWorkspaceSearch || isSymbolSearch || !searchQuery) {
        setFileResults([]);
        return;
      }

      setIsSearching(true);
      const timeoutId = setTimeout(async () => {
        try {
          const result = await ipcRenderer.invoke(
            'workspace:search-files',
            workspacePath,
            searchQuery,
            { maxResults: 50, fuzzy: true }
          );

          if (result.success) {
            setFileResults(result.files || []);
          } else {
            setFileResults([]);
          }
        } catch (error) {
          console.error('[QuickOpen] File search error:', error);
          setFileResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 150);

      return () => clearTimeout(timeoutId);
    }, [isContentSearch, searchQuery, workspacePath]);

    // Content search
    useEffect(() => {
      if (!isContentSearch || !searchQuery) {
        setContentResults([]);
        return;
      }

      setIsSearching(true);
      const timeoutId = setTimeout(async () => {
        try {
          const result = await ipcRenderer.invoke(
            'workspace:search-in-files',
            workspacePath,
            searchQuery,
            { maxResults: 100, ignoreCase: true }
          );

          if (result.success) {
            setContentResults(result.results || []);
          } else {
            setContentResults([]);
          }
        } catch (error) {
          console.error('[QuickOpen] Content search error:', error);
          setContentResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }, [isContentSearch, searchQuery, workspacePath]);

    // Get current results
    const currentResults = isSymbolSearch
      ? symbols
      : (isWorkspaceSearch
        ? recentWorkspaces
        : (isContentSearch ? contentResults : fileResults));

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, currentResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const result = currentResults[selectedIndex];
        if (result) {
          if (isSymbolSearch) {
            const symbol = result as SymbolInfo;
            if (activeFilePath) {
              onFileSelect(activeFilePath, symbol.line);
              handleClose();
            }
          } else if (isWorkspaceSearch) {
            const workspace = result as RecentWorkspace;
            if (onWorkspaceSelect) {
              onWorkspaceSelect(workspace.id);
              handleClose();
            }
          } else if (isContentSearch) {
            const r = result as ContentResult;
            onFileSelect(r.path, r.lineNumber);
          } else {
            const r = result as FileResult;
            onFileSelect(r.path);
          }
          handleClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    // Close handler
    const handleClose = () => {
      setQuery('');
      setShowResults(false);
      setSelectedIndex(0);
      inputRef.current?.blur();
    };

    // Auto-scroll selected item
    useEffect(() => {
      if (resultsRef.current && currentResults.length > 0) {
        const items = resultsRef.current.querySelectorAll('[data-result-item]');
        const selectedItem = items[selectedIndex] as HTMLElement;
        if (selectedItem) {
          selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }, [selectedIndex, currentResults.length]);

    // Reset selection when results change
    useEffect(() => {
      setSelectedIndex(0);
    }, [fileResults, contentResults]);

    // Show/hide results
    useEffect(() => {
      setShowResults(query.length > 0);
    }, [query]);

    // Click outside to close
    useEffect(() => {
      if (!showResults) return;

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
    }, [showResults]);

    return (
      <div ref={containerRef} className="relative w-full">
        {/* Search Input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowResults(query.length > 0)}
            placeholder={getPlaceholder()}
            className={cn(
              "w-full px-3 py-1 text-sm transition-all rounded-md",
              "border-0 outline-none",
              "bg-black/[0.04] hover:bg-black/[0.06] focus:bg-black/[0.08]",
              "dark:bg-white/[0.04] dark:hover:bg-white/[0.06] dark:focus:bg-white/[0.08]",
              "focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground",
              query ? "text-left" : "text-center placeholder:text-center"
            )}
          />
        </div>

        {/* Results Dropdown */}
        {showResults && (
          <div
            ref={resultsRef}
            className={cn(
              "absolute top-full left-0 right-0 mt-2",
              "bg-popover border border-border rounded-md shadow-lg",
              "max-h-[400px] overflow-y-auto z-50"
            )}
          >
            {isSearching ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Searching{isContentSearch ? ' in files' : ' files'}...
              </div>
            ) : currentResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {isSymbolSearch
                  ? (activeFilePath ? 'No symbols found' : 'No file open')
                  : (isWorkspaceSearch ? 'No recent workspaces found' : `No ${isContentSearch ? 'results' : 'files'} found`)}
              </div>
            ) : (
              <div>
                {/* Results Header */}
                <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border bg-popover sticky top-0">
                  {currentResults.length} {isSymbolSearch ? 'symbol' : (isWorkspaceSearch ? 'workspace' : (isContentSearch ? 'result' : 'file'))}{currentResults.length !== 1 ? 's' : ''}
                </div>

                {/* Results List */}
                {isSymbolSearch ? (
                  // Symbol results
                  symbols.map((symbol, index) => (
                    <button
                      key={`${symbol.name}-${symbol.line}`}
                      data-result-item
                      onClick={() => {
                        if (activeFilePath) {
                          onFileSelect(activeFilePath, symbol.line);
                          handleClose();
                        }
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full px-3 py-2 text-left transition-colors flex items-start gap-2",
                        "border-b border-border last:border-b-0",
                        selectedIndex === index ? 'bg-secondary/80' : 'hover:bg-secondary/50'
                      )}
                    >
                      {getSymbolIcon(symbol.kind)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {symbol.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {symbol.kind} • Line {symbol.line}
                        </div>
                      </div>
                    </button>
                  ))
                ) : isWorkspaceSearch ? (
                  // Workspace results
                  recentWorkspaces.map((workspace, index) => (
                    <button
                      key={workspace.id}
                      data-result-item
                      onClick={() => {
                        if (onWorkspaceSelect) {
                          onWorkspaceSelect(workspace.id);
                          handleClose();
                        }
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full px-3 py-2 text-left transition-colors flex items-start gap-2",
                        "border-b border-border last:border-b-0",
                        selectedIndex === index ? 'bg-secondary/80' : 'hover:bg-secondary/50'
                      )}
                    >
                      <Folder size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {workspace.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {workspace.branch}
                        </div>
                      </div>
                      <Clock size={12} className="text-muted-foreground flex-shrink-0 mt-1" />
                    </button>
                  ))
                ) : isContentSearch ? (
                  // Content results
                  contentResults.map((result, index) => (
                    <button
                      key={`${result.path}-${result.lineNumber}`}
                      data-result-item
                      onClick={() => {
                        onFileSelect(result.path, result.lineNumber);
                        handleClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full px-3 py-2 text-left transition-colors",
                        "border-b border-border last:border-b-0",
                        selectedIndex === index ? 'bg-secondary/80' : 'hover:bg-secondary/50'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground truncate">
                          {result.path}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          :{result.lineNumber}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {highlightMatch(result.lineContent, result.matchStart, result.matchEnd)}
                      </div>
                    </button>
                  ))
                ) : (
                  // File results
                  fileResults.map((file, index) => (
                    <button
                      key={file.path}
                      data-result-item
                      onClick={() => {
                        onFileSelect(file.path);
                        handleClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full px-3 py-2 text-left transition-colors flex items-center gap-2",
                        "border-b border-border last:border-b-0",
                        selectedIndex === index ? 'bg-secondary/80' : 'hover:bg-secondary/50'
                      )}
                    >
                      <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {file.name}
                        </div>
                        {file.dir && (
                          <div className="text-xs text-muted-foreground truncate">
                            {file.dir}
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

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

function getSymbolIcon(kind: string) {
  const iconProps = { size: 14, className: "flex-shrink-0 mt-0.5" };

  switch (kind) {
    case 'function':
      return <Braces {...iconProps} className={cn(iconProps.className, "text-purple-500")} />;
    case 'class':
      return <Box {...iconProps} className={cn(iconProps.className, "text-orange-500")} />;
    case 'interface':
      return <Type {...iconProps} className={cn(iconProps.className, "text-blue-500")} />;
    case 'type':
      return <Type {...iconProps} className={cn(iconProps.className, "text-cyan-500")} />;
    case 'enum':
      return <Hash {...iconProps} className={cn(iconProps.className, "text-yellow-500")} />;
    case 'variable':
    case 'const':
      return <Hash {...iconProps} className={cn(iconProps.className, "text-green-500")} />;
    default:
      return <Hash {...iconProps} className={cn(iconProps.className, "text-muted-foreground")} />;
  }
}
