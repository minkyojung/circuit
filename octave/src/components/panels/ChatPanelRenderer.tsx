/**
 * ChatPanelRenderer Component
 *
 * Renders the ChatPanel with all necessary props and handlers.
 * Extracted from App.tsx render function for better organization.
 *
 * This component handles:
 * - Claude AI chat interface
 * - Conversation tab management on conversation change
 * - File reference clicks
 * - Code selection actions
 * - Prefill message handling
 */

import { ChatPanel } from '@/components/workspace/WorkspaceChatEditor';
import { createConversationTab } from '@/types/editor';
import type { Workspace } from '@/types/workspace';

const ipcRenderer = window.electron.ipcRenderer;

interface ChatPanelRendererProps {
  conversationId: string;
  workspaceId: string;
  selectedWorkspace: Workspace | null;
  sessionId: string | null;
  handleFileSelect: (filePath: string, lineStart?: number, lineEnd?: number) => void;
  chatPrefillMessage: string | null;
  setChatPrefillMessage: (message: string | null) => void;
  openTab: (tab: any, groupId?: string) => void;
  codeSelectionAction: {
    type: 'ask' | 'explain' | 'optimize' | 'add-tests';
    code: string;
    filePath: string;
    lineStart: number;
    lineEnd: number;
  } | null;
  setCodeSelectionAction: (action: any) => void;
}

export function ChatPanelRenderer({
  conversationId,
  workspaceId,
  selectedWorkspace,
  sessionId,
  handleFileSelect,
  chatPrefillMessage,
  setChatPrefillMessage,
  openTab,
  codeSelectionAction,
  setCodeSelectionAction,
}: ChatPanelRendererProps) {
  if (!selectedWorkspace) return null;

  return (
    <ChatPanel
      workspace={selectedWorkspace}
      sessionId={sessionId}
      onFileEdit={handleFileSelect}
      prefillMessage={chatPrefillMessage}
      externalConversationId={conversationId}
      onPrefillCleared={() => setChatPrefillMessage(null)}
      onConversationChange={async (convId) => {
        // Update the conversation tab when conversation changes
        if (convId && convId !== conversationId) {
          try {
            // Fetch conversation to get title
            const result = await ipcRenderer.invoke('conversation:get', convId);
            const conversationTitle = result?.conversation?.title || 'Chat';

            const newTab = createConversationTab(convId, workspaceId, conversationTitle, selectedWorkspace?.name);
            openTab(newTab);
          } catch (error) {
            console.error('[ChatPanelRenderer] Error fetching conversation title:', error);
            // Fallback to workspace name
            const newTab = createConversationTab(convId, workspaceId, undefined, selectedWorkspace?.name);
            openTab(newTab);
          }
        }
      }}
      onFileReferenceClick={handleFileSelect}
      codeSelectionAction={codeSelectionAction}
      onCodeSelectionHandled={() => setCodeSelectionAction(null)}
    />
  );
}
