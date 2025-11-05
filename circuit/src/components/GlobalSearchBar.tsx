/**
 * Global Search Bar Component
 *
 * Always-visible search bar with branch name as placeholder
 * VSCode-style file content search
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface SearchResult {
  path: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

interface GlobalSearchBarProps {
  workspacePath: string;
  branchName: string;
  onFileSelect: (path: string, line: number) => void;
}

export function GlobalSearchBar({
  workspacePath,
  branchName,
  onFileSelect
}: GlobalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Search execution with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await ipcRenderer.invoke(
          'workspace:search-in-files',
          workspacePath,
          query,
          {
            maxResults: 100,
            ignoreCase: true,
          }
        );

        if (result.success) {
          setResults(result.results);
          setSelectedIndex(0);
        } else {
          console.error('[GlobalSearch] Error:', result.error);
          setResults([]);
        }
      } catch (error) {
        console.error('[GlobalSearch] Exception:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, workspacePath]);

  // Handle ESC key to close results and clear input
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (query || results.length > 0)) {
        setQuery('');
        setResults([]);
        setSelectedIndex(0);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [query, results.length]);

  // Handle keyboard navigation (Arrow Up/Down, Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex + 1] as HTMLElement; // +1 for header
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, results.length]);

  // Handle result selection
  const handleResultClick = (result: SearchResult) => {
    onFileSelect(result.path, result.lineNumber);
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
    inputRef.current?.blur();
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
          setResults([]);
        }
      }
    };

    if (results.length > 0) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [results.length]);

  return (
    <div className="relative w-[400px]">
      {/* Always-visible Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={`${branchName} - Search in files...`}
          className={cn(
            "w-full px-3 py-1 text-sm transition-all rounded-md",
            "border-0 outline-none cursor-pointer",
            // Light mode: 배경보다 약간 어두운 회색
            "bg-black/[0.04]",
            "hover:bg-black/[0.06]",
            "focus:bg-black/[0.08]",
            // Dark mode: 배경보다 약간 밝은 회색
            "dark:bg-white/[0.04]",
            "dark:hover:bg-white/[0.06]",
            "dark:focus:bg-white/[0.08]",
            // Focus ring - 무채색
            "focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-0",
            // Focus시 텍스트 커서
            "focus:cursor-text",
            "placeholder:text-muted-foreground",
            // Text alignment
            "text-center",
            // Placeholder always centered
            "placeholder:text-center"
          )}
        />
      </div>

      {/* Search Results Dropdown */}
      {(results.length > 0 || isSearching) && (
        <motion.div
          ref={resultsRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
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
          ) : (
            <>
              {/* Results Count */}
              <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border sticky top-0 bg-popover">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </div>

              {/* Results List */}
              {results.map((result, index) => (
                <button
                  key={`${result.path}-${result.lineNumber}-${index}`}
                  onClick={() => handleResultClick(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "w-full px-3 py-2 text-left transition-colors",
                    "border-b border-border last:border-b-0",
                    selectedIndex === index
                      ? 'bg-secondary/80'
                      : 'bg-transparent hover:bg-secondary/50'
                  )}
                >
                  {/* File Path and Line Number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate">
                      {result.path}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      :{result.lineNumber}
                    </span>
                  </div>

                  {/* Matched Line Content */}
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {highlightMatch(
                      result.lineContent,
                      result.matchStart,
                      result.matchEnd
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Utility: Highlight matched text
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
