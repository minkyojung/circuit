/**
 * Shared types for WorkspaceChatEditor, ChatPanel, and EditorPanel
 *
 * This file contains all interface and type definitions used across
 * the workspace chat editor components to prevent circular dependencies.
 */

import type { Workspace } from '@/types/workspace';

/**
 * View mode for the workspace editor
 */
export type ViewMode = 'chat' | 'editor' | 'split';

/**
 * File cursor position for jumping to a specific line in a file
 */
export interface FileCursorPosition {
  filePath: string;
  lineStart: number;
  lineEnd: number;
}

/**
 * Code selection action from the editor
 * Used to trigger AI actions on selected code
 */
export interface CodeSelectionAction {
  type: 'ask' | 'explain' | 'optimize' | 'add-tests';
  code: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
}

/**
 * Props for the main WorkspaceChatEditor component
 */
export interface WorkspaceChatEditorProps {
  workspace: Workspace;
  selectedFile: string | null;
  prefillMessage?: string | null;
  conversationId?: string | null;
  onPrefillCleared?: () => void;
  onConversationChange?: (conversationId: string | null) => void;

  // View mode props (lifted to App.tsx)
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;

  // Open files props (lifted to App.tsx)
  openFiles?: string[];

  // Unsaved changes callback
  onUnsavedChange?: (filePath: string, hasChanges: boolean) => void;

  // File reference click callback
  onFileReferenceClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void;

  // File cursor position for jumping to line
  fileCursorPosition?: FileCursorPosition | null;

  // Active file path for editor tabs
  activeFilePath?: string | null;
  onFileChange?: (filePath: string) => void;
  onCloseFile?: (filePath: string) => void;

  // Unsaved files state
  unsavedFiles?: Set<string>;
}

/**
 * Props for the ChatPanel component
 */
export interface ChatPanelProps {
  workspace: Workspace;
  sessionId: string | null;
  onFileEdit: (filePath: string) => void;
  prefillMessage?: string | null;
  externalConversationId?: string | null;
  onPrefillCleared?: () => void;
  onConversationChange?: (conversationId: string | null) => void;
  onFileReferenceClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void;
  codeSelectionAction?: CodeSelectionAction | null;
  onCodeSelectionHandled?: () => void;
}

/**
 * Props for the EditorPanel component
 */
export interface EditorPanelProps {
  workspace: Workspace;
  sessionId: string | null;  // Claude session ID for AI features
  openFiles: string[];
  selectedFile: string | null;
  onCloseFile?: (filePath: string) => void;
  onUnsavedChange?: (filePath: string, hasChanges: boolean) => void;
  fileCursorPosition?: FileCursorPosition | null;
  onCodeSelectionAction?: (action: CodeSelectionAction) => void;
}
