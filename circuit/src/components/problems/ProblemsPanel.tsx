/**
 * Problems Panel
 *
 * Displays TypeScript errors and warnings
 * Grouped by file with ability to click and navigate to source
 */

import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, RefreshCw, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface Diagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  file: string;
  line: number;
  character: number;
  code: number;
}

interface ProblemsPanelProps {
  workspacePath: string;
  onFileClick: (path: string, line: number) => void;
}

export function ProblemsPanel({ workspacePath, onFileClick }: ProblemsPanelProps) {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Load diagnostics
  const loadDiagnostics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('typescript:get-diagnostics', workspacePath);

      if (result.success) {
        setDiagnostics(result.diagnostics);

        // Auto-expand first 5 files
        const files = Object.keys(
          result.diagnostics.reduce((acc: Record<string, boolean>, d: Diagnostic) => {
            acc[d.file] = true;
            return acc;
          }, {})
        ).slice(0, 5);
        setExpandedGroups(new Set(files));
      } else {
        setError(result.error || 'Failed to load diagnostics');
        setDiagnostics([]);
      }
    } catch (error) {
      console.error('[ProblemsPanel] Error loading diagnostics:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setDiagnostics([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load on mount and when workspace changes
  useEffect(() => {
    loadDiagnostics();
  }, [workspacePath]);

  // Group diagnostics by file
  const groupedDiagnostics = diagnostics.reduce((acc, diagnostic) => {
    if (!acc[diagnostic.file]) {
      acc[diagnostic.file] = [];
    }
    acc[diagnostic.file].push(diagnostic);
    return acc;
  }, {} as Record<string, Diagnostic[]>);

  const totalErrors = diagnostics.filter(d => d.severity === 'error').length;
  const totalWarnings = diagnostics.filter(d => d.severity === 'warning').length;
  const totalInfo = diagnostics.filter(d => d.severity === 'info' || d.severity === 'hint').length;

  const toggleGroup = (file: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(file)) {
      newExpanded.delete(file);
    } else {
      newExpanded.add(file);
    }
    setExpandedGroups(newExpanded);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle size={14} className="text-destructive flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle size={14} className="text-warning flex-shrink-0" />;
      default:
        return <Info size={14} className="text-blue-500 flex-shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-destructive" />
          <span className="text-sm font-medium">Problems</span>
        </div>
        <button
          onClick={loadDiagnostics}
          disabled={isLoading}
          className={cn(
            "p-1 rounded hover:bg-secondary transition-colors",
            isLoading && "animate-spin"
          )}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs bg-secondary/30">
        {totalErrors > 0 && (
          <div className="flex items-center gap-1 text-destructive">
            <AlertCircle size={12} />
            <span>{totalErrors} {totalErrors === 1 ? 'Error' : 'Errors'}</span>
          </div>
        )}
        {totalWarnings > 0 && (
          <div className="flex items-center gap-1 text-warning">
            <AlertTriangle size={12} />
            <span>{totalWarnings} {totalWarnings === 1 ? 'Warning' : 'Warnings'}</span>
          </div>
        )}
        {totalInfo > 0 && (
          <div className="flex items-center gap-1 text-blue-500">
            <Info size={12} />
            <span>{totalInfo} {totalInfo === 1 ? 'Info' : 'Infos'}</span>
          </div>
        )}
        {diagnostics.length === 0 && !isLoading && !error && (
          <div className="text-muted-foreground">No problems detected</div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
          <AlertCircle size={32} className="text-muted-foreground mb-2" />
          <p className="text-sm font-medium mb-1">TypeScript diagnostics unavailable</p>
          <p className="text-xs text-muted-foreground max-w-[300px]">
            {error === 'tsconfig.json not found'
              ? 'This project doesn\'t have a tsconfig.json. TypeScript diagnostics work best with a TypeScript project.'
              : error}
          </p>
          <button
            onClick={loadDiagnostics}
            className="mt-4 px-3 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Problems List */}
      {!error && (
        <ScrollArea className="flex-1">
          {Object.entries(groupedDiagnostics).length > 0 ? (
            <div>
              {Object.entries(groupedDiagnostics).map(([file, fileDiagnostics]) => {
                const fileErrors = fileDiagnostics.filter(d => d.severity === 'error').length;
                const fileWarnings = fileDiagnostics.filter(d => d.severity === 'warning').length;

                return (
                  <div key={file} className="border-b border-border last:border-b-0">
                    {/* File Header */}
                    <button
                      onClick={() => toggleGroup(file)}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-secondary/50 transition-colors"
                    >
                      <ChevronRight
                        size={14}
                        className={cn(
                          "transition-transform flex-shrink-0",
                          expandedGroups.has(file) && "rotate-90"
                        )}
                      />
                      <span className="text-xs font-medium truncate flex-1 text-left">{file}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {fileErrors > 0 && (
                          <span className="text-xs text-destructive">{fileErrors}</span>
                        )}
                        {fileWarnings > 0 && (
                          <span className="text-xs text-warning">{fileWarnings}</span>
                        )}
                      </div>
                    </button>

                    {/* Diagnostics */}
                    {expandedGroups.has(file) && (
                      <div className="bg-secondary/20">
                        {fileDiagnostics.map((diagnostic, index) => (
                          <button
                            key={`${file}-${index}`}
                            onClick={() => onFileClick(diagnostic.file, diagnostic.line)}
                            className="w-full px-8 py-2 text-left hover:bg-secondary/50 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              {getSeverityIcon(diagnostic.severity)}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground leading-relaxed">
                                  {diagnostic.message}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {file}:{diagnostic.line}:{diagnostic.character} [{diagnostic.code}]
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <AlertCircle size={32} className="text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No problems detected</p>
                <p className="text-xs text-muted-foreground mt-1">
                  TypeScript diagnostics will appear here
                </p>
              </div>
            )
          )}

          {/* Loading State */}
          {isLoading && diagnostics.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <RefreshCw size={32} className="text-muted-foreground mb-2 animate-spin" />
              <p className="text-sm text-muted-foreground">Analyzing TypeScript code...</p>
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
