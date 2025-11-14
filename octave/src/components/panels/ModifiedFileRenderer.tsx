/**
 * Modified File Renderer
 *
 * Renders AI-modified files with:
 * - Diff view (GitHub PR style)
 * - Full file view (Monaco Editor)
 * - File saving (Cmd+S)
 * - Unsaved changes tracking
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Code, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import Editor from '@monaco-editor/react';
import { getLanguageFromFilePath } from '@/lib/fileUtils';
import type { ModifiedFileTabData } from '@/types/editor';

const ipcRenderer = window.electron.ipcRenderer;

export interface ModifiedFileRendererProps {
  modifiedFileData: ModifiedFileTabData;
  workspacePath: string;
}

export function ModifiedFileRenderer({
  modifiedFileData,
  workspacePath,
}: ModifiedFileRendererProps) {
  const { filePath, diffLines, changeType, additions, deletions } = modifiedFileData;

  const [viewMode, setViewMode] = useState<'diff' | 'fullFile'>('diff');
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const originalContentRef = useRef<string>('');

  // Load file content when switching to full file mode
  useEffect(() => {
    if (viewMode !== 'fullFile') {
      setFileContent('');
      return;
    }

    const loadFileContent = async () => {
      setIsLoadingFile(true);
      try {
        const result = await ipcRenderer.invoke('workspace:read-file', workspacePath, filePath);

        if (result.success && result.content !== undefined) {
          setFileContent(result.content);
          originalContentRef.current = result.content;
          setHasUnsavedChanges(false);
        } else {
          console.error('[ModifiedFileRenderer] Failed to load file:', result.error);
          setFileContent('// Failed to load file');
        }
      } catch (error) {
        console.error('[ModifiedFileRenderer] Error loading file:', error);
        setFileContent('// Error loading file');
      } finally {
        setIsLoadingFile(false);
      }
    };

    loadFileContent();
  }, [filePath, viewMode, workspacePath]);

  // Track unsaved changes
  useEffect(() => {
    if (viewMode === 'fullFile' && fileContent !== originalContentRef.current) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [fileContent, viewMode]);

  // Save file function
  const saveFile = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return;

    setIsSaving(true);
    try {
      const result = await ipcRenderer.invoke('workspace:write-file', workspacePath, filePath, fileContent);

      if (result.success) {
        originalContentRef.current = fileContent;
        setHasUnsavedChanges(false);
        console.log('[ModifiedFileRenderer] File saved:', filePath);
      } else {
        console.error('[ModifiedFileRenderer] Failed to save file:', result.error);
        alert(`Failed to save file: ${result.error}`);
      }
    } catch (error) {
      console.error('[ModifiedFileRenderer] Error saving file:', error);
      alert('Error saving file');
    } finally {
      setIsSaving(false);
    }
  }, [filePath, fileContent, hasUnsavedChanges, isSaving, workspacePath]);

  // Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFile]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with File Info and View Toggle */}
      <div className="px-4 pt-4 pb-2 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{filePath}</h4>
            {hasUnsavedChanges && viewMode === 'fullFile' && (
              <span className="flex items-center gap-1 text-xs text-orange-600">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />
                Unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {viewMode === 'fullFile' && hasUnsavedChanges && (
              <Button
                size="sm"
                variant="outline"
                onClick={saveFile}
                disabled={isSaving}
                className="h-7 px-3 text-xs"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="text-green-600">+{additions}</span>
              <span className="text-red-600">-{deletions}</span>
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-md w-fit">
          <button
            onClick={() => setViewMode('diff')}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5',
              viewMode === 'diff'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Code className="w-3.5 h-3.5" />
            Diff
          </button>
          <button
            onClick={() => setViewMode('fullFile')}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5',
              viewMode === 'fullFile'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FileCode className="w-3.5 h-3.5" />
            Full File
          </button>
        </div>
      </div>

      {/* Content Area - Conditional Rendering */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'diff' ? (
          /* Inline Diff View */
          diffLines && diffLines.length > 0 ? (
            <div className="border rounded-md overflow-hidden font-mono text-xs">
              {diffLines.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'px-4 py-1 whitespace-pre-wrap break-words',
                    line.type === 'add' && 'bg-green-500/10 text-green-700 dark:text-green-400',
                    line.type === 'remove' && 'bg-red-500/10 text-red-700 dark:text-red-400',
                    line.type === 'unchanged' && 'bg-background text-foreground'
                  )}
                >
                  <span className="select-none mr-2 text-muted-foreground">
                    {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                  </span>
                  {line.content}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No diff available for this file
            </div>
          )
        ) : (
          /* Full File View with Monaco Editor */
          isLoadingFile ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">Loading file...</p>
            </div>
          ) : (
            <div className="h-full border rounded-md overflow-hidden">
              <Editor
                height="100%"
                language={getLanguageFromFilePath(filePath)}
                value={fileContent}
                theme="vs-dark"
                options={{
                  readOnly: false,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
                onChange={(value) => setFileContent(value || '')}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
