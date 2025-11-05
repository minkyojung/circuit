/**
 * Outline Panel Component
 *
 * Displays the structure of the current file:
 * - Functions
 * - Classes (with methods and properties)
 * - Interfaces
 * - Types
 * - Enums
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Function,
  Box,
  Type,
  Package,
  Circle,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

// ============================================================================
// Types
// ============================================================================

interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'method' | 'property' | 'enum';
  line: number;
  children: Symbol[];
}

interface OutlinePanelProps {
  filePath: string | null;
  onSymbolClick: (line: number) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function OutlinePanel({ filePath, onSymbolClick }: OutlinePanelProps) {
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());

  // Load outline for current file
  const loadOutline = async () => {
    if (!filePath) {
      setSymbols([]);
      return;
    }

    // Only load outline for TypeScript/JavaScript files
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (!['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) {
      setSymbols([]);
      setError('Outline is only available for TypeScript and JavaScript files');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('typescript:get-outline', filePath);

      if (result.success) {
        setSymbols(result.symbols || []);
        setError(null);
      } else {
        setSymbols([]);
        setError(result.error || 'Failed to load outline');
      }
    } catch (err: any) {
      console.error('[OutlinePanel] Error loading outline:', err);
      setSymbols([]);
      setError(err.message || 'Failed to load outline');
    } finally {
      setIsLoading(false);
    }
  };

  // Reload outline when file changes
  useEffect(() => {
    loadOutline();
  }, [filePath]);

  // Toggle symbol expansion
  const toggleExpand = (symbolPath: string) => {
    setExpandedSymbols(prev => {
      const next = new Set(prev);
      if (next.has(symbolPath)) {
        next.delete(symbolPath);
      } else {
        next.add(symbolPath);
      }
      return next;
    });
  };

  // Get icon for symbol kind
  const getSymbolIcon = (kind: string, hasChildren: boolean = false) => {
    const iconProps = { size: 14, className: "flex-shrink-0" };

    switch (kind) {
      case 'function':
        return <Function {...iconProps} className={cn(iconProps.className, "text-purple-500")} />;
      case 'class':
        return <Box {...iconProps} className={cn(iconProps.className, "text-blue-500")} />;
      case 'interface':
        return <Type {...iconProps} className={cn(iconProps.className, "text-cyan-500")} />;
      case 'type':
        return <Type {...iconProps} className={cn(iconProps.className, "text-green-500")} />;
      case 'enum':
        return <Package {...iconProps} className={cn(iconProps.className, "text-orange-500")} />;
      case 'method':
        return <Function {...iconProps} className={cn(iconProps.className, "text-purple-400")} />;
      case 'property':
        return <Circle {...iconProps} className={cn(iconProps.className, "text-gray-400")} />;
      default:
        return <Circle {...iconProps} className={cn(iconProps.className, "text-gray-400")} />;
    }
  };

  // Render symbol tree
  const renderSymbol = (symbol: Symbol, depth: number = 0, parentPath: string = '') => {
    const symbolPath = `${parentPath}/${symbol.name}`;
    const hasChildren = symbol.children && symbol.children.length > 0;
    const isExpanded = expandedSymbols.has(symbolPath);

    return (
      <div key={symbolPath}>
        {/* Symbol Item */}
        <button
          onClick={() => {
            if (hasChildren) {
              toggleExpand(symbolPath);
            }
            onSymbolClick(symbol.line);
          }}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
            "hover:bg-secondary/50",
            "text-sm"
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(symbolPath);
              }}
              className="hover:bg-secondary/80 rounded p-0.5"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={14} className="text-muted-foreground" />
              )}
            </button>
          )}

          {/* Symbol Icon */}
          <div className={cn(!hasChildren && "ml-[22px]")}>
            {getSymbolIcon(symbol.kind, hasChildren)}
          </div>

          {/* Symbol Name */}
          <span className="flex-1 truncate font-mono text-foreground">
            {symbol.name}
          </span>

          {/* Line Number */}
          <span className="text-xs text-muted-foreground">
            :{symbol.line}
          </span>
        </button>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {symbol.children.map(child => renderSymbol(child, depth + 1, symbolPath))}
          </div>
        )}
      </div>
    );
  };

  // Empty state when no file is open
  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
        <FileText size={32} className="text-muted-foreground mb-2" />
        <p className="text-sm font-medium mb-1">No file open</p>
        <p className="text-xs text-muted-foreground">
          Open a TypeScript or JavaScript file to see its outline
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
        <RefreshCw size={32} className="text-muted-foreground mb-2 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading outline...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
        <FileText size={32} className="text-muted-foreground mb-2" />
        <p className="text-sm font-medium mb-1">Cannot show outline</p>
        <p className="text-xs text-muted-foreground max-w-[300px]">
          {error}
        </p>
        <button
          onClick={loadOutline}
          className="mt-4 px-3 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty outline
  if (symbols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
        <FileText size={32} className="text-muted-foreground mb-2" />
        <p className="text-sm font-medium mb-1">No symbols found</p>
        <p className="text-xs text-muted-foreground">
          This file doesn't contain any functions, classes, or types
        </p>
      </div>
    );
  }

  // Outline tree
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-muted-foreground" />
          <span className="text-xs font-medium">
            {symbols.length} symbol{symbols.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={loadOutline}
          className="p-1 hover:bg-secondary/50 rounded transition-colors"
          title="Refresh outline"
        >
          <RefreshCw size={12} className="text-muted-foreground" />
        </button>
      </div>

      {/* Symbols List */}
      <div className="flex-1 overflow-y-auto">
        {symbols.map(symbol => renderSymbol(symbol))}
      </div>
    </div>
  );
}
