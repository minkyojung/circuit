/**
 * EditorPanelRenderer Component
 *
 * Renders the EditorPanel (Monaco editor) with all necessary props and handlers.
 * Extracted from App.tsx render function for better organization.
 *
 * This component handles:
 * - File editing via Monaco editor
 * - Multiple open files management
 * - File tab closing
 * - Unsaved changes tracking
 * - File cursor positioning (jump to line)
 * - Code selection actions
 */

import { EditorPanel } from '@/components/workspace/WorkspaceChatEditor';
import type { Workspace } from '@/types/workspace';

interface EditorPanelRendererProps {
  filePath: string;
  selectedWorkspace: Workspace | null;
  sessionId: string | null;
  getAllTabs: () => any[];
  findTab: (tabId: string) => { tab: any; groupId: string } | null;
  closeTab: (tabId: string, groupId: string) => void;
  handleUnsavedChange: (filePath: string, hasChanges: boolean) => void;
  fileCursorPosition: {
    filePath: string;
    lineStart: number;
    lineEnd: number;
  } | null;
  setCodeSelectionAction: (action: any) => void;
}

export function EditorPanelRenderer({
  filePath,
  selectedWorkspace,
  sessionId,
  getAllTabs,
  findTab,
  closeTab,
  handleUnsavedChange,
  fileCursorPosition,
  setCodeSelectionAction,
}: EditorPanelRendererProps) {
  if (!selectedWorkspace) return null;

  // Get all file tabs for openFiles list
  const fileTabs = getAllTabs().filter((t) => t.type === 'file');
  const openFilePaths = fileTabs.map((t) => (t as any).data.filePath);

  return (
    <EditorPanel
      workspace={selectedWorkspace}
      sessionId={sessionId}
      openFiles={openFilePaths}
      selectedFile={filePath}
      onCloseFile={(path) => {
        // Find and close the file tab (using workspace-scoped ID)
        const tabId = `file-${selectedWorkspace.id}-${path}`;
        const result = findTab(tabId);
        if (result) {
          closeTab(result.tab.id, result.groupId);
        }
      }}
      onUnsavedChange={handleUnsavedChange}
      fileCursorPosition={fileCursorPosition}
      onCodeSelectionAction={setCodeSelectionAction}
    />
  );
}
