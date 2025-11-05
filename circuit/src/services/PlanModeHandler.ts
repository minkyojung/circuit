/**
 * Plan Mode Handler Service
 *
 * Handles Plan Mode validation and retry logic
 * Extracted from WorkspaceChatEditor.tsx handleResponseComplete
 */

import { FEATURES } from '@/config/features';
import {
  extractTodoWriteFromBlocks,
  extractPlanFromText,
} from '@/lib/planModeUtils';
import type { Message } from '@/types/conversation';

// @ts-ignore
const { ipcRenderer } = window.require('electron');

export interface PlanModeValidationOptions {
  // Message data
  assistantMessage: Message;
  assistantMessageId: string;
  blocks: any[] | undefined;
  responseMessage: string;

  // Plan Mode state
  currentThinkingMode: import('@/components/workspace/ChatInput').ThinkingMode;
  sessionId: string;

  // Callbacks
  onMessageUpdate: (id: string, updates: Partial<Message>) => void;
}

export interface PlanModeValidationResult {
  hasPlan: boolean;
  todoWriteData: any | null;
  retryTriggered: boolean;
}

export class PlanModeHandler {
  /**
   * Validate Plan Mode response and retry if plan is missing
   * Returns validation result and whether a retry was triggered
   */
  static async validatePlanMode(
    options: PlanModeValidationOptions
  ): Promise<PlanModeValidationResult> {
    const {
      assistantMessage,
      assistantMessageId,
      blocks,
      responseMessage,
      currentThinkingMode,
      sessionId,
      onMessageUpdate,
    } = options;

    // Only execute if PLAN_MODE feature is enabled
    if (!FEATURES.PLAN_MODE) {
      return { hasPlan: false, todoWriteData: null, retryTriggered: false };
    }

    // Check if we're in Plan Mode
    const isPlanMode = currentThinkingMode === 'plan';
    if (!isPlanMode) {
      return { hasPlan: false, todoWriteData: null, retryTriggered: false };
    }

    console.log('[PlanModeHandler] 📋 Checking for plan in blocks:', blocks?.length || 0, 'blocks');

    // Extract plan from blocks
    let todoWriteData = extractTodoWriteFromBlocks(blocks || []);
    console.log(
      '[PlanModeHandler] 📋 Plan from blocks:',
      todoWriteData ? `Found ${todoWriteData.todos.length} todos` : 'Not found'
    );

    // Fallback: Try parsing from message content if blocks parsing failed
    if (!todoWriteData && responseMessage) {
      console.log('[PlanModeHandler] 📋 Trying to extract plan from message content');
      console.log('[PlanModeHandler] 📋 Message content length:', responseMessage.length);
      todoWriteData = extractPlanFromText(responseMessage);
      console.log(
        '[PlanModeHandler] 📋 Plan from text:',
        todoWriteData ? `Found ${todoWriteData.todos.length} todos` : 'Not found'
      );
    }

    // Plan Mode validation: If no plan found, retry once
    if (!todoWriteData || todoWriteData.todos.length === 0) {
      console.warn('[PlanModeHandler] ⚠️  Plan Mode active but no plan found in response');

      // Check if this is already a retry (prevent infinite loop)
      const isRetry = assistantMessage.metadata?.planRetryAttempt || 0;

      if (isRetry === 0) {
        console.log('[PlanModeHandler] 🔄 Automatically requesting plan from Claude (retry 1/1)');

        // Update assistant message to show we're requesting a plan
        onMessageUpdate(assistantMessageId, {
          metadata: {
            ...assistantMessage.metadata,
            planRetryAttempt: 1,
          },
        });

        // Send automatic follow-up request for plan
        const retryPrompt = `You are in PLAN MODE. You must create a detailed plan in JSON format before proceeding.

Please create a plan with the following structure:
\`\`\`json
{
  "todos": [
    {
      "content": "Task description",
      "activeForm": "Doing task description",
      "status": "pending",
      "complexity": "trivial" | "simple" | "moderate" | "complex" | "very_complex",
      "priority": "low" | "medium" | "high" | "critical",
      "estimatedDuration": 30,
      "order": 0,
      "depth": 0
    }
  ]
}
\`\`\`

Wrap the JSON in triple backticks with 'json' language marker. This is REQUIRED.`;

        // Send retry message
        setTimeout(() => {
          ipcRenderer.send('claude:send-message', sessionId, retryPrompt, [], 'plan');
        }, 1000);

        return { hasPlan: false, todoWriteData: null, retryTriggered: true };
      } else {
        console.error(
          '[PlanModeHandler] ❌ Plan Mode retry failed - Claude did not provide a plan after 2 attempts'
        );

        // Show error to user
        const errorMessage =
          responseMessage +
          '\n\n⚠️  **Plan Mode Error**: Claude did not provide a plan in the required JSON format. Please try again or switch to Normal mode.';

        onMessageUpdate(assistantMessageId, {
          content: errorMessage,
          metadata: {
            ...assistantMessage.metadata,
            planGenerationFailed: true,
          },
        });

        // Save the message with error
        await ipcRenderer.invoke('message:save', {
          ...assistantMessage,
          content: errorMessage,
          metadata: {
            ...assistantMessage.metadata,
            planGenerationFailed: true,
          },
        });

        return { hasPlan: false, todoWriteData: null, retryTriggered: false };
      }
    }

    // Plan found successfully
    return { hasPlan: true, todoWriteData, retryTriggered: false };
  }
}
