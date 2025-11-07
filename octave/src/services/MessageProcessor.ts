/**
 * Message Processor Service
 *
 * Handles message creation and updates for Claude responses
 * Extracted from WorkspaceChatEditor.tsx handleResponseComplete
 */

import type { Message } from '@/types/conversation';
import type { ThinkingStep } from '@/types/thinking';

// @ts-ignore
const ipcRenderer = window.electron.ipcRenderer;

export interface ProcessMessageOptions {
  // Response data
  responseMessage: string;
  responseSessionId: string;

  // Thinking data
  thinkingSteps: ThinkingStep[];
  thinkingDuration: number;

  // Pending message tracking
  pendingAssistantMessageId: string | null;
  pendingUserMessage: Message | null;

  // Workspace context (for file path normalization)
  workspacePath?: string;

  // Callbacks
  onMessageUpdate: (id: string, updates: Partial<Message>) => void;
  onMessageAdd: (message: Message) => void;
  onMessageThinkingStepsUpdate: (
    messageId: string,
    data: { steps: ThinkingStep[]; duration: number }
  ) => void;
}

export interface ProcessMessageResult {
  assistantMessageId: string;
  message: Message;
  blocks?: any[];
}

export class MessageProcessor {
  /**
   * Process Claude response and create/update assistant message
   * Returns the assistant message ID and message object
   */
  static async processResponse(
    options: ProcessMessageOptions
  ): Promise<ProcessMessageResult | null> {
    const {
      responseMessage,
      thinkingSteps,
      thinkingDuration,
      pendingAssistantMessageId,
      pendingUserMessage,
      onMessageUpdate,
      onMessageAdd,
      onMessageThinkingStepsUpdate,
    } = options;

    if (!pendingUserMessage) {
      console.error('[MessageProcessor] No pending user message');
      return null;
    }

    let assistantMessageId = pendingAssistantMessageId;

    // ========================================================================
    // Path 1: Update existing assistant message
    // ========================================================================

    if (assistantMessageId) {
      console.log('[MessageProcessor] Updating existing message:', assistantMessageId);

      // Update existing assistant message with content
      onMessageUpdate(assistantMessageId, {
        content: responseMessage,
        metadata: {
          thinkingSteps,
          thinkingDuration,
        },
      });

      // Create complete message object for saving
      const assistantMessage: Message = {
        id: assistantMessageId,
        conversationId: pendingUserMessage.conversationId,
        role: 'assistant',
        content: responseMessage,
        timestamp: Date.now(),
        metadata: {
          thinkingSteps,
          thinkingDuration,
        },
      };

      // Save thinking steps to memory
      onMessageThinkingStepsUpdate(assistantMessageId, {
        steps: [...thinkingSteps],
        duration: thinkingDuration,
      });

      // Save assistant message to database (with thinking steps in metadata)
      // ✅ Pass workspacePath for file path normalization
      const saveResult = await ipcRenderer.invoke('message:save', assistantMessage, options.workspacePath);
      console.log('[MessageProcessor] 📦 Save result:', {
        success: saveResult.success,
        blockCount: saveResult.blockCount,
        blocks: saveResult.blocks,
        hasFileSummary: saveResult.blocks?.some((b: any) => b.type === 'file-summary')
      });
      if (saveResult.success && saveResult.blocks) {
        onMessageUpdate(assistantMessageId, { blocks: saveResult.blocks });
      }

      console.log('[MessageProcessor] ✅ Assistant message updated with content and blocks');

      return {
        assistantMessageId,
        message: assistantMessage,
        blocks: saveResult?.blocks,
      };
    }

    // ========================================================================
    // Path 2: Create new assistant message (fallback)
    // ========================================================================

    console.warn('[MessageProcessor] ⚠️  No pending assistant message ID, creating new message');

    const newAssistantMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: pendingUserMessage.conversationId,
      role: 'assistant',
      content: responseMessage,
      timestamp: Date.now(),
      metadata: {
        thinkingSteps,
        thinkingDuration,
      },
    };

    // Set assistantMessageId for auto-open reasoning
    assistantMessageId = newAssistantMessage.id;

    // Add to UI
    onMessageAdd(newAssistantMessage);

    // Save thinking steps to memory
    onMessageThinkingStepsUpdate(newAssistantMessage.id, {
      steps: [...thinkingSteps],
      duration: thinkingDuration,
    });

    // Save assistant message to database
    // ✅ Pass workspacePath for file path normalization
    const saveResult = await ipcRenderer.invoke('message:save', newAssistantMessage, options.workspacePath);
    console.log('[MessageProcessor] 📦 Save result:', {
      success: saveResult.success,
      blockCount: saveResult.blockCount,
      blocks: saveResult.blocks,
      hasFileSummary: saveResult.blocks?.some((b: any) => b.type === 'file-summary')
    });
    if (saveResult.success && saveResult.blocks) {
      onMessageUpdate(newAssistantMessage.id, { blocks: saveResult.blocks });
    }

    console.log('[MessageProcessor] ✅ New assistant message created');

    return {
      assistantMessageId,
      message: newAssistantMessage,
      blocks: saveResult?.blocks,
    };
  }

}
