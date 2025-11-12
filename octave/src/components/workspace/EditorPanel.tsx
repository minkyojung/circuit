/**
 * EditorPanel Component
 *
 * Monaco-based code editor with AI features:
 * - File editing with syntax highlighting
 * - Multi-file support
 * - Unsaved changes tracking
 * - Line cursor positioning (jump to line)
 * - Code selection for AI actions
 * - Language service integration
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Workspace } from '@/types/workspace';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { toast } from 'sonner';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { FloatingCodeActions } from './FloatingCodeActions';
import { getLanguageFromFilePath } from '@/lib/fileUtils';
import { cn } from '@/lib/utils';
import type {
  EditorPanelProps,
  FileCursorPosition,
  CodeSelectionAction,
} from './WorkspaceChatEditor.types';

// Configure Monaco Editor to use local files instead of CDN
// The vite-plugin-monaco-editor plugin handles web worker configuration automatically
loader.config({ monaco });

const ipcRenderer = window.electron.ipcRenderer;

const EditorPanel: React.FC<EditorPanelProps> = ({
  workspace,
  sessionId,
  openFiles,
  selectedFile,
  onCloseFile,
  onUnsavedChange,
  fileCursorPosition,
  onCodeSelectionAction,
}) => {
  const { settings } = useSettingsContext();
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<Map<string, boolean>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  // Monaco editor instance ref
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Get project root path (workspace.path is a worktree, we need the actual project root)
  // Example: /path/to/project/.conductor/workspaces/duck -> /path/to/project
  const projectRoot = useMemo(() => {
    const parts = workspace.path.split('/.conductor/workspaces/');
    return parts[0]; // Return the project root without worktree path
  }, [workspace.path]);

  // ✅ Normalize active file path to workspace-relative path
  // This ensures consistent tab IDs and file loading regardless of path format
  const normalizedActiveFile = useMemo(() => {
    if (!activeFile) return null;

    let normalized = activeFile;

    // Convert absolute path to relative path
    if (normalized.startsWith('/') || normalized.match(/^[A-Z]:\\/)) {
      if (normalized.startsWith(projectRoot)) {
        normalized = normalized.slice(projectRoot.length);
        if (normalized.startsWith('/') || normalized.startsWith('\\')) {
          normalized = normalized.slice(1);
        }
      }
    }

    // Remove "./" prefix
    normalized = normalized.replace(/^\.\//, '');
    normalized = normalized.replace(/^\.\\/, '');

    // Normalize path separators
    normalized = normalized.replace(/\\/g, '/');

    return normalized;
  }, [activeFile, projectRoot]);

  // Language service for TypeScript/diagnostics (using LSP for full project analysis)
  const { languageService, isInitialized: isLanguageServiceInitialized, mode: languageServiceMode } = useLanguageService({
    workspacePath: projectRoot, // Use project root, not worktree path
    mode: 'lsp', // Use LSP for project-wide diagnostics
  });

  // Floating action bar state
  const [floatingActionsVisible, setFloatingActionsVisible] = useState(false);
  const [floatingActionsPosition, setFloatingActionsPosition] = useState({ top: 0, left: 0 });
  const [currentSelection, setCurrentSelection] = useState<{
    code: string
    selection: monaco.Selection
  } | null>(null);

  // Handler: Ask about code
  const handleAskAboutCode = useCallback((code: string, filePath: string, selection: monaco.Selection) => {
    if (onCodeSelectionAction) {
      onCodeSelectionAction({
        type: 'ask',
        code,
        filePath,
        lineStart: selection.startLineNumber,
        lineEnd: selection.endLineNumber
      });
    }
  }, [onCodeSelectionAction]);

  // Handler: Explain code
  const handleExplainCode = useCallback((code: string, filePath: string, selection: monaco.Selection) => {
    if (onCodeSelectionAction) {
      onCodeSelectionAction({
        type: 'explain',
        code,
        filePath,
        lineStart: selection.startLineNumber,
        lineEnd: selection.endLineNumber
      });
    }
  }, [onCodeSelectionAction]);

  // Handler: Optimize code
  const handleOptimizeCode = useCallback((code: string, filePath: string, selection: monaco.Selection) => {
    if (onCodeSelectionAction) {
      onCodeSelectionAction({
        type: 'optimize',
        code,
        filePath,
        lineStart: selection.startLineNumber,
        lineEnd: selection.endLineNumber
      });
    }
  }, [onCodeSelectionAction]);

  // Handler: Add tests
  const handleAddTests = useCallback((code: string, filePath: string, selection: monaco.Selection) => {
    if (onCodeSelectionAction) {
      onCodeSelectionAction({
        type: 'add-tests',
        code,
        filePath,
        lineStart: selection.startLineNumber,
        lineEnd: selection.endLineNumber
      });
    }
  }, [onCodeSelectionAction]);

  // Floating action bar button handlers
  const handleFloatingAsk = useCallback(() => {
    if (currentSelection && activeFile) {
      handleAskAboutCode(currentSelection.code, activeFile, currentSelection.selection);
      setFloatingActionsVisible(false);
    }
  }, [currentSelection, activeFile, handleAskAboutCode]);

  const handleFloatingExplain = useCallback(() => {
    if (currentSelection && activeFile) {
      handleExplainCode(currentSelection.code, activeFile, currentSelection.selection);
      setFloatingActionsVisible(false);
    }
  }, [currentSelection, activeFile, handleExplainCode]);

  const handleFloatingOptimize = useCallback(() => {
    if (currentSelection && activeFile) {
      handleOptimizeCode(currentSelection.code, activeFile, currentSelection.selection);
      setFloatingActionsVisible(false);
    }
  }, [currentSelection, activeFile, handleOptimizeCode]);

  const handleFloatingAddTests = useCallback(() => {
    if (currentSelection && activeFile) {
      handleAddTests(currentSelection.code, activeFile, currentSelection.selection);
      setFloatingActionsVisible(false);
    }
  }, [currentSelection, activeFile, handleAddTests]);

  // Note: TypeScript configuration and type definitions are now loaded
  // automatically by the useLanguageService hook (MonacoLanguageService)

  // Set active file when selectedFile changes (from sidebar)
  useEffect(() => {
    if (selectedFile && selectedFile !== activeFile) {
      setActiveFile(selectedFile);
      setViewMode('edit'); // Reset to edit mode when switching files
    }
  }, [selectedFile]);

  // Set initial active file when openFiles changes
  useEffect(() => {
    if (!activeFile && openFiles.length > 0) {
      setActiveFile(openFiles[0]);
    }
  }, [openFiles.length]);

  // ✅ Use normalized path for file content lookup
  const fileContent = normalizedActiveFile ? fileContents.get(normalizedActiveFile) || '' : '';
  const hasUnsavedChanges = normalizedActiveFile ? unsavedChanges.get(normalizedActiveFile) || false : false;
  const isMarkdown = normalizedActiveFile?.toLowerCase().endsWith('.md') || normalizedActiveFile?.toLowerCase().endsWith('.markdown');

  // Track opened files in LSP
  const openedLSPFiles = useRef<Set<string>>(new Set());

  // Cleanup: Close all LSP documents on unmount
  useEffect(() => {
    return () => {
      if (languageService && languageServiceMode === 'lsp') {
        openedLSPFiles.current.forEach(async (file) => {
          try {
            const fileUri = `file:///${file}`;
            await (languageService as any).closeDocument(fileUri);
            console.log('[EditorPanel] ✅ LSP: Document closed on unmount:', file);
          } catch (error) {
            console.error('[EditorPanel] LSP cleanup error:', error);
          }
        });
        openedLSPFiles.current.clear();
      }
    };
  }, [languageService, languageServiceMode]);

  // Load file contents when active file changes
  useEffect(() => {
    if (!normalizedActiveFile) {
      return;
    }

    // ✅ Use normalized path for cache check
    if (fileContents.has(normalizedActiveFile)) {
      console.log('[EditorPanel] File content already loaded (cache hit):', normalizedActiveFile);
      return;
    }

    const loadFileContent = async () => {
      setIsLoadingFile(true);
      try {
        console.log('[EditorPanel] Loading file (normalized):', normalizedActiveFile);
        // ✅ Use normalized path for IPC call
        const result = await ipcRenderer.invoke('workspace:read-file', workspace.path, normalizedActiveFile);

        if (result.success) {
          // ✅ Store with normalized path as key
          setFileContents(prev => new Map(prev).set(normalizedActiveFile, result.content));

          // Notify LSP that document was opened
          if (languageService && isLanguageServiceInitialized && languageServiceMode === 'lsp') {
            // ✅ Use normalized path for LSP URI
            const fileUri = `file:///${normalizedActiveFile}`;
            const languageId = getLanguageFromFilePath(normalizedActiveFile);

            // Map Monaco language IDs to LSP language IDs
            const lspLanguageId = languageId === 'typescriptreact' ? 'typescriptreact' :
                                   languageId === 'typescript' ? 'typescript' :
                                   languageId === 'javascriptreact' ? 'javascriptreact' :
                                   languageId === 'javascript' ? 'javascript' : 'typescript';

            await (languageService as any).openDocument(fileUri, lspLanguageId, result.content);
            // ✅ Track with normalized path
            openedLSPFiles.current.add(normalizedActiveFile);
            console.log('[EditorPanel] ✅ LSP: Document opened:', normalizedActiveFile);
          }
        } else {
          console.error('[EditorPanel] Failed to load file:', result.error);
          // ✅ Store error with normalized path
          setFileContents(prev => new Map(prev).set(normalizedActiveFile, `// Error loading file: ${result.error}`));
        }
      } catch (error) {
        console.error('[EditorPanel] Error loading file:', error);
        // ✅ Store error with normalized path
        setFileContents(prev => new Map(prev).set(normalizedActiveFile, `// Error: ${error}`));
      } finally {
        setIsLoadingFile(false);
      }
    };

    loadFileContent();
  }, [normalizedActiveFile, workspace.path, languageService, isLanguageServiceInitialized, languageServiceMode]);

  // Close documents when files are removed from openFiles
  useEffect(() => {
    if (!languageService || !isLanguageServiceInitialized || languageServiceMode !== 'lsp') {
      return;
    }

    // Find files that were opened in LSP but are no longer in openFiles
    const currentOpenFiles = new Set(openFiles);
    const filesToClose: string[] = [];

    openedLSPFiles.current.forEach(file => {
      if (!currentOpenFiles.has(file)) {
        filesToClose.push(file);
      }
    });

    // Close documents in LSP
    filesToClose.forEach(async (file) => {
      try {
        const fileUri = `file:///${file}`;
        await (languageService as any).closeDocument(fileUri);
        openedLSPFiles.current.delete(file);
        console.log('[EditorPanel] ✅ LSP: Document closed:', file);
      } catch (error) {
        console.error('[EditorPanel] LSP close error:', error);
      }
    });
  }, [openFiles, languageService, isLanguageServiceInitialized, languageServiceMode]);

  // Save file
  const handleSaveFile = async () => {
    if (!normalizedActiveFile || !hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      console.log('[EditorPanel] Saving file (normalized):', normalizedActiveFile);
      // ✅ Use normalized path for file content lookup
      const content = fileContents.get(normalizedActiveFile) || '';
      // ✅ Use normalized path for IPC call
      const result = await ipcRenderer.invoke('workspace:write-file', workspace.path, normalizedActiveFile, content);

      if (result.success) {
        console.log('[EditorPanel] File saved successfully');
        // ✅ Update unsaved changes with normalized path
        setUnsavedChanges(prev => new Map(prev).set(normalizedActiveFile, false));

        // Notify parent that file is saved (no unsaved changes)
        onUnsavedChange?.(normalizedActiveFile, false);
      } else {
        console.error('[EditorPanel] Failed to save file:', result.error);
        alert(`Failed to save file: ${result.error}`);
      }
    } catch (error) {
      console.error('[EditorPanel] Error saving file:', error);
      alert(`Error saving file: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle content change
  // Debounced LSP update
  const updateLSPDebounced = useRef<NodeJS.Timeout | null>(null);

  const handleContentChange = (value: string | undefined) => {
    if (!normalizedActiveFile || value === undefined) return;

    // ✅ Use normalized path for file content lookup
    const currentContent = fileContents.get(normalizedActiveFile) || '';
    if (value !== currentContent) {
      // ✅ Store with normalized path
      setFileContents(prev => new Map(prev).set(normalizedActiveFile, value));
      setUnsavedChanges(prev => new Map(prev).set(normalizedActiveFile, true));

      // Notify parent about unsaved changes
      onUnsavedChange?.(normalizedActiveFile, true);

      // Notify LSP about document changes (debounced to avoid too many updates)
      if (languageService && isLanguageServiceInitialized && languageServiceMode === 'lsp') {
        // Clear previous timeout
        if (updateLSPDebounced.current) {
          clearTimeout(updateLSPDebounced.current);
        }

        // Set new timeout (500ms delay)
        updateLSPDebounced.current = setTimeout(async () => {
          try {
            // ✅ Use normalized path for LSP URI
            const fileUri = `file:///${normalizedActiveFile}`;
            await (languageService as any).updateDocument(fileUri, value);
            console.log('[EditorPanel] ✅ LSP: Document updated:', normalizedActiveFile);
          } catch (error) {
            console.error('[EditorPanel] LSP update error:', error);
          }
        }, 500);
      }
    }
  };

  // Handle Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, hasUnsavedChanges, fileContent]);

  // Handle Monaco editor mount
  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Log model info for debugging
    const model = editor.getModel();
    if (model && activeFile) {
      console.log(`[EditorPanel] Model mounted:`, {
        file: activeFile,
        language: model.getLanguageId(),
        uri: model.uri.toString()
      });

      // Refresh diagnostics using language service
      if (languageService && isLanguageServiceInitialized) {
        setTimeout(async () => {
          try {
            await languageService.refreshDiagnostics(model.uri.toString());
            const diagnostics = await languageService.getDiagnostics(model.uri.toString());
            console.log(`[EditorPanel] Current diagnostics for ${activeFile}: ${diagnostics.length} issues`);
            console.log('[EditorPanel] ✅ Diagnostics refreshed via language service');
          } catch (error) {
            console.error('[EditorPanel] Failed to refresh diagnostics:', error);
          }
        }, 100); // Small delay to ensure TypeScript worker is ready
      } else {
        console.log('[EditorPanel] Language service not yet initialized');
      }
    }

    // Listen for selection changes to show/hide floating actions
    editor.onDidChangeCursorSelection((e) => {
      const selection = e.selection;
      const model = editor.getModel();

      if (!model || selection.isEmpty()) {
        // No selection or empty selection - hide floating actions
        setFloatingActionsVisible(false);
        setCurrentSelection(null);
        return;
      }

      // Get selected text
      const selectedText = model.getValueInRange(selection);

      if (!selectedText.trim()) {
        // Only whitespace selected - hide floating actions
        setFloatingActionsVisible(false);
        setCurrentSelection(null);
        return;
      }

      // Store current selection
      setCurrentSelection({
        code: selectedText,
        selection
      });

      // Calculate position for floating action bar
      // Position it above the selection start
      const position = editor.getScrolledVisiblePosition(selection.getStartPosition());

      if (position) {
        const editorDom = editor.getDomNode();
        if (!editorDom) return;

        const editorRect = editorDom.getBoundingClientRect();

        // Position above the selection with some offset
        const top = editorRect.top + position.top - 45; // 45px above selection
        const left = editorRect.left + position.left;

        setFloatingActionsPosition({ top, left });
        setFloatingActionsVisible(true);
      }
    });

    // Add context menu actions for Claude AI assistance
    editor.addAction({
      id: 'ask-claude-about-selection',
      label: '💬 Ask Claude about this',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 1,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK
      ],
      run: (ed) => {
        const selection = ed.getSelection();
        if (!selection) return;
        const selectedText = ed.getModel()?.getValueInRange(selection);

        if (selectedText && activeFile) {
          handleAskAboutCode(selectedText, activeFile, selection);
        }
      }
    });

    editor.addAction({
      id: 'explain-code',
      label: '📖 Explain this code',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 2,
      run: (ed) => {
        const selection = ed.getSelection();
        if (!selection) return;
        const selectedText = ed.getModel()?.getValueInRange(selection);

        if (selectedText && activeFile) {
          handleExplainCode(selectedText, activeFile, selection);
        }
      }
    });

    editor.addAction({
      id: 'optimize-code',
      label: '⚡ Optimize this',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 3,
      run: (ed) => {
        const selection = ed.getSelection();
        if (!selection) return;
        const selectedText = ed.getModel()?.getValueInRange(selection);

        if (selectedText && activeFile) {
          handleOptimizeCode(selectedText, activeFile, selection);
        }
      }
    });

    editor.addAction({
      id: 'add-tests',
      label: '🧪 Add tests for this',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 4,
      run: (ed) => {
        const selection = ed.getSelection();
        if (!selection) return;
        const selectedText = ed.getModel()?.getValueInRange(selection);

        if (selectedText && activeFile) {
          handleAddTests(selectedText, activeFile, selection);
        }
      }
    });
  };

  // Register Monaco Hover Provider for AI explanations
  useEffect(() => {
    if (!settings.monaco.enableHover || !sessionId) return;

    const disposable = monaco.languages.registerHoverProvider(['typescript', 'javascript', 'python', 'java', 'go', 'rust'], {
      provideHover: async (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        // Get surrounding context (3 lines before and after)
        const startLine = Math.max(1, position.lineNumber - 3);
        const endLine = Math.min(model.getLineCount(), position.lineNumber + 3);
        const context = model.getValueInRange({
          startLineNumber: startLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: model.getLineMaxColumn(endLine)
        });

        const language = model.getLanguageId();

        try {
          // Call IPC handler for quick explanation
          const result = await ipcRenderer.invoke('claude:quick-explain', {
            word: word.word,
            context,
            language,
            aiMode: settings.monaco.aiMode
          });

          if (!result.success) return null;

          return {
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            ),
            contents: [
              { value: `**${word.word}**` },
              { value: result.explanation },
              {
                value: '[더 자세히 알아보기 →](command:circuit.explainInChat)',
                isTrusted: true
              }
            ]
          };
        } catch (error) {
          console.error('[Monaco Hover] Error:', error);
          return null;
        }
      }
    });

    return () => disposable.dispose();
  }, [settings.monaco.enableHover, settings.monaco.aiMode, sessionId]);

  // Register AI Completion Provider
  useEffect(() => {
    if (!settings.monaco.enableAutocompletion || !sessionId) return;

    // Simple cache for completions (cleared every 5 minutes)
    const completionCache = new Map<string, { completion: string, timestamp: number }>();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    const disposable = monaco.languages.registerCompletionItemProvider(
      ['typescript', 'javascript', 'python', 'java', 'go', 'rust'],
      {
        triggerCharacters: ['.', '(', '<', '{', ' '],
        provideCompletionItems: async (model, position) => {
          try {
            // Get code context
            const currentLine = model.getLineContent(position.lineNumber);
            const prefix = model.getValueInRange({
              startLineNumber: Math.max(1, position.lineNumber - 10),
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            });

            const suffix = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 5),
              endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), position.lineNumber + 5))
            });

            // Build context (20 lines around cursor)
            const startLine = Math.max(1, position.lineNumber - 10);
            const endLine = Math.min(model.getLineCount(), position.lineNumber + 10);
            const context = model.getValueInRange({
              startLineNumber: startLine,
              startColumn: 1,
              endLineNumber: endLine,
              endColumn: model.getLineMaxColumn(endLine)
            });

            const language = model.getLanguageId();

            // Check cache if enabled
            const cacheKey = `${prefix}|${suffix}|${language}`;
            if (settings.monaco.cacheCompletions) {
              const cached = completionCache.get(cacheKey);
              if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                return {
                  suggestions: [{
                    label: '⚡ AI Suggestion',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: cached.completion,
                    detail: 'Claude AI (cached)',
                    documentation: 'AI-powered code completion',
                    range: new monaco.Range(
                      position.lineNumber,
                      position.column,
                      position.lineNumber,
                      position.column
                    )
                  }]
                };
              }
            }

            // Debounce: Wait for completion delay
            await new Promise(resolve => setTimeout(resolve, settings.monaco.completionDelay || 300));

            // Request AI completion
            const result = await ipcRenderer.invoke('claude:ai-completion', {
              prefix,
              suffix,
              context,
              language,
              aiMode: settings.monaco.aiMode,
              maxTokens: settings.monaco.maxTokens || 150
            });

            if (!result.success || !result.completion) {
              return { suggestions: [] };
            }

            // Cache the result
            if (settings.monaco.cacheCompletions) {
              completionCache.set(cacheKey, {
                completion: result.completion,
                timestamp: Date.now()
              });
            }

            // Return completion suggestion
            return {
              suggestions: [{
                label: '⚡ AI Suggestion',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: result.completion,
                detail: `Claude AI (${settings.monaco.aiMode})`,
                documentation: 'AI-powered code completion',
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column
                ),
                sortText: '0' // Prioritize AI suggestions
              }]
            };
          } catch (error) {
            console.error('[Monaco Completion] Error:', error);
            return { suggestions: [] };
          }
        }
      }
    );

    return () => disposable.dispose();
  }, [
    settings.monaco.enableAutocompletion,
    settings.monaco.aiMode,
    settings.monaco.completionDelay,
    settings.monaco.maxTokens,
    settings.monaco.cacheCompletions,
    sessionId
  ]);

  // Jump to line when fileCursorPosition changes
  useEffect(() => {
    if (!editorRef.current || !fileCursorPosition) return;
    if (fileCursorPosition.filePath !== activeFile) return;

    const editor = editorRef.current;
    const { lineStart, lineEnd } = fileCursorPosition;

    // Reveal line in center of editor
    editor.revealLineInCenter(lineStart);

    // Set cursor position
    editor.setPosition({ lineNumber: lineStart, column: 1 });

    // Highlight line range with animation
    const decorations = editor.deltaDecorations([], [
      {
        range: new monaco.Range(lineStart, 1, lineEnd, 1),
        options: {
          isWholeLine: true,
          className: 'highlighted-line-reference',
          glyphMarginClassName: 'highlighted-line-glyph'
        }
      }
    ]);

    // Clear highlight after 2 seconds
    const timeout = setTimeout(() => {
      editor.deltaDecorations(decorations, []);
    }, 2000);

    // Focus editor
    editor.focus();

    return () => clearTimeout(timeout);
  }, [fileCursorPosition, activeFile]);

  return (
    <div className="h-full flex flex-col">
      {/* Editor Content */}
      {!activeFile ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p>No files open</p>
            <p className="text-xs mt-2">Files will appear here when Claude edits them</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative min-h-0">
          {/* Floating Code Actions (appears on selection) */}
          <FloatingCodeActions
            visible={floatingActionsVisible}
            position={floatingActionsPosition}
            onAsk={handleFloatingAsk}
            onExplain={handleFloatingExplain}
            onOptimize={handleFloatingOptimize}
            onAddTests={handleFloatingAddTests}
          />

          {/* Floating Edit/Preview Toggle (only for markdown) */}
          {isMarkdown && (
            <div className="absolute top-3 right-3 z-10">
              <div className="flex items-center gap-1 bg-secondary/95 backdrop-blur-sm rounded-md p-1 shadow-lg border border-border">
                <button
                  onClick={() => setViewMode('edit')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    viewMode === 'edit'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Edit
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    viewMode === 'preview'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Preview
                </button>
              </div>
            </div>
          )}

          {isLoadingFile ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-sm text-muted-foreground">Loading {activeFile}...</div>
            </div>
          ) : isMarkdown && viewMode === 'preview' ? (
            <MarkdownPreview content={fileContent} />
          ) : (
            <Editor
              height="100%"
              path={normalizedActiveFile || undefined} // ✅ Use normalized path for Monaco model URI
              language={getLanguageFromFilePath(normalizedActiveFile || '')}
              value={fileContent}
              onChange={handleContentChange}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              options={{
                readOnly: false,
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Code", "Courier New", monospace',
                fontWeight: '400',
                fontLigatures: true,
                lineHeight: 1.5,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                // Find/Replace 기능 명시적 활성화
                find: {
                  seedSearchStringFromSelection: 'selection',
                  autoFindInSelection: 'never',
                  addExtraSpaceOnTop: true,
                  loop: true,
                },
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export { EditorPanel };
