/**
 * WorkspaceChatEditor Component
 *
 * Orchestrates the workspace editor experience with three modes:
 * - Chat Only: Full-screen chat interface
 * - Editor Only: Full-screen code editor
 * - Split View: Chat and editor side-by-side
 *
 * This component has been refactored into separate files:
 * - ChatPanel.tsx: Chat interface with AI
 * - EditorPanel.tsx: Monaco code editor
 * - WorkspaceChatEditor.types.ts: Shared type definitions
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Workspace } from '@/types/workspace';
import type {
  ViewMode,
  FileCursorPosition,
  CodeSelectionAction,
  WorkspaceChatEditorProps,
} from './WorkspaceChatEditor.types';
import { ChatPanel } from './ChatPanel';
import { EditorPanel } from './EditorPanel';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { ConversationTabsOnly } from './ConversationTabsOnly';
import { FileTabsOnly } from './FileTabsOnly';
import { useSettingsContext } from '@/contexts/SettingsContext';

const ipcRenderer = window.electron.ipcRenderer;

export const WorkspaceChatEditor: React.FC<WorkspaceChatEditorProps> = ({
  workspace,
  selectedFile,
  prefillMessage = null,
  conversationId: externalConversationId = null,
  onPrefillCleared,
  onConversationChange,
  viewMode: externalViewMode,
  onViewModeChange,
  openFiles: externalOpenFiles = [],
  onUnsavedChange,
  onFileReferenceClick,
  fileCursorPosition,
  activeFilePath,
  onFileChange,
  onCloseFile,
  unsavedFiles = new Set()
}) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { settings } = useSettingsContext();

  // Use external viewMode if provided, otherwise use local state
  const viewMode = externalViewMode || 'chat';
  const openFiles = externalOpenFiles;

  // Code selection state for editor → chat communication
  const [codeSelectionAction, setCodeSelectionAction] = useState<CodeSelectionAction | null>(null);

  // File edit handler
  const handleFileEdit = (filePath: string) => {
    // This will be handled by parent (App.tsx) through file selection
    console.log('[WorkspaceChatEditor] File edited:', filePath);
  };

  // File close handler - delegate to parent
  const handleCloseFile = (filePath: string) => {
    // Will be handled by parent via UnifiedTabs
    console.log('[WorkspaceChatEditor] File closed:', filePath);
  };

  // Code selection handler - from EditorPanel
  const handleCodeSelectionAction = useCallback((action: CodeSelectionAction) => {
    console.log('[WorkspaceChatEditor] Code selection action:', action.type);

    // Auto-convert to split view if currently in editor-only mode
    if (viewMode === 'editor' && onViewModeChange) {
      console.log('[WorkspaceChatEditor] Auto-converting from editor to split view');
      onViewModeChange('split');
    }

    // Store action for ChatPanel to handle
    setCodeSelectionAction(action);
  }, [viewMode, onViewModeChange]);

  // Start Claude session when workspace changes
  useEffect(() => {
    const startSession = async () => {
      console.log('[WorkspaceChatEditor] Starting Claude session for:', workspace.path);
      const result = await ipcRenderer.invoke('claude:start-session', workspace.path);

      if (result.success) {
        console.log('[WorkspaceChatEditor] Claude session started:', result.sessionId);
        setSessionId(result.sessionId);
      } else {
        console.error('[WorkspaceChatEditor] Failed to start Claude session:', result.error);
        alert(`Failed to start Claude session: ${result.error}`);
      }
    };

    startSession();
  }, [workspace.path]);

  // Cleanup session when component unmounts or sessionId changes
  useEffect(() => {
    return () => {
      if (sessionId) {
        console.log('[WorkspaceChatEditor] Stopping Claude session:', sessionId);
        ipcRenderer.invoke('claude:stop-session', sessionId);
      }
    };
  }, [sessionId]);


  return (
    <div className="h-full">
      {viewMode === 'chat' && (
        /* Chat Only Mode */
        <div className="h-full">
          <ChatPanel
            workspace={workspace}
            sessionId={sessionId}
            onFileEdit={handleFileEdit}
            prefillMessage={prefillMessage}
            externalConversationId={externalConversationId}
            onPrefillCleared={onPrefillCleared}
            onConversationChange={onConversationChange}
            onFileReferenceClick={onFileReferenceClick}
            codeSelectionAction={codeSelectionAction}
            onCodeSelectionHandled={() => setCodeSelectionAction(null)}
          />
        </div>
      )}

      {viewMode === 'editor' && (
        /* Editor Only Mode */
        <div className="h-full">
          <EditorPanel
            workspace={workspace}
            sessionId={sessionId}
            openFiles={openFiles}
            selectedFile={selectedFile}
            onCloseFile={handleCloseFile}
            onUnsavedChange={onUnsavedChange}
            fileCursorPosition={fileCursorPosition}
            onCodeSelectionAction={handleCodeSelectionAction}
          />
        </div>
      )}

      {viewMode === 'split' && (
        /* Split View - Chat and Editor side by side with independent tabs */
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              {/* Conversation Tabs for ChatPanel */}
              <ConversationTabsOnly
                workspaceId={workspace.id}
                workspaceName={workspace.name}
                activeConversationId={externalConversationId}
                onConversationChange={onConversationChange || (() => {})}
              />
              {/* Chat Content */}
              <div className="flex-1 min-h-0">
                <ChatPanel
                  workspace={workspace}
                  sessionId={sessionId}
                  onFileEdit={handleFileEdit}
                  prefillMessage={prefillMessage}
                  externalConversationId={externalConversationId}
                  onPrefillCleared={onPrefillCleared}
                  onConversationChange={onConversationChange}
                  onFileReferenceClick={onFileReferenceClick}
                  codeSelectionAction={codeSelectionAction}
                  onCodeSelectionHandled={() => setCodeSelectionAction(null)}
                />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              {/* File Tabs for EditorPanel */}
              <FileTabsOnly
                openFiles={openFiles.map(path => ({
                  path,
                  unsavedChanges: unsavedFiles.has(path)
                }))}
                activeFilePath={activeFilePath || selectedFile}
                onFileChange={onFileChange || (() => {})}
                onCloseFile={onCloseFile || handleCloseFile}
              />
              {/* Editor Content */}
              <div className="flex-1 min-h-0">
                <EditorPanel
                  workspace={workspace}
                  sessionId={sessionId}
                  openFiles={openFiles}
                  selectedFile={activeFilePath || selectedFile}
                  onCloseFile={onCloseFile || handleCloseFile}
                  onUnsavedChange={onUnsavedChange}
                  fileCursorPosition={fileCursorPosition}
                  onCodeSelectionAction={handleCodeSelectionAction}
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
};

// Re-export components from separate files for backward compatibility
export { ChatPanel } from './ChatPanel';
export { EditorPanel } from './EditorPanel';
